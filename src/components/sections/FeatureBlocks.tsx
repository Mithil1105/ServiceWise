import { type ReactNode } from 'react';
import { MockDashboard } from '@/components/mock-ui/MockDashboard';
import { MockBookingCalendar } from '@/components/mock-ui/MockBookingCalendar';
import { MockBillPreview } from '@/components/mock-ui/MockBillPreview';
import { MockTransfersList } from '@/components/mock-ui/MockTransfersList';
import { cn } from '@/lib/utils';

interface FeatureBlockProps {
  title: string;
  description: string;
  bullets: string[];
  mockUI: ReactNode;
  reverse?: boolean;
}

const FeatureBlock = ({ title, description, bullets, mockUI, reverse }: FeatureBlockProps) => (
  <div
    className={cn(
      'flex flex-col items-center gap-8 lg:gap-16',
      reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'
    )}
  >
    {/* Content */}
    <div className="flex-1 w-full max-w-lg text-center lg:text-left">
      <h3 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">{title}</h3>
      <p className="text-lg text-muted-foreground mb-6">{description}</p>
      <ul className="space-y-3 text-left max-w-md mx-auto lg:mx-0">
        {bullets.map((bullet, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
            </span>
            <span className="text-muted-foreground">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>

    {/* Mock UI - same content as before, wrapped for consistent sizing */}
    <div className="flex-1 w-full min-w-0 flex justify-center lg:justify-start">
      <div className="w-full max-w-lg min-w-0">
        {mockUI}
      </div>
    </div>
  </div>
);

const features = [
  {
    title: 'Dashboard that tells you what matters',
    description: 'Open your day with numbers that count and tasks that need attention.',
    bullets: [
      'See active bookings, revenue, and pending bills at a glance',
      'Attention list shows overdue items and urgent alerts',
      'Track driver activity and vehicle status in real-time',
    ],
    mockUI: <MockDashboard className="w-full" />,
  },
  {
    title: 'Bookings on a calendar you can read',
    description: 'Visual booking management that makes conflicts impossible to miss.',
    bullets: [
      'Drag-and-drop scheduling for quick changes',
      'Color-coded by status: confirmed, hold, ongoing',
      'Filter by vehicle, driver, or client instantly',
    ],
    mockUI: <MockBookingCalendar className="w-full" />,
  },
  {
    title: 'Bills that write themselves',
    description: 'Generate professional invoices from completed trips automatically.',
    bullets: [
      'Auto-calculate based on service rates and duration',
      'Send via email or download PDF in one click',
      'Track sent, viewed, and paid status',
    ],
    mockUI: <MockBillPreview className="w-full" />,
  },
  {
    title: 'Money flow you can follow',
    description: 'Every deposit and transfer tracked from client to bank.',
    bullets: [
      'Record deposits against invoices instantly',
      'See pending transfers and completed payments',
      'Reconcile with bank statements easily',
    ],
    mockUI: <MockTransfersList className="w-full" />,
  },
];

export function FeatureBlocks() {
  return (
    <section
      className="section-padding bg-background"
      aria-labelledby="feature-blocks-heading"
    >
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-20">
          <h2
            id="feature-blocks-heading"
            className="text-3xl md:text-4xl font-bold mb-4 text-foreground"
          >
            Built for how you actually work
          </h2>
          <p className="text-lg text-muted-foreground">
            Every screen designed to save you time and reduce mistakes.
          </p>
        </div>

        {/* Feature Blocks */}
        <div className="space-y-24 lg:space-y-32">
          {features.map((feature, idx) => (
            <FeatureBlock
              key={idx}
              {...feature}
              reverse={idx % 2 === 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
