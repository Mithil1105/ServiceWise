import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Receipt, DollarSign, Car, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeading } from '@/components/marketing/SectionHeading';
import { PageFAQ } from '@/components/marketing/PageFAQ';
import { SmartImage } from '@/components/marketing/SmartImage';
import { PAGE_FAQS } from '@/lib/page-faqs';
import { MockBookingPanel } from '@/components/marketing/MockBookingPanel';
import { MockCriticalQueuePanel } from '@/components/marketing/MockCriticalQueuePanel';
import { MockFleetAndDriversPanel } from '@/components/marketing/MockFleetAndDriversPanel';
import { MockBillPreview } from '@/components/mock-ui/MockBillPreview';
import { MockTransfersList } from '@/components/mock-ui/MockTransfersList';

const categories = [
  {
    title: 'Bookings that don’t clash',
    icon: Calendar,
    bullets: [
      'Status: inquiry, tentative, confirmed, ongoing, completed, cancelled.',
      'System checks free slots with a gap between trips (default 60 min).',
      'You quote with requested cars, then assign real cars that are free.',
      'History of changes (created, status, car assigned/removed, date, rate).',
    ],
    imagePath: '/marketing/booking-calendar.png',
    fallback: <MockBookingPanel className="w-full max-w-[280px] mx-auto" />,
  },
  {
    title: 'Bills in minutes',
    icon: Receipt,
    bullets: [
      'Draft → send → paid.',
      'KM from odometer or manual entry.',
      'Minimum running rule for fair bills (per km and mixed).',
      'PDF generation and download.',
    ],
    imagePath: '/marketing/billing-pdf.png',
    fallback: <MockBillPreview className="w-full max-w-[280px] mx-auto" />,
  },
  {
    title: 'Track advances & cash deposits',
    icon: DollarSign,
    bullets: [
      'Record advance (cash or online, company or personal).',
      'When cash or personal: record when it’s deposited to company.',
      'Pending and done deposits with notes and who handled it.',
      'Company bills and bank accounts.',
    ],
    imagePath: '/marketing/transfer-list.png',
    fallback: <MockTransfersList className="w-full max-w-[280px] mx-auto" />,
  },
  {
    title: 'Cars and drivers organized',
    icon: Car,
    bullets: [
      'Car list, add or edit, status (active or inactive).',
      'Driver profiles and assignment to bookings.',
      'Odometer entries and mileage.',
    ],
    panel: <MockFleetAndDriversPanel className="w-full max-w-[340px] mx-auto" />,
  },
  {
    title: 'Service reminders & critical alerts',
    icon: Wrench,
    bullets: [
      'Rules per car (e.g. oil change every 5000 km).',
      'Critical list: overdue and due-soon cars.',
      'Service records and cost.',
    ],
    imagePath: '/marketing/service-alerts.png',
    fallback: <MockCriticalQueuePanel className="w-full max-w-[280px] mx-auto" />,
  },
];

export default function FeaturesPage() {
  return (
    <div className="animate-fade-in">
      <section className="border-b bg-muted/30 py-12 sm:py-16">
        <div className="container max-w-6xl px-4 sm:px-6">
          <SectionHeading
            title="Features"
            subtitle="Everything you need for daily fleet operations."
            as="h1"
          />
        </div>
      </section>

      {categories.map((cat, i) => (
        <section key={i} className={cn('py-12 sm:py-16', i % 2 === 1 && 'bg-muted/30')}>
          <div className="container max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 items-start">
              <div>
                <cat.icon className="h-10 w-10 text-primary mb-4" aria-hidden />
                <h2 className="text-2xl font-bold">{cat.title}</h2>
                <ul className="mt-4 space-y-2 list-disc list-inside text-muted-foreground">
                  {cat.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-6 min-h-[220px] flex items-center justify-center">
                {'panel' in cat && cat.panel ? (
                  cat.panel
                ) : 'imagePath' in cat && cat.imagePath && cat.fallback ? (
                  <SmartImage
                    src={cat.imagePath}
                    alt={cat.title}
                    fallback={cat.fallback}
                    className="w-full"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ))}

      <PageFAQ items={PAGE_FAQS.features} />
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
