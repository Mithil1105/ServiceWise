import { Link } from 'react-router-dom';

const productLinks = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/pricing', label: 'Pricing' },
];

const companyLinks = [
  { to: '/security', label: 'Security' },
  { to: '/contact', label: 'Contact' },
  { to: '/how-it-works', label: 'Documentation' },
];

export function ServiceWiseFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-8">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 font-semibold text-foreground" aria-label="ServiceWise home">
              <img src="/SWlogo.png" alt="" className="h-8 w-auto object-contain" aria-hidden />
              <span>ServiceWise</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-md">
              Fleet and operations management made simple. Track bookings, automate approvals, and control your fleet.
            </p>
          </div>
          <div className="flex flex-wrap gap-12">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Product</h3>
              <ul className="space-y-2">
                {productLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Company</h3>
              <ul className="space-y-2">
                {companyLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            © {year} ServiceWise by Unimisk. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
