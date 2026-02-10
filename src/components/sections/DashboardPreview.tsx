import { MockDashboard } from '@/components/mock-ui/MockDashboard';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export function DashboardPreview() {
  return (
    <section className="section-padding bg-background" aria-labelledby="dashboard-preview-heading">
      <div className="section-container">
        <h2 id="dashboard-preview-heading" className="text-2xl md:text-3xl font-bold text-center mb-4 text-foreground">
          Dashboard that tells you what matters
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Open your day with numbers that count and tasks that need attention.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
          <div className="order-2 lg:order-1 text-center lg:text-left">
            <ul className="space-y-3 mb-6 inline-block text-left max-w-md mx-auto lg:mx-0">
              {[
                'See active bookings, revenue, and pending bills at a glance',
                'Attention list shows overdue items and urgent alerts',
                'Track driver activity and vehicle status in real-time',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-0.5 rounded-full bg-primary/20 p-0.5 shrink-0">
                    <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-center lg:justify-start">
              <Button asChild variant="outline" className="btn-outline-hero">
                <Link to="/features">Explore dashboard</Link>
              </Button>
            </div>
          </div>
          <div className="order-1 lg:order-2 flex justify-center w-full min-w-0">
            <div className="w-full max-w-lg min-w-0 mx-auto animate-fade-in-up">
              <MockDashboard className="w-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
