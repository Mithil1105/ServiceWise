import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Car,
  Calendar,
  Receipt,
  DollarSign,
  Gauge,
  Wrench,
  UserCheck,
  LayoutDashboard,
  Settings,
  Users,
  FileText,
} from 'lucide-react';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { BentoGrid } from '@/components/marketing/BentoGrid';
import { FeatureCard } from '@/components/marketing/FeatureCard';
import { PageFAQ } from '@/components/marketing/PageFAQ';
import { SmartImage } from '@/components/marketing/SmartImage';
import { HeroIllustration, BeforeAfterSvg } from '@/components/marketing/illustrations';
import { PAGE_FAQS } from '@/lib/page-faqs';

const modules = [
  { name: 'Cars', icon: Car, desc: 'Vehicles, documents, status' },
  { name: 'Bookings', icon: Calendar, desc: 'Create, assign, status lifecycle' },
  { name: 'Bills', icon: Receipt, desc: 'Customer bills, PDF' },
  { name: 'Payments (Advances & Deposits)', icon: DollarSign, desc: 'Advance, transfers, company bills' },
  { name: 'Odometer', icon: Gauge, desc: 'Readings, mileage' },
  { name: 'Services & Alerts', icon: Wrench, desc: 'Rules, overdue and due soon' },
  { name: 'Drivers', icon: UserCheck, desc: 'Profiles, assignments' },
  { name: 'Dashboard', icon: LayoutDashboard, desc: 'Snapshot, attention, KPIs' },
  { name: 'Settings', icon: Settings, desc: 'System config, brands, bank accounts' },
  { name: 'Team Access', icon: Users, desc: 'Owner, Manager, Supervisor' },
];

const dayOneBullets = [
  'Login and team roles (Owner, Manager, Supervisor).',
  'Car list and add or edit a vehicle.',
  'Bookings with no double booking — only free cars show.',
  'Bills with minimum running rule and PDF.',
  'Advance and deposit tracking (pending and done).',
  'Drivers and odometer entry.',
  'Service rules and critical alerts.',
  'Dashboard and supervisor view.',
  'Settings (minimum km, etc.) and user creation.',
  'Responsive UI with mobile sidebar.',
];

const laterBullets = [
  'Reports and analytics (full date ranges).',
  'Incidents and downtime.',
  'Booking calendar view.',
  'Vehicle documents, notes, health score.',
  'Petty expenses.',
  'WhatsApp or Google Maps integration.',
];

export default function ProductPage() {
  return (
    <div className="animate-fade-in">
      <section className="border-b bg-muted/30 py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">Product overview</h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl">
                ServiceWise helps travel companies manage cars, trips, bills, and service reminders — without messy Excel and WhatsApp chaos.
              </p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <SmartImage
                src="/marketing/hero-dashboard.png"
                alt="Product overview"
                fallback={<HeroIllustration className="w-full max-w-sm text-muted-foreground" />}
                className="max-w-full w-full max-w-sm"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading title="Modules" subtitle="Everything in one place." className="mb-8" />
          <BentoGrid cols={3}>
            {modules.map((m, i) => (
              <FeatureCard key={i} icon={m.icon} title={m.name}>
                {m.desc}
              </FeatureCard>
            ))}
          </BentoGrid>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading title="Before vs After" subtitle="Less chaos, more clarity." className="mb-8" />
          <div className="max-w-2xl mx-auto rounded-xl border bg-card p-6 shadow-sm">
            <BeforeAfterSvg className="w-full text-muted-foreground" />
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="font-semibold text-foreground">Before</p>
                <p className="text-muted-foreground mt-1">Excel + calls + confusion.</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-4">
                <p className="font-semibold text-foreground">After</p>
                <p className="text-muted-foreground mt-1">One system + clear status + history.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold mb-4">What you get on day 1</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            {dayOneBullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="container max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <FileText className="h-6 w-6" aria-hidden />
            Can be added later
          </h2>
          <p className="text-muted-foreground mb-4">
            Reports, calendar, incidents, docs, petty expenses, WhatsApp or maps — on the roadmap.
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            {laterBullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </section>

      <PageFAQ items={PAGE_FAQS.product} />
      <section className="py-12 border-t">
        <div className="container max-w-6xl px-4 sm:px-6 text-center">
          <Button asChild>
            <Link to="/contact">Request Demo</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
