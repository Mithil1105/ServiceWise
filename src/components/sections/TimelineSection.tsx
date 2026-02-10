import {
  MessageCircle,
  CalendarCheck,
  Settings,
  MapPin,
  CircleCheck,
  FileText,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const steps = [
  { label: 'Receive inquiry', desc: 'Customer asks for a quote', icon: MessageCircle },
  { label: 'Create booking', desc: 'Add dates, vehicle, route', icon: CalendarCheck },
  { label: 'Assign resources', desc: 'Pick driver & vehicle', icon: Settings },
  { label: 'Trip begins', desc: 'Driver marks pickup done', icon: MapPin },
  { label: 'Trip completes', desc: 'Mark job as finished', icon: CircleCheck },
  { label: 'Generate bill', desc: 'Invoice created automatically', icon: FileText },
  { label: 'Receive payment', desc: 'Record deposit or transfer', icon: Wallet },
  { label: 'Mark paid', desc: 'Close the booking loop', icon: CreditCard },
];

const timelineColor = 'text-teal-600 border-teal-200';
const timelineLine = 'bg-teal-500/60';

export function TimelineSection() {
  return (
    <section className="section-padding bg-background" aria-labelledby="timeline-heading">
      <div className="section-container">
        <h2 id="timeline-heading" className="text-2xl md:text-3xl font-bold text-center mb-4 text-foreground">
          How you use it
        </h2>
        <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
          From first inquiry to final payment, every step in one flow.
        </p>
        {/* Desktop: horizontal timeline with connecting line */}
        <div className="hidden md:block overflow-x-auto">
          <div className="flex items-start justify-center gap-0 min-w-max px-2">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex items-start">
                  <button
                    type="button"
                    onClick={() =>
                      toast({
                        title: step.label,
                        description: step.desc,
                      })
                    }
                    className={cn(
                      'flex flex-col items-center min-w-[100px] max-w-[120px] p-3 rounded-xl border-2 bg-card hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
                      timelineColor
                    )}
                  >
                    <span className={cn('rounded-lg border-2 p-2 mb-2 bg-background', timelineColor)}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="font-semibold text-xs text-foreground text-center leading-tight">
                      {step.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground text-center mt-0.5">
                      {step.desc}
                    </p>
                  </button>
                  {i < steps.length - 1 && (
                    <div
                      className={cn('w-4 sm:w-6 h-0.5 mt-8 shrink-0 self-center', timelineLine)}
                      aria-hidden
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Mobile: vertical stack */}
        <div className="md:hidden space-y-0">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i}>
                <button
                  type="button"
                  onClick={() =>
                    toast({ title: step.label, description: step.desc })
                  }
                  className={cn(
                    'w-full bento-card p-4 flex items-center gap-3 animate-fade-in-up border-2',
                    timelineColor
                  )}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className={cn('rounded-lg border-2 p-2 shrink-0', timelineColor)}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="font-semibold text-sm text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </button>
                {i < steps.length - 1 && (
                  <div className="flex justify-center py-2" aria-hidden>
                    <div className={cn('w-0.5 h-4', timelineLine)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
