import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  Car,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const bentoCards = [
  {
    title: 'Messy booking chaos',
    description: 'Track every inquiry, hold, and confirmation in one place. No more lost bookings.',
    icon: Calendar,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-500/10 border-blue-200',
  },
  {
    title: 'Money leaks',
    description: 'Know exactly who owes you what. Bills, deposits, and transfers — all tracked.',
    icon: DollarSign,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-500/10 border-emerald-200',
  },
  {
    title: 'Driver confusion',
    description: 'Assign drivers to jobs clearly. They see their schedule, you see their status.',
    icon: Users,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-500/10 border-violet-200',
  },
  {
    title: 'Missed maintenance',
    description: 'Get reminders before something breaks. Oil changes, inspections, renewals.',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-500/10 border-amber-200',
  },
  {
    title: 'Vehicle blindspots',
    description: 'See your entire fleet at a glance. Which cars are free, busy, or in the shop.',
    icon: Car,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-500/10 border-teal-200',
  },
  {
    title: 'No clear numbers',
    description: 'Dashboards that show revenue, utilization, and pending tasks instantly.',
    icon: BarChart3,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-500/10 border-rose-200',
  },
];

export function BentoGrid() {
  return (
    <section className="section-padding bg-muted/20" aria-labelledby="bento-heading">
      <div className="section-container">
        <h2 id="bento-heading" className="text-2xl md:text-3xl font-bold text-center mb-4 text-foreground">
          What we fix
        </h2>
        <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
          One system for your entire fleet workflow.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {bentoCards.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={cn(
                  'bento-card flex flex-col',
                  'animate-fade-in-up'
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div
                  className={cn(
                    'inline-flex h-11 w-11 items-center justify-center rounded-xl border mb-3',
                    item.iconBg,
                    item.iconColor
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-semibold text-lg text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground flex-1">{item.description}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 w-fit text-primary hover:text-primary/90 hover:bg-primary/5"
                  onClick={() =>
                    toast({
                      title: item.title,
                      description: 'Learn more on the Features page.',
                    })
                  }
                >
                  Learn more
                </Button>
              </div>
            );
          })}
        </div>
        <div className="mt-8 sm:mt-10 text-center">
          <Button asChild variant="outline" className="btn-outline-hero">
            <Link to="/how-it-works">See how it works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
