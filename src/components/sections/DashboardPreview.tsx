import { MockDashboard } from '@/components/mock-ui/MockDashboard';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function DashboardPreview() {
  return (
    <section className="section-padding bg-background" aria-labelledby="dashboard-preview-heading">
      <div className="section-container">
        <h2 id="dashboard-preview-heading" className="text-2xl md:text-3xl font-bold text-center mb-4 text-foreground">
          Your dashboard
        </h2>
        <p className="text-muted-foreground text-center mb-10 max-w-2xl mx-auto">
          KPIs, weekly chart, and attention list — everything you need at a glance.
        </p>
        <div className="max-w-md mx-auto animate-fade-in-up p-6 sm:p-8 bg-slate-50 rounded-3xl">
          <MockDashboard />
        </div>
      </div>
    </section>
  );
}
