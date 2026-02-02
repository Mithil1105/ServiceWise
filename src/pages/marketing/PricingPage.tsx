import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Package, Zap, Building2 } from 'lucide-react';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { PageFAQ } from '@/components/marketing/PageFAQ';
import { PricingCards } from '@/components/marketing/PricingCards';
import type { PricingTier } from '@/components/marketing/PricingCards';
import { PAGE_FAQS } from '@/lib/page-faqs';

const tiers: PricingTier[] = [
  {
    name: 'MVP',
    bestFor: 'Small fleets, core daily operations',
    features: ['Fleet, bookings, billing', 'Advance & deposits', 'Services & critical queue', 'Dashboard & roles', 'Mobile-friendly UI'],
    cta: 'Request Demo',
    icon: Package,
    highlight: false,
  },
  {
    name: 'Pro',
    bestFor: 'Growing fleets, full workflow',
    features: ['Everything in MVP', 'Company bills & PDFs', 'Reports & calendar', 'Incidents & downtime', 'Priority support'],
    cta: 'Request Demo',
    icon: Zap,
    highlight: true,
  },
  {
    name: 'Custom',
    bestFor: 'Enterprise, tailored setup',
    features: ['Everything in Pro', 'Custom integrations', 'Dedicated onboarding', 'SLA & support'],
    cta: 'Request Demo',
    icon: Building2,
    highlight: false,
  },
];

const includedInAll = [
  'Mobile-friendly',
  'Team roles (Owner / Manager / Supervisor)',
  'Support & onboarding',
];

export default function PricingPage() {
  return (
    <div className="animate-fade-in">
      <section className="border-b bg-muted/30 py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading
            title="Pricing"
            subtitle="Pick a plan based on your fleet size and needs."
            as="h1"
          />
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <div className="rounded-xl border bg-muted/30 px-4 py-4 mb-10 flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            <p className="text-sm font-medium text-muted-foreground">What’s included in all plans</p>
            {includedInAll.map((item, i) => (
              <span key={i} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0" aria-hidden />
                {item}
              </span>
            ))}
          </div>
          <PricingCards tiers={tiers} />
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Pricing depends on fleet size and modules. Contact us for a tailored quote.
          </p>
        </div>
      </section>

      <PageFAQ items={PAGE_FAQS.pricing} />
      <section className="py-12 border-t">
        <div className="container max-w-6xl px-4 sm:px-6 text-center">
          <Button size="lg" asChild>
            <Link to="/contact">Request Demo</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
