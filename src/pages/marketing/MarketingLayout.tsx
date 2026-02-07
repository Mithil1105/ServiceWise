import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useIsMasterAdmin } from '@/hooks/use-is-master-admin';
import { ServiceWiseNavbar } from '@/components/landing/ServiceWiseNavbar';
import { ServiceWiseFooter } from '@/components/landing/ServiceWiseFooter';
import { GradientBackdrop } from '@/components/landing/GradientBackdrop';
import { DotGrid } from '@/components/landing/DotGrid';
import { FloatingOrbs } from '@/components/landing/FloatingOrbs';
import { NoiseOverlay } from '@/components/landing/NoiseOverlay';
import { updateDocumentMeta } from '@/lib/marketing-seo';
import { Loader2 } from 'lucide-react';

export default function MarketingLayout() {
  const { pathname } = useLocation();
  const { user, profile, loading } = useAuth();
  const { isMasterAdmin, loading: adminLoading } = useIsMasterAdmin();

  useEffect(() => {
    updateDocumentMeta(pathname);
  }, [pathname]);

  if (loading || (!!user && adminLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    if (isMasterAdmin && !profile?.organization_id) {
      return <Navigate to="/admin" replace />;
    }
    if (profile?.organization_id) {
      return <Navigate to="/app" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col bg-background">
      <GradientBackdrop />
      <DotGrid />
      <FloatingOrbs />
      <NoiseOverlay />
      <ServiceWiseNavbar />
      <main className="relative flex-1 z-[5]" id="main-content">
        <Outlet />
      </main>
      <ServiceWiseFooter />
    </div>
  );
}
