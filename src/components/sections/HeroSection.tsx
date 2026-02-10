import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section
      className="section-padding animate-fade-in"
      style={{ background: 'var(--gradient-hero)' }}
      aria-label="Hero"
    >
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground tracking-tight">
            Fleet operations. Booking-to-cash. <span className="gradient-text">In one system.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Run your travel fleet from one screen — cars, bookings, drivers, payments, and service reminders.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="btn-accent px-8">
              <Link to="/contact">Request Demo</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="btn-outline-hero px-8">
              <Link to="/features">Explore Features</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
