import { useState } from 'react';
import { cn } from '@/lib/utils';

export type FlowStep = {
  id: string;
  title: string;
  desc: string;
  lane: 'booking' | 'trip' | 'money';
  chipColor: 'muted' | 'primary' | 'success' | 'warning';
};

const DEFAULT_STEPS: FlowStep[] = [
  { id: 'inquiry', title: 'Inquiry', desc: 'Someone calls. You save details.', lane: 'booking', chipColor: 'muted' },
  { id: 'hold', title: 'Hold (Optional)', desc: 'Hold a car for a short time.', lane: 'booking', chipColor: 'muted' },
  { id: 'confirmed', title: 'Confirmed', desc: 'Trip is fixed.', lane: 'booking', chipColor: 'primary' },
  { id: 'ongoing', title: 'Ongoing', desc: 'Trip is running.', lane: 'trip', chipColor: 'primary' },
  { id: 'completed', title: 'Completed', desc: 'Trip finished.', lane: 'trip', chipColor: 'success' },
  { id: 'bill', title: 'Bill', desc: 'Make and share the bill PDF.', lane: 'money', chipColor: 'muted' },
  { id: 'transfer', title: 'Deposit / Transfer', desc: 'Record cash deposit if needed.', lane: 'money', chipColor: 'warning' },
  { id: 'paid', title: 'Paid', desc: 'Mark paid and close.', lane: 'money', chipColor: 'success' },
];

const LANE_LABELS: Record<FlowStep['lane'], string> = {
  booking: 'Booking',
  trip: 'Trip',
  money: 'Money',
};

const LEGEND_ITEMS = [
  "Busy cars won't be double booked",
  'Minimum running rule keeps billing fair',
  'Your team sees only what they need',
];

/** Simple inline SVG icons per step (no external assets) */
function StepIcon({ stepId, className }: { stepId: string; className?: string }) {
  const iconClass = cn('w-8 h-8', className);
  switch (stepId) {
    case 'inquiry':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={iconClass} aria-hidden>
          <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 16h8M16 12v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'hold':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={iconClass} aria-hidden>
          <rect x="8" y="6" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 10h8M12 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'confirmed':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={iconClass} aria-hidden>
          <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'ongoing':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={iconClass} aria-hidden>
          <path d="M6 18l4-6 6 2 8-6v12l-8-4-6 4-4-6z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
        </svg>
      );
    case 'completed':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={iconClass} aria-hidden>
          <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'bill':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={iconClass} aria-hidden>
          <path d="M8 4h16v20H8z" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M8 10h16M8 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'transfer':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={iconClass} aria-hidden>
          <path d="M8 20l8-8 8 8M16 12v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'paid':
      return (
        <svg viewBox="0 0 32 32" fill="none" className={iconClass} aria-hidden>
          <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="2" fill="none" className={iconClass} />;
  }
}

function chipClass(chip: FlowStep['chipColor']): string {
  switch (chip) {
    case 'primary':
      return 'bg-primary/15 text-primary border-primary/30';
    case 'success':
      return 'bg-success/15 text-success border-success/30';
    case 'warning':
      return 'bg-warning/15 text-warning border-warning/30';
    default:
      return 'bg-muted/80 text-muted-foreground border-border';
  }
}

type BookingToCashFlowChartProps = {
  steps?: FlowStep[];
  compact?: boolean;
  showLegend?: boolean;
  className?: string;
};

export function BookingToCashFlowChart({
  steps = DEFAULT_STEPS,
  compact = false,
  showLegend = true,
  className,
}: BookingToCashFlowChartProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Show section label when lane changes
  const laneOrder: FlowStep['lane'][] = ['booking', 'trip', 'money'];
  const getPrevLane = (idx: number) => (idx > 0 ? steps[idx - 1].lane : null);
  const showLaneLabel = (idx: number) => {
    const prev = getPrevLane(idx);
    return !prev || prev !== steps[idx].lane;
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl border p-4 sm:p-6 overflow-hidden',
        'bg-gradient-to-br from-background via-background to-muted/30',
        'before:content-[""] before:absolute before:inset-0 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-[size:24px_24px] before:opacity-40 before:pointer-events-none',
        className
      )}
    >
      <div className="relative z-10">
        {/* Single vertical flow for all screen sizes */}
        <div className="max-w-md mx-auto space-y-0">
          {steps.map((step, i) => (
            <div key={step.id} className="flex flex-col">
              {/* Section label when lane changes */}
              {showLaneLabel(i) && (
                <div className="pt-2 pb-1 first:pt-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                    {LANE_LABELS[step.lane]}
                  </p>
                </div>
              )}
              {/* Connector line above (except first step) */}
              {i > 0 && !showLaneLabel(i) && (
                <div className="h-3 w-full flex justify-center" aria-hidden>
                  <div className="w-px h-full bg-border" />
                </div>
              )}
              {i > 0 && showLaneLabel(i) && (
                <div className="h-2 w-full flex justify-center" aria-hidden>
                  <div className="w-px h-full bg-border" />
                </div>
              )}
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === step.id ? null : step.id)}
                className={cn(
                  'w-full text-left rounded-xl border p-3 transition-all duration-200',
                  'hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  chipClass(step.chipColor)
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 text-muted-foreground mt-0.5">
                    <StepIcon stepId={step.id} className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{step.title}</p>
                    {compact ? (
                      expandedId === step.id ? (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{step.desc}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground mt-1">Tap to expand</p>
                      )
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{step.desc}</p>
                    )}
                  </div>
                  <span
                    className={cn('shrink-0 text-muted-foreground transition-transform', expandedId === step.id && 'rotate-180')}
                    aria-hidden
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="mt-8 pt-6 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick facts</p>
            <ul className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {LEGEND_ITEMS.map((item, i) => (
                <li
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <span className="size-1.5 rounded-full bg-primary/60" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
