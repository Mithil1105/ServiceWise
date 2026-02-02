import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepItem = {
  label: string;
  desc: string;
  icon?: LucideIcon;
};

type StepTimelineProps = {
  steps: StepItem[];
  className?: string;
};

export function StepTimeline({ steps, className }: StepTimelineProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between', className)}>
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div
            key={i}
            className="flex-1 min-w-[140px] max-w-[200px] p-4 rounded-xl bg-background border shadow-sm hover:shadow transition-shadow"
          >
            {Icon && <Icon className="h-6 w-6 text-primary mb-2" aria-hidden />}
            <p className="font-semibold text-sm">{step.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
