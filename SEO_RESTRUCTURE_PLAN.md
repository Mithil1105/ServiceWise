# ServiceWise SEO Restructure Plan

**Domain:** https://servicewise.unimisk.com  
**Goal:** Improve crawlability and indexing of public pages; prevent indexing of login, dashboard, and private app pages.

---

## 1. Route audit

All routes are defined in `src/App.tsx`. Categories and indexing rules:

### Route list and categorization

| Route | Category | Indexable | In sitemap |
|-------|----------|-----------|------------|
| `/` | PUBLIC SEO | Yes | Yes |
| `/features` | PUBLIC SEO | Yes | Yes |
| `/how-it-works` | PUBLIC SEO | Yes | Yes |
| `/security` | PUBLIC SEO | Yes | Yes |
| `/pricing` | PUBLIC SEO | Yes | Yes |
| `/contact` | PUBLIC SEO | Yes | Yes |
| `/product` | Marketing (noindex) | No | No |
| `/roles` | Marketing (noindex) | No | No |
| `/auth` | AUTH | No | No |
| `/onboarding` | AUTH/utility | No | No |
| `/verify-email` | AUTH/utility | No | No |
| `/admin` | PRIVATE APP | No | No |
| `/admin/organizations` | PRIVATE APP | No | No |
| `/admin/organizations/:id` | PRIVATE APP | No | No |
| `/app` | PRIVATE APP | No | No |
| `/app/*` (all app routes) | PRIVATE APP | No | No |
| `*` (404 NotFound) | UTILITY | No | No |

\* To make `/product` and `/roles` indexable later: add them to `PUBLIC_SEO_PATHS` in `src/lib/marketing-seo.ts`, add URLs to `public/sitemap.xml`, and remove their Disallow from `public/robots.txt`.

---

## 2. Routes that get noindex

These routes set `<meta name="robots" content="noindex, nofollow">` (via `setNoIndexMeta()` or `SEOHead(..., robots: 'noindex,nofollow')`):

- `/auth`
- `/onboarding`
- `/verify-email`
- `/admin` and all `/admin/*`
- `/app` and all `/app/*`
- Any 404 (NotFound)
- `/product`, `/roles` (via `updateDocumentMeta` else branch when visited under MarketingLayout)

---

## 3. Routes included in sitemap

`public/sitemap.xml` includes **only** these public SEO URLs:

- https://servicewise.unimisk.com/
- https://servicewise.unimisk.com/features
- https://servicewise.unimisk.com/how-it-works
- https://servicewise.unimisk.com/security
- https://servicewise.unimisk.com/pricing
- https://servicewise.unimisk.com/contact

Excluded from sitemap: `/auth`, `/signup`, `/dashboard`, `/profile`, `/settings`, `/admin`, `/admin/*`, `/reset-password`, `/auth/*`, `/onboarding`, `/verify-email`, `/product`, `/roles`.

---

## 4. Recommended new public routes (optional, for later)

To expand SEO coverage, consider adding:

- `/about` — About us / company page
- `/faq` — FAQ page
- `/solutions/fleet-management`
- `/solutions/employee-transport`
- `/solutions/school-transport`
- `/solutions/driver-management`
- `/solutions/route-planning`

For each new page: add route in `App.tsx`, add to `PUBLIC_SEO_PATHS` and `PUBLIC_SEO` in `src/lib/marketing-seo.ts`, add URL to `public/sitemap.xml`, add link in navbar/footer. Each page should have unique title, meta description, canonical, H1, 300+ words content, and CTA.

---

## 5. Implementation summary

- **Files modified:**
  - `SEO_RESTRUCTURE_PLAN.md` (created) — route audit, categories, noindex/sitemap notes, recommended new routes.
  - `src/pages/NotFound.tsx` — added `setNoIndexMeta('Page not found')` in `useEffect` so 404s are not indexed.
  - `src/lib/marketing-seo.ts` — added `SEOHeadOptions`, `SEOHead()` helper (title, description, canonical, robots); refactored `setNoIndexMeta()` to use `SEOHead()`.
  - `public/robots.txt` — simplified to a single `User-agent: *` block; kept Allow for public paths and Disallow for app/auth/admin/onboarding/verify-email/product/roles; Sitemap unchanged.
  - `src/components/sections/HeroSection.tsx` — added nav with links to Features, How it works, Pricing, Security, Contact for homepage crawlability.
  - `docs/SEARCH_CONSOLE_CHECKLIST.md` (created) — submit sitemap, inspect URL, request indexing, wait, monitor.

- **Routes with noindex:** `/auth`, `/onboarding`, `/verify-email`, `/admin` and all `/admin/*`, `/app` and all `/app/*`, any 404 (NotFound), and `/product`, `/roles` (via `updateDocumentMeta` else branch in MarketingLayout).

- **Routes in sitemap:** `/`, `/features`, `/how-it-works`, `/security`, `/pricing`, `/contact` only (see `public/sitemap.xml`). No change to sitemap contents; it already contained only these six public URLs.

- **New SEO utilities:** `SEOHead(options: SEOHeadOptions)` and `SEOHeadOptions` in `src/lib/marketing-seo.ts` (title, description?, canonical?, robots). `setNoIndexMeta(titleSuffix?)` now calls `SEOHead()` for backward compatibility.

- **Manual steps:** Submit `sitemap.xml` in Google Search Console (and optionally Bing Webmaster Tools); use URL Inspection to request indexing for the homepage and key public URLs; wait for recrawl; monitor Indexing → Pages. See `docs/SEARCH_CONSOLE_CHECKLIST.md` for the full checklist.
