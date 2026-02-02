import { MessageSquare, Calendar, Car, FileCheck, Receipt, Wallet, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { label: 'Inquiry', desc: 'Customer reaches out', icon: MessageSquare },
  { label: 'Booking', desc: 'Dates and car', icon: Calendar },
  { label: 'Assign', desc: 'Assign vehicle', icon: Car },
  { label: 'Trip', desc: 'Trip in progress', icon: Car },
  { label: 'Completed', desc: 'Trip finished', icon: FileCheck },
  { label: 'Bill', desc: 'Invoice generated', icon: Receipt },
  { label: 'Payment', desc: 'Deposit / transfer', icon: Wallet },
  { label: 'Paid', desc: 'Booking closed', icon: CheckCircle },
];

export function TimelineSection() {
  return (
    <section className="section-padding bg-background" aria-labelledby="timeline-heading">
      <div className="section-container">
        <h2 id="timeline-heading" className="text-2xl md:text-3xl font-bold text-center mb-4 text-foreground">
          From inquiry to paid
        </h2>
        <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
          One clear path: inquiry → booking → assign → trip → completed → bill → payment → paid
        </p>
        {/* Desktop: horizontal */}
        <div className="hidden md:flex flex-wrap justify-center gap-4 lg:gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="bento-card min-w-[140px] max-w-[160px] p-4 animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <Icon className="h-6 w-6 text-primary mb-2" aria-hidden />
                  <p className="font-semibold text-sm text-foreground">{step.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <span className="text-muted-foreground/50 shrink-0" aria-hidden>
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M14 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {/* Mobile: vertical stack */}
        <div className="md:hidden space-y-0">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i}>
                <div className="bento-card p-4 flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <Icon className="h-6 w-6 text-primary shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex justify-center py-2" aria-hidden>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-muted-foreground/50" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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
