import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Menu, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/security', label: 'Security' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
];

export function ServiceWiseNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const isLoggedIn = !!user;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground" aria-label="ServiceWise home">
            <img src="/SWlogo.png" alt="" className="h-8 w-auto object-contain" aria-hidden />
            <span>ServiceWise</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 whitespace-nowrap',
                  location.pathname === to
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/contact">Get Started Free</Link>
            </Button>
            {isLoggedIn ? (
              <Button size="sm" className="btn-glow" asChild>
                <Link to="/app">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            ) : (
              <Button size="sm" className="btn-glow" asChild>
                <Link to="/auth">Login</Link>
              </Button>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            {isLoggedIn ? (
              <Button size="sm" className="btn-glow" asChild>
                <Link to="/app">Dashboard</Link>
              </Button>
            ) : (
              <Button size="sm" className="btn-glow" asChild>
                <Link to="/auth">Login</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[280px] sm:w-[320px]">
          <Link to="/" onClick={() => setMobileOpen(false)} className="inline-flex items-center gap-2 pt-2 pb-4" aria-label="ServiceWise home">
            <img src="/SWlogo.png" alt="" className="h-8 w-auto object-contain" aria-hidden />
            <span className="font-semibold">ServiceWise</span>
          </Link>
          <div className="flex flex-col gap-4 pt-2 animate-fade-in">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'text-base font-medium py-2 px-3 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  location.pathname === to ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                )}
              >
                {label}
              </Link>
            ))}
            <div className="border-t pt-4 mt-2 flex flex-col gap-2">
              <Button variant="outline" className="w-full" asChild>
                <Link to="/contact" onClick={() => setMobileOpen(false)}>
                  Get Started Free
                </Link>
              </Button>
              {isLoggedIn ? (
                <Button className="w-full btn-glow" asChild>
                  <Link to="/app" onClick={() => setMobileOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <Button className="w-full btn-glow" asChild>
                  <Link to="/auth" onClick={() => setMobileOpen(false)}>
                    Login
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
