import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import AppSidebar from './AppSidebar';
import { Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AppLayout() {
  const { user, loading, role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Pending</h1>
          <p className="text-muted-foreground mb-4">
            Your account has been created but you don't have a role assigned yet.
            Please contact an administrator to assign your role.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-accent hover:underline"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
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
            <img src="/SWlogo.png" alt="ServiceWise" className="h-8 w-auto object-contain" />
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen">
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
