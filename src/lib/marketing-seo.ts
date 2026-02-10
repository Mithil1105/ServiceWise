/**
 * SEO and Generative Engine Optimization (GEO) for public marketing pages only.
 * Used by Google, Bing, DuckDuckGo, and AI/LLM crawlers.
 * Only these paths get full meta; all other routes get noindex.
 */
const BASE_URL = 'https://servicewise.unimisk.com';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

/** Only these paths are indexed and get full SEO/GEO meta. */
export const PUBLIC_SEO_PATHS = [
  '/',
  '/features',
  '/how-it-works',
  '/security',
  '/pricing',
  '/contact',
] as const;

export type PublicSeoPath = (typeof PUBLIC_SEO_PATHS)[number];

export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  /** Short summary for generative engines / AI snippets */
  summary?: string;
  /** Keywords for legacy crawlers */
  keywords?: string;
}

const PUBLIC_SEO: Record<PublicSeoPath, PageSeo> = {
  '/': {
    title: 'ServiceWise – Fleet & Booking Management for Travel Operators',
    description:
      'Run your travel fleet from one screen — cars, bookings, drivers, payments, and service reminders. Stops double booking. Fair billing. Request a demo.',
    canonical: BASE_URL + '/',
    ogTitle: 'ServiceWise – Fleet & Booking Management for Travel Operators',
    ogDescription:
      'Manage cars, bookings, drivers, bills, and service reminders in one system. Stops double booking. Fair billing. Request a demo.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: 'ServiceWise – Fleet & Booking Management for Travel Operators',
    twitterDescription:
      'Manage cars, bookings, drivers, bills, and service reminders in one system. Stops double booking. Fair billing. Request a demo.',
    summary:
      'ServiceWise is fleet and booking management software for travel operators. One system for cars, bookings, drivers, payments, and service reminders. Prevents double booking, fair billing, advance tracking. Request a demo.',
    keywords:
      'fleet management, travel operator, booking management, vehicle management, driver management, billing for fleet, service reminders, double booking prevention, fleet software India',
  },
  '/features': {
    title: 'Features | ServiceWise',
    description:
      'Bookings that don’t clash, bills in minutes, advance & cash tracking, cars and drivers, service reminders. Everything for daily fleet operations.',
    canonical: BASE_URL + '/features',
    ogTitle: 'Features | ServiceWise – Fleet & Booking Management',
    ogDescription:
      'Dashboard, calendar, bills, and money flow. Bookings that don’t clash, bills in minutes, advance tracking. Everything for daily fleet operations.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Features | ServiceWise',
    twitterDescription:
      'Bookings that don’t clash, bills in minutes, advance & cash tracking, cars and drivers, service reminders.',
    summary:
      'ServiceWise features: dashboard at a glance, booking calendar, bills that write themselves, money flow tracking. Built for how travel and fleet operators actually work.',
    keywords: 'fleet software features, booking calendar, fleet billing, advance tracking, service reminders',
  },
  '/how-it-works': {
    title: 'How It Works | ServiceWise',
    description:
      'From inquiry to paid: inquiry → booking → assign → trip → bill → payment. See the flow and what you’ll see in the app.',
    canonical: BASE_URL + '/how-it-works',
    ogTitle: 'How It Works | ServiceWise',
    ogDescription:
      'From first inquiry to final payment, every step in one flow. Inquiry, booking, assign, trip, bill, payment.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: 'How It Works | ServiceWise',
    twitterDescription: 'From inquiry to paid: one clear flow. See what you’ll see in the app.',
    summary:
      'ServiceWise workflow: receive inquiry, create booking, assign resources, trip begins and completes, generate bill, receive payment, mark paid. One flow from first inquiry to final payment.',
    keywords: 'fleet workflow, booking to cash, inquiry to paid, fleet operations flow',
  },
  '/security': {
    title: 'Security | ServiceWise',
    description:
      'Secure fleet and booking management. Data protection, access control, and safe deployment for travel operators.',
    canonical: BASE_URL + '/security',
    ogTitle: 'Security | ServiceWise',
    ogDescription:
      'Secure fleet and booking management. Data protection, access control, and safe deployment for travel operators.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Security | ServiceWise',
    twitterDescription: 'Data protection, access control, and safe deployment for fleet and travel operators.',
    summary:
      'ServiceWise security: data protection, access control, secure deployment. Built for travel and fleet operators who need reliable, safe software.',
    keywords: 'fleet software security, data protection, access control, secure fleet management',
  },
  '/pricing': {
    title: 'Pricing | ServiceWise',
    description:
      'Pricing depends on fleet size and modules. Request a tailored quote for your travel or fleet business.',
    canonical: BASE_URL + '/pricing',
    ogTitle: 'Pricing | ServiceWise',
    ogDescription:
      'Pricing depends on fleet size and modules. Request a tailored quote for your travel or fleet business.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Pricing | ServiceWise',
    twitterDescription: 'Request a tailored quote for your fleet size and modules.',
    summary:
      'ServiceWise pricing is based on fleet size and modules. Request a demo for a tailored quote for your travel or fleet business.',
    keywords: 'fleet software pricing, travel operator software cost, fleet management quote',
  },
  '/contact': {
    title: 'Contact Us | ServiceWise',
    description:
      'Request a demo tailored to your fleet size. Tell us about your fleet and we’ll show a demo that matches your work.',
    canonical: BASE_URL + '/contact',
    ogTitle: 'Contact Us | ServiceWise',
    ogDescription:
      'Request a demo tailored to your fleet size. Tell us about your fleet and we’ll show a demo that matches your work.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Contact Us | ServiceWise',
    twitterDescription: 'Request a demo tailored to your fleet. We’ll show you ServiceWise with your workflows.',
    summary:
      'Contact ServiceWise to request a demo. Tailored to your fleet size and workflows. For travel operators and fleet managers.',
    keywords: 'contact ServiceWise, fleet software demo, request demo',
  },
};

function normalizePath(pathname: string): string {
  return pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
}

export function isPublicSeoPath(pathname: string): pathname is PublicSeoPath {
  const p = normalizePath(pathname);
  return (PUBLIC_SEO_PATHS as readonly string[]).includes(p);
}

export function getPublicSeo(pathname: string): PageSeo | null {
  const p = normalizePath(pathname);
  if (!isPublicSeoPath(p)) return null;
  return PUBLIC_SEO[p];
}

/** For backwards compatibility where a fallback is needed. */
export function getMarketingMeta(pathname: string): { title: string; description: string } {
  const seo = getPublicSeo(pathname);
  if (seo) return { title: seo.title, description: seo.description };
  return {
    title: 'ServiceWise',
    description: 'Fleet and booking management for travel operators.',
  };
}

function setMetaTag(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLinkRel(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Apply full SEO and GEO meta for public marketing pages only.
 * For non-public paths (e.g. /product, /roles), sets noindex and minimal title.
 */
export function updateDocumentMeta(pathname: string) {
  const seo = getPublicSeo(pathname);

  if (seo) {
    document.title = seo.title;
    setMetaTag('description', seo.description);
    setLinkRel('canonical', seo.canonical);
    setMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMetaTag('googlebot', 'index, follow');
    setMetaTag('bingbot', 'index, follow');

    setMetaTag('og:type', seo.ogType, 'property');
    setMetaTag('og:url', seo.canonical, 'property');
    setMetaTag('og:title', seo.ogTitle, 'property');
    setMetaTag('og:description', seo.ogDescription, 'property');
    setMetaTag('og:image', seo.ogImage, 'property');
    setMetaTag('og:site_name', 'ServiceWise', 'property');
    setMetaTag('og:locale', 'en_IN', 'property');

    setMetaTag('twitter:card', seo.twitterCard);
    setMetaTag('twitter:url', seo.canonical);
    setMetaTag('twitter:title', seo.twitterTitle);
    setMetaTag('twitter:description', seo.twitterDescription);
    setMetaTag('twitter:image', seo.ogImage);

    if (seo.keywords) setMetaTag('keywords', seo.keywords);
    if (seo.summary) setMetaTag('summary', seo.summary);

    // JSON-LD WebPage for generative engines (Google, Bing, DuckDuckGo, AI crawlers)
    setWebPageJsonLd(seo);
  } else {
    document.title = 'ServiceWise';
    setMetaTag('description', 'Fleet and booking management for travel operators.');
    setMetaTag('robots', 'noindex, nofollow');
    setMetaTag('googlebot', 'noindex, nofollow');
    setMetaTag('bingbot', 'noindex, nofollow');
    setLinkRel('canonical', BASE_URL + normalizePath(pathname) || '/');
    removeWebPageJsonLd();
  }
}

const WEBPAGE_JSON_LD_ID = 'servicewise-webpage-ld';

function setWebPageJsonLd(seo: PageSeo) {
  removeWebPageJsonLd();
  const script = document.createElement('script');
  script.id = WEBPAGE_JSON_LD_ID;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seo.title,
    description: seo.description,
    url: seo.canonical,
    ...(seo.summary && { abstract: seo.summary }),
    isPartOf: {
      '@type': 'WebSite',
      name: 'ServiceWise',
      url: BASE_URL,
    },
  });
  document.head.appendChild(script);
}

function removeWebPageJsonLd() {
  document.getElementById(WEBPAGE_JSON_LD_ID)?.remove();
}

/**
 * Call from app layout, auth, admin, etc. so those pages are not indexed.
 */
export function setNoIndexMeta(titleSuffix?: string) {
  document.title = titleSuffix ? `ServiceWise – ${titleSuffix}` : 'ServiceWise';
  setMetaTag('robots', 'noindex, nofollow');
  setMetaTag('googlebot', 'noindex, nofollow');
  setMetaTag('bingbot', 'noindex, nofollow');
}
