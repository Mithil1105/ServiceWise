/**
 * Per-route title and meta description for marketing pages.
 * Used for SEO and generative engine optimization (GEO).
 */
const BASE_URL = 'https://servicewise.unimisk.com';

export const MARKETING_SEO: Record<
  string,
  { title: string; description: string }
> = {
  '/': {
    title: 'ServiceWise – Fleet & Booking Management for Travel Operators',
    description:
      'Run your travel fleet from one screen — cars, bookings, drivers, payments, and service reminders. Stops double booking. Fair billing. Request a demo.',
  },
  '/product': {
    title: 'Product Overview | ServiceWise',
    description:
      'ServiceWise helps travel companies manage cars, trips, bills, and service reminders — without messy Excel and WhatsApp chaos. See modules and day-one walkthrough.',
  },
  '/features': {
    title: 'Features | ServiceWise',
    description:
      'Bookings that don’t clash, bills in minutes, advance & cash tracking, cars and drivers, service reminders. Everything for daily fleet operations.',
  },
  '/roles': {
    title: 'Roles & Permissions | ServiceWise',
    description:
      'Owner, Manager, and Supervisor roles. Control who sees bookings, billing, fleet, and settings. Supervisors see only assigned cars.',
  },
  '/how-it-works': {
    title: 'How It Works | ServiceWise',
    description:
      'From inquiry to paid: inquiry → booking → assign → trip → bill → payment. See the flow and what you’ll see in the app.',
  },
  '/security': {
    title: 'Security | ServiceWise',
    description:
      'Secure fleet and booking management. Data protection, access control, and safe deployment for travel operators.',
  },
  '/pricing': {
    title: 'Pricing | ServiceWise',
    description:
      'Pricing depends on fleet size and modules. Request a tailored quote for your travel or fleet business.',
  },
  '/contact': {
    title: 'Contact Us | ServiceWise',
    description:
      'Request a demo tailored to your fleet size. Tell us about your fleet and we’ll show a demo that matches your work.',
  },
};

export function getMarketingMeta(pathname: string) {
  const normalized = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
  return MARKETING_SEO[normalized] ?? MARKETING_SEO['/'];
}

export function updateDocumentMeta(pathname: string) {
  const meta = getMarketingMeta(pathname);
  document.title = meta.title;

  let descEl = document.querySelector('meta[name="description"]');
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.setAttribute('name', 'description');
    document.head.appendChild(descEl);
  }
  descEl.setAttribute('content', meta.description);

  let canonical = document.querySelector('link[rel="canonical"]');
  const href = pathname === '/' ? BASE_URL + '/' : BASE_URL + pathname;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
}
