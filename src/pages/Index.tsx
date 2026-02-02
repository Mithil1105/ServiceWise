import { HeroSection } from '@/components/sections/HeroSection';
import { BentoGrid } from '@/components/sections/BentoGrid';
import { TimelineSection } from '@/components/sections/TimelineSection';
import { FeatureBlocks } from '@/components/sections/FeatureBlocks';
import { DashboardPreview } from '@/components/sections/DashboardPreview';
import { CTASection } from '@/components/sections/CTASection';
import { PageFAQ } from '@/components/marketing/PageFAQ';
import { PAGE_FAQS } from '@/lib/page-faqs';

/**
 * Home page (route /).
 * Rendered inside MarketingLayout by the router.
 */
export default function Index() {
  return (
    <>
      <HeroSection />
      <BentoGrid />
      <TimelineSection />
      <FeatureBlocks />
      <DashboardPreview />
      <PageFAQ items={PAGE_FAQS.home} />
      <CTASection />
    </>
  );
}
