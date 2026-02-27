import { useState, useEffect } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { SettingsLeaveProvider } from '@/lib/settings-leave-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useIsMasterAdmin } from '@/hooks/use-is-master-admin';
import { setNoIndexMeta } from '@/lib/marketing-seo';
import AppSidebar from './AppSidebar';
import { Loader2, Menu, LogOut } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'app-sidebar-collapsed';

export default function AppLayout() {
  useEffect(() => {
    setNoIndexMeta('App');
  }, []);

  const auth = useAuth();
  const user = auth.user;
  const profile = auth.profile ?? null;
  const loading = auth.loading;
  const role = auth.role;
  const signOut = auth.signOut;
  const { isMasterAdmin, loading: adminLoading } = useIsMasterAdmin();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const isMobile = useIsMobile();

  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {}
      return next;
    });
  };

  if (loading || (!!user && !role && adminLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Phase 6: self-serve signups require email verification
  if (user && !(user as { email_confirmed_at?: string | null }).email_confirmed_at) {
    return <Navigate to="/verify-email" replace />;
  }

  // Phase 6: deactivated users see account disabled (profile.is_active defaults true)
  if (profile && profile.is_active === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">Account disabled</h1>
          <p className="text-muted-foreground mb-4">
            Your account has been deactivated. Please contact your organization administrator.
          </p>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (profile?.organization_id == null) {
    if (isMasterAdmin) {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  if (!role && !isMasterAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Pending</h1>
          <p className="text-muted-foreground mb-4">
            Your account has been created but you don't have a role assigned yet.
            Please contact an administrator to assign your role.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
            <button
              onClick={() => window.location.reload()}
              className="text-accent hover:underline text-sm"
            >
              Refresh page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!role && isMasterAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <AppLayoutContent
      sidebarCollapsed={sidebarCollapsed}
      onToggleCollapse={handleSidebarToggle}
      mobileMenuOpen={mobileMenuOpen}
      setMobileMenuOpen={setMobileMenuOpen}
      auth={auth}
      isMobile={isMobile}
    />
  );
}

function AppLayoutContent({
  sidebarCollapsed,
  onToggleCollapse,
  mobileMenuOpen,
  setMobileMenuOpen,
  auth,
  isMobile,
}: {
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  auth: ReturnType<typeof useAuth>;
  isMobile: boolean;
}) {
  const navigate = useNavigate();

  return (
    <SettingsLeaveProvider
      onConfirmLeave={(path) => navigate(path)}
      renderLeaveDialog={({ open, onOpenChange, onLeave, onCancel }) => (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Unsaved settings</DialogTitle>
              <DialogDescription>
                You have unsaved changes. Do you want to save your settings before leaving, or leave without saving?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={onCancel}>
                Stay
              </Button>
              <Button variant="destructive" onClick={onLeave}>
                Leave without saving
              </Button>
<Button
                 onClick={() => {
                   const saveButtons = document.querySelectorAll('[data-settings-save]');
                   saveButtons.forEach((el) => (el as HTMLButtonElement).click());
                   onCancel();
                 }}
               >
                 Save settings
               </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    >
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={onToggleCollapse}
          />
        </div>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-64 p-0 h-full flex flex-col overflow-hidden">
            <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

      {/* Mobile Header with Hamburger */}
      {isMobile && (
        <header className="md:hidden sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="mr-2"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
            <img
              src={auth?.organization?.logo_url || '/HERO.png'}
              alt={auth?.organization?.company_name || auth?.organization?.name || 'Logo'}
              className="h-8 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = '/HERO.png'; }}
            />
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={cn('min-h-screen', sidebarCollapsed ? 'md:ml-16' : 'md:ml-64')}>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      </div>
    </SettingsLeaveProvider>
  );
}
