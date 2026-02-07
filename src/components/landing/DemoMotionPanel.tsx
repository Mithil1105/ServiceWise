import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const STATUSES = [
  { label: 'Draft', variant: 'muted' as const },
  { label: 'Submitted', variant: 'primary' as const },
  { label: 'Under Review', variant: 'warning' as const },
  { label: 'Approved', variant: 'accent' as const },
];

export function DemoMotionPanel({ className }: { className?: string }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [budgetPct, setBudgetPct] = useState(0);
  const [pettyPct, setPettyPct] = useState(0);

  // Cycle status every 2s
  useEffect(() => {
    const t = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUSES.length);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // Monthly budget bar: 0–85%, increment every 50ms, then reset
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    const run = () => {
      setBudgetPct((p) => {
        if (p >= 85) {
          clearInterval(id);
          setTimeout(() => setBudgetPct(0), 500);
          return 85;
        }
        return p + 1;
      });
    };
    id = setInterval(run, 50);
    return () => clearInterval(id);
  }, [budgetPct === 0]);

  // Petty cash bar: 0–65%, increment every 70ms, then reset
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    const run = () => {
      setPettyPct((p) => {
        if (p >= 65) {
          clearInterval(id);
          setTimeout(() => setPettyPct(0), 500);
          return 65;
        }
        return p + 1;
      });
    };
    id = setInterval(run, 70);
    return () => clearInterval(id);
  }, [pettyPct === 0]);

  const currentStatus = STATUSES[statusIndex];

  return (
    <div className={cn('rounded-xl border bg-card/80 backdrop-blur shadow-soft p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">Live Activity</span>
        <span className="flex items-center gap-1.5 text-xs text-accent">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Live
        </span>
      </div>

      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1">Status:</p>
        <div
          className={cn(
            'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-all duration-500',
            currentStatus.variant === 'muted' && 'bg-muted text-muted-foreground',
            currentStatus.variant === 'primary' && 'bg-primary/10 text-primary',
            currentStatus.variant === 'warning' && 'bg-warning/10 text-warning',
            currentStatus.variant === 'accent' && 'bg-accent/10 text-accent'
          )}
        >
          {currentStatus.label}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Monthly Budget</span>
            <span className="font-medium text-foreground">{budgetPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Petty Cash Used</span>
            <span className="font-medium text-foreground">{pettyPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${pettyPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="h-1 w-full rounded-full shimmer" />
    </div>
  );
}
