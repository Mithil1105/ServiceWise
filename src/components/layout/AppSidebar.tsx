import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useSettingsLeave } from '@/lib/settings-leave-context';
import {
  LayoutDashboard,
  Car,
  Gauge,
  Wrench,
  AlertTriangle,
  AlertCircle,
  FileText,
  Settings,
  Users,
  LogOut,
  CalendarDays,
  UserCheck,
  ClipboardList,
  Clock,
  Receipt,
  DollarSign,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  Upload,
} from 'lucide-react';
import { useIsMasterAdmin } from '@/hooks/use-is-master-admin';
import { cn } from '@/lib/utils';
import { DEFAULT_ORG_LOGO_URL } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  { title: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { title: 'Bookings', href: '/app/bookings', icon: CalendarDays, adminOnly: true },
  { title: 'Billing', href: '/app/billing', icon: Receipt, adminOnly: true },
  { title: 'Fleet', href: '/app/fleet', icon: Car },
  { title: 'Drivers', href: '/app/drivers', icon: UserCheck },
  { title: 'Odometer', href: '/app/odometer', icon: Gauge },
  { title: 'Services', href: '/app/services', icon: Wrench },
  { title: 'Critical Queue', href: '/app/critical', icon: AlertTriangle },
  { title: 'Incidents', href: '/app/incidents', icon: AlertCircle },
  { title: 'Downtime Report', href: '/app/downtime-report', icon: Clock },
  { title: 'Reports', href: '/app/reports', icon: FileText },
];

const adminItems = [
  { title: 'Financials', href: '/app/financials', icon: DollarSign },
  { title: 'Supervisors', href: '/app/supervisors', icon: ClipboardList },
  { title: 'Settings', href: '/app/settings', icon: Settings },
  { title: 'Import', href: '/app/import', icon: Upload },
  { title: 'Users', href: '/app/users', icon: Users, adminOnly: true },
];

interface AppSidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const SETTINGS_PATH = '/app/settings';

export default function AppSidebar({ onNavigate, collapsed = false, onToggleCollapse }: AppSidebarProps = {}) {
  const { profile, role, signOut, isAdmin, isManager, isSupervisor, organization } = useAuth();
  const { isMasterAdmin } = useIsMasterAdmin();
  const location = useLocation();
  const leaveContext = useSettingsLeave();
  const [hoverExpanded, setHoverExpanded] = useState(false);

  const isOnSettings = location.pathname === SETTINGS_PATH || location.pathname.startsWith(SETTINGS_PATH + '/');
  const shouldPromptLeave = isOnSettings && leaveContext?.hasUnsavedChanges;

  // When collapsed, hover temporarily shows full sidebar; leave collapses it again
  const visuallyNarrow = collapsed && !hoverExpanded;
  const showFullContent = !visuallyNarrow;

  // Filter nav items: supervisors see Bookings (assign-only), but not Billing; other adminOnly only for admin/manager
  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && isSupervisor && !isAdmin && !isManager) {
      if (item.href === '/app/bookings') return true; // Supervisors see Bookings to assign vehicles
      return false; // Billing and other admin-only stay hidden
    }
    return true;
  });

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (shouldPromptLeave && href !== SETTINGS_PATH) {
      e.preventDefault();
      leaveContext?.promptLeave(href);
      return;
    }
    if (onNavigate) {
      onNavigate();
    }
  };

  const logoUrl = organization?.logo_url || DEFAULT_ORG_LOGO_URL;
  const orgName = organization?.company_name || organization?.name || 'ServiceWise';

  return (
    <aside
      className={cn(
        'h-full bg-sidebar flex flex-col border-r border-sidebar-border md:fixed md:left-0 md:top-0 md:h-screen min-h-0 md:z-40 transition-[width] duration-200 ease-in-out',
        visuallyNarrow ? 'w-16' : 'w-64'
      )}
      onMouseEnter={() => collapsed && setHoverExpanded(true)}
      onMouseLeave={() => collapsed && setHoverExpanded(false)}
    >
      {/* Header with Logo + Toggle */}
      <div className={cn('flex items-center flex-shrink-0', visuallyNarrow ? 'p-2 justify-center' : 'p-4 gap-3')}>
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="flex-shrink-0 text-sidebar-foreground hover:bg-sidebar-accent/50"
            aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
          >
            {visuallyNarrow ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        )}
        {showFullContent && (
          <>
            <img
              src={logoUrl}
              alt={orgName}
              className="h-10 w-auto object-contain flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_ORG_LOGO_URL; }}
            />
            <span className="text-lg font-semibold text-sidebar-foreground truncate">{orgName}</span>
          </>
        )}
      </div>

      <Separator className="bg-sidebar-border flex-shrink-0" />

      {/* Navigation - scrollable when content overflows */}
      <nav className={cn('flex-1 min-h-0 space-y-1 overflow-y-auto overflow-x-hidden', visuallyNarrow ? 'p-2' : 'p-3')}>
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/app' && location.pathname.startsWith(item.href + '/'));
          
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              title={visuallyNarrow ? item.title : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-all',
                visuallyNarrow ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {showFullContent && (
                <>
                  <span className="truncate">{item.title}</span>
                  {item.href === '/app/critical' && (
                    <Badge variant="error" className="ml-auto text-[10px] px-1.5 py-0 flex-shrink-0">
                      !
                    </Badge>
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {isMasterAdmin && (
          <>
            {showFullContent && (
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">
                  Admin
                </p>
              </div>
            )}
            <NavLink
              to="/admin"
              onClick={(e) => handleNavClick(e, '/admin')}
              title={visuallyNarrow ? 'Admin' : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-all',
                visuallyNarrow ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                location.pathname.startsWith('/admin')
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              {showFullContent && <span className="truncate">Admin</span>}
            </NavLink>
          </>
        )}
        {(isAdmin || isManager) && (
          <>
            {showFullContent && (
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">
                  Admin
                </p>
              </div>
            )}
            {adminItems.filter((item) => !('adminOnly' in item && item.adminOnly) || isAdmin).map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
              
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  title={visuallyNarrow ? item.title : undefined}
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition-all',
                    visuallyNarrow ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {showFullContent && <span className="truncate">{item.title}</span>}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      <Separator className="bg-sidebar-border flex-shrink-0" />

      {/* User Info */}
      <div className={cn('flex-shrink-0', visuallyNarrow ? 'p-2' : 'p-3')}>
        <div className={cn('flex items-center py-2', visuallyNarrow ? 'justify-center px-0' : 'gap-3 px-3')}>
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-sidebar-foreground">
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          {showFullContent && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.name || 'User'}
              </p>
              <Badge 
                variant={role === 'admin' ? 'accent' : 'muted'} 
                className="text-[10px] mt-0.5"
              >
                {role?.toUpperCase() || 'NO ROLE'}
              </Badge>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size={visuallyNarrow ? 'icon' : 'sm'}
          onClick={signOut}
          title={visuallyNarrow ? 'Log out' : undefined}
          className={cn(
            'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 mt-1',
            visuallyNarrow ? 'w-full flex justify-center' : 'w-full justify-start'
          )}
        >
          <LogOut className="h-4 w-4" />
          {showFullContent && <span className="ml-2">Log out</span>}
        </Button>
      </div>
    </aside>
  );
}
