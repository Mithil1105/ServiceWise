import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Wallet,
  Users,
  Wrench,
  Car,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const bentoCards = [
  { title: 'Messy booking chaos', description: 'Calls, WhatsApp, lost details.', icon: Calendar },
  { title: 'Money leaks', description: 'Advances and deposits slip through.', icon: Wallet },
  { title: 'Driver confusion', description: 'Who’s on which trip?', icon: Users },
  { title: 'Missed maintenance', description: 'Service due? No one knows.', icon: Wrench },
  { title: 'Vehicle blindspots', description: 'Where’s the car? What’s the KM?', icon: Car },
  { title: 'No clear numbers', description: 'Bills, transfers, reports — scattered.', icon: BarChart3 },
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
                <Icon className="h-10 w-10 text-primary mb-3" aria-hidden />
                <h3 className="font-semibold text-lg text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground flex-1">{item.description}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Button asChild variant="outline" className="btn-outline-hero">
            <Link to="/how-it-works">See how it works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
