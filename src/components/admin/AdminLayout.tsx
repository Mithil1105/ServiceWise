import { useEffect } from 'react';
import { Outlet, Navigate, NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useIsMasterAdmin } from '@/hooks/use-is-master-admin';
import { setNoIndexMeta } from '@/lib/marketing-seo';
import { Loader2, LayoutDashboard, Building2, ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const adminNav = [
  { title: 'Overview', href: '/admin', icon: LayoutDashboard },
  { title: 'Organizations', href: '/admin/organizations', icon: Building2 },
];

/**
 * Layout for /admin/* routes. Only master admins (user_roles.role='admin', org null) can access.
 */
export default function AdminLayout() {
  useEffect(() => {
    setNoIndexMeta('Admin');
  }, []);

  const { user, loading: authLoading, signOut } = useAuth();
  const { isMasterAdmin, loading: adminLoading } = useIsMasterAdmin();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isMasterAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95">
        <div className="flex h-14 items-center px-4 gap-4 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to app
            </Link>
          </Button>
          <span className="font-semibold">Admin</span>
          <nav className="flex gap-2 ml-4 flex-1">
            {adminNav.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/admin'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 shrink-0">
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
