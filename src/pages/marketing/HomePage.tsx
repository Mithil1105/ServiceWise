import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Car,
  Calendar,
  Receipt,
  Wrench,
  Smartphone,
  Users,
  Shield,
  TrendingUp,
  AlertTriangle,
  Smartphone as MobileIcon,
  Zap,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { FeatureCard } from '@/components/marketing/FeatureCard';
import { BentoGrid } from '@/components/marketing/BentoGrid';
import { BookingToCashFlowChart } from '@/components/marketing/BookingToCashFlowChart';
import { MockDashboardPanel } from '@/components/marketing/MockDashboardPanel';
import { MockBookingPanel } from '@/components/marketing/MockBookingPanel';
import { MockCriticalQueuePanel } from '@/components/marketing/MockCriticalQueuePanel';
import { MockBillPreview } from '@/components/mock-ui/MockBillPreview';
import { MockTransfersList } from '@/components/mock-ui/MockTransfersList';
import { SmartImage } from '@/components/marketing/SmartImage';
import { HeroIllustration } from '@/components/marketing/illustrations';

const bentoCards = [
  { title: 'Cars & availability', description: 'See which cars are free and which are busy.', icon: Car },
  { title: 'Bookings', description: 'Create bookings and assign cars in seconds.', icon: Calendar },
  { title: 'Billing', description: 'Generate bills after the trip and share a PDF.', icon: Receipt },
  { title: 'Payments', description: 'Note advances and track pending deposits.', icon: TrendingUp },
  { title: 'Service alerts', description: 'Get reminders when a car needs service.', icon: Wrench },
  { title: 'Team access', description: 'Owner / manager / supervisor views.', icon: Users },
];

const featureBlocks = [
  {
    title: 'Stops double booking',
    bullets: [
      'System checks free slots with a small gap between trips (default 60 min).',
      'Inquiry, tentative, confirmed, and ongoing all block the car.',
      'You only add cars that are still free.',
    ],
    icon: Shield,
    panel: <MockBookingPanel className="w-full max-w-[280px] mx-auto" />,
  },
  {
    title: 'Simple pricing & fair minimum rule',
    bullets: [
      'Total, per day, per km, or mixed (day + km).',
      'Minimum running rule so bills stay fair (e.g. 300 km/day).',
      'You set the rules once; the system applies them.',
    ],
    icon: Receipt,
    panel: <MockBillPreview className="w-full max-w-[280px] mx-auto" />,
  },
  {
    title: 'Advance & cash tracking',
    bullets: [
      'Record advance (cash or online, company or personal).',
      'When cash or personal: record when it’s deposited to company.',
      'Pending and done deposits with notes and who handled it.',
    ],
    icon: TrendingUp,
    panel: <MockTransfersList className="w-full max-w-[280px] mx-auto" />,
  },
  {
    title: 'Service reminders',
    bullets: [
      'Set rules per car (e.g. oil change every 5000 km).',
      'Critical list: overdue and due-soon cars.',
      'Dashboard and a dedicated alerts page.',
    ],
    icon: AlertTriangle,
    panel: <MockCriticalQueuePanel className="w-full max-w-[280px] mx-auto" />,
  },
];

const socialProof = [
  { text: 'Works on mobile', icon: MobileIcon },
  { text: 'Fast to learn', icon: Zap },
  { text: 'Made for travel operators', icon: Target },
];

export default function HomePage() {
  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative border-b bg-gradient-to-b from-muted/40 to-background py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 to-transparent pointer-events-none" />
        <div className="container relative max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Fleet operations. Booking-to-cash. In one system.
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl">
                Run your travel fleet from one screen — cars, bookings, drivers, payments, and service reminders.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Button size="lg" asChild className="w-full sm:w-auto">
                  <Link to="/contact">Request Demo</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                  <Link to="/features">Explore Features</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                <Badge variant="secondary" className="px-3 py-1 text-xs font-normal">
                  Stops double booking
                </Badge>
                <Badge variant="secondary" className="px-3 py-1 text-xs font-normal">
                  Fair billing with minimum running rule
                </Badge>
                <Badge variant="secondary" className="px-3 py-1 text-xs font-normal">
                  Track cash received and deposits
                </Badge>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                {socialProof.map((item, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-primary" aria-hidden />
                    {item.text}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <SmartImage
                src="/marketing/hero-dashboard.png"
                alt="ServiceWise dashboard"
                fallback={<HeroIllustration className="text-muted-foreground" />}
                className="max-w-full w-full max-w-md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* What it solves - bento */}
      <section className="py-16 sm:py-20 bg-muted/20">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading title="What it solves" subtitle="One place for your daily fleet work." className="mb-10" />
          <BentoGrid cols={3}>
            {bentoCards.map((item, i) => (
              <FeatureCard key={i} icon={item.icon} title={item.title}>
                {item.description}
              </FeatureCard>
            ))}
          </BentoGrid>
        </div>
      </section>

      {/* How you use ServiceWise - compact flowchart */}
      <section className="py-16 sm:py-20">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading title="How you use ServiceWise" subtitle="From first call to paid — simple steps." className="mb-10" />
          <BookingToCashFlowChart compact={true} showLegend={true} className="max-w-4xl mx-auto" />
        </div>
      </section>

      {/* Feature preview blocks with mock panels */}
      <section className="py-16 sm:py-20 bg-muted/20">
        <div className="container max-w-6xl px-4 sm:px-6 space-y-20">
          {featureBlocks.map((block, i) => (
            <div
              key={i}
              className={cn(
                'grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 items-center',
                i % 2 === 1 && 'lg:flex-row-reverse'
              )}
            >
              <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                <block.icon className="h-10 w-10 text-primary mb-4" aria-hidden />
                <h3 className="text-xl font-bold sm:text-2xl">{block.title}</h3>
                <ul className="mt-4 space-y-2 list-disc list-inside text-muted-foreground">
                  {block.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className={cn('flex justify-center', i % 2 === 1 ? 'lg:order-1' : '')}>
                {block.panel}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading title="Dashboard preview" subtitle="Your day at a glance." className="mb-10" />
          <div className="max-w-lg mx-auto">
            <MockDashboardPanel />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-20 border-t">
        <div className="container max-w-6xl px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Want a demo tailored to your fleet size?
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Tell us your fleet size — we’ll show how it fits your daily work.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/contact">Request Demo</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
