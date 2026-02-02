import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const footerLinks = [
  { to: '/product', label: 'Product' },
  { to: '/features', label: 'Features' },
  { to: '/roles', label: 'Roles' },
  { to: '/how-it-works', label: 'How it Works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="container max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/" className="inline-block" aria-label="ServiceWise home">
              <img src="/SWlogo.png" alt="ServiceWise" className="h-8 w-auto object-contain" />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Fleet operations. Booking-to-cash. In one system.
            </p>
            <p className="mt-2 text-xs text-muted-foreground max-w-sm">
              Manage cars, bookings, drivers, bills, and service reminders — all in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            {footerLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-8 border-t">
          <p className="text-xs text-muted-foreground">
            © {year} ServiceWise. All rights reserved.
          </p>
          <Button size="sm" asChild>
            <Link to="/contact">Request Demo</Link>
          </Button>
        </div>
      </div>
    </footer>
  );
}
