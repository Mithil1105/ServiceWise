import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { MarketingNavbar } from '@/components/marketing/MarketingNavbar';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { updateDocumentMeta } from '@/lib/marketing-seo';

export default function MarketingLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    updateDocumentMeta(pathname);
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingNavbar />
      <main className="flex-1" id="main-content">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
