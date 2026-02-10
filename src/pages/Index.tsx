import { HeroSection } from '@/components/sections/HeroSection';
import { BentoGrid } from '@/components/sections/BentoGrid';
import { TimelineSection } from '@/components/sections/TimelineSection';
import { FeatureBlocks } from '@/components/sections/FeatureBlocks';
import { DashboardPreview } from '@/components/sections/DashboardPreview';
import { CTASection } from '@/components/sections/CTASection';

/**
 * Home page (route /). Exact Lovable-style section layout.
 */
export default function Index() {
  return (
    <main className="relative overflow-x-hidden">
      <HeroSection />
      <BentoGrid />
      <TimelineSection />
      <FeatureBlocks />
      <DashboardPreview />
      <CTASection />
    </main>
  );
}
