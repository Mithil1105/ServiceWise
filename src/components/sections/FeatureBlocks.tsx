import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MockDashboard } from '@/components/mock-ui/MockDashboard';
import { MockBookingCalendar } from '@/components/mock-ui/MockBookingCalendar';
import { MockBillPreview } from '@/components/mock-ui/MockBillPreview';
import { MockTransfersList } from '@/components/mock-ui/MockTransfersList';
import { LayoutDashboard, Calendar, FileText, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const blocks = [
  {
    title: 'Dashboard at a glance',
    description: 'KPIs, attention list, and a clear view of what needs action today.',
    icon: LayoutDashboard,
    panel: <MockDashboard className="w-full max-w-sm mx-auto" />,
  },
  {
    title: 'Booking calendar',
    description: 'See which cars are busy and when. No double bookings.',
    icon: Calendar,
    panel: <MockBookingCalendar className="w-full max-w-sm mx-auto" />,
  },
  {
    title: 'Bills in one click',
    description: 'Generate and share PDF invoices with minimum running rule applied.',
    icon: FileText,
    panel: <MockBillPreview className="w-full max-w-sm mx-auto" />,
  },
  {
    title: 'Money flow',
    description: 'Track advances and deposits — pending and completed.',
    icon: Wallet,
    panel: <MockTransfersList className="w-full max-w-sm mx-auto" />,
  },
];

export function FeatureBlocks() {
  return (
    <section className="section-padding bg-muted/20" aria-labelledby="feature-blocks-heading">
      <div className="section-container">
        <h2 id="feature-blocks-heading" className="text-2xl md:text-3xl font-bold text-center mb-4 text-foreground">
          What you get
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Dashboard, calendar, bills, and money flow — all in one place.
        </p>
        <div className="space-y-20">
          {blocks.map((block, i) => {
            const Icon = block.icon;
            return (
              <div
                key={i}
                className={cn(
                  'grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center',
                  i % 2 === 1 && 'lg:flex-row-reverse'
                )}
              >
                <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                  <Icon className="h-10 w-10 text-primary mb-4 animate-fade-in" aria-hidden />
                  <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3">{block.title}</h3>
                  <p className="text-muted-foreground">{block.description}</p>
                </div>
                <div className={cn('flex justify-center', i % 2 === 1 ? 'lg:order-1' : '')}>
                  {block.panel}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-12 text-center">
          <Button asChild size="lg" className="btn-accent">
            <Link to="/features">View all features</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
