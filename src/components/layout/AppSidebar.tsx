import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
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
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import patidarLogo from '@/assets/patidar-logo.jpg';

const navItems = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Bookings', href: '/bookings', icon: CalendarDays, adminOnly: true },
  { title: 'Fleet', href: '/fleet', icon: Car },
  { title: 'Drivers', href: '/drivers', icon: UserCheck },
  { title: 'Odometer', href: '/odometer', icon: Gauge },
  { title: 'Services', href: '/services', icon: Wrench },
  { title: 'Critical Queue', href: '/critical', icon: AlertTriangle },
  { title: 'Incidents', href: '/incidents', icon: AlertCircle },
  { title: 'Downtime Report', href: '/downtime-report', icon: Clock },
  { title: 'Health Score', href: '/health-score', icon: Heart },
  { title: 'Reports', href: '/reports', icon: FileText },
];

const adminItems = [
  { title: 'Supervisors', href: '/supervisors', icon: ClipboardList },
  { title: 'Settings', href: '/settings', icon: Settings },
  { title: 'Users', href: '/users', icon: Users },
];

export default function AppSidebar() {
  const { profile, role, signOut, isAdmin, isManager, isSupervisor } = useAuth();
  const location = useLocation();

  // Filter nav items based on role - supervisors can't see bookings
  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && isSupervisor && !isAdmin && !isManager) {
      return false;
    }
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Header with Logo */}
      <div className="p-4 flex items-center gap-3">
        <img 
          src={patidarLogo} 
          alt="Patidar Travels" 
          className="h-10 w-auto object-contain"
        />
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
              {item.href === '/critical' && (
                <Badge variant="error" className="ml-auto text-[10px] px-1.5 py-0">
                  !
                </Badge>
              )}
            </NavLink>
          );
        })}

        {(isAdmin || isManager) && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">
                Admin
              </p>
            </div>
            {adminItems.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User Info */}
      <div className="p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-medium text-sidebar-foreground">
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
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
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 mt-1"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </div>
    </aside>
  );
}
