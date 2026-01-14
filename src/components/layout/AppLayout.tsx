import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import AppSidebar from './AppSidebar';
import { Loader2 } from 'lucide-react';

export default function AppLayout() {
  const { user, loading, role } = useAuth();

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
      <AppSidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
