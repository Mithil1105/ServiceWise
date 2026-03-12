# Google Search Console – Post-SEO Checklist

Use this checklist after deploying the SEO restructure (noindex for auth/app, sitemap and robots.txt cleanup, public page hardening).

**Domain:** https://servicewise.unimisk.com  
**Sitemap URL:** https://servicewise.unimisk.com/sitemap.xml

For detailed submission steps (verification, Bing, etc.), see [SEO_AND_SITEMAP_GUIDE.md](../SEO_AND_SITEMAP_GUIDE.md) in the repo root.

---

## 1. Submit the sitemap

1. Open [Google Search Console](https://search.google.com/search-console).
2. Select the property for `https://servicewise.unimisk.com` (or add it and verify ownership).
3. Go to **Indexing** → **Sitemaps**.
4. Under **Add a new sitemap**, enter: `sitemap.xml`
5. Click **Submit**.
6. Wait for status to show “Success” (can take a few hours to days). If it shows “Couldn’t fetch”, check that the site is live and the URL is accessible.

---

## 2. Inspect the homepage

1. In Search Console, go to **URL Inspection** (under “Indexing” or from the top search bar).
2. Enter: `https://servicewise.unimisk.com/`
3. Click **Test live URL** (or **Request indexing** if the URL is not yet indexed).
4. Confirm the page loads and that the fetched HTML looks correct (title, meta description, no unexpected redirects).

---

## 3. Request indexing for key public URLs

After the sitemap is submitted, use **URL Inspection** to request indexing for important public pages if they are “Discovered – currently not indexed” or not yet indexed:

- `https://servicewise.unimisk.com/`
- `https://servicewise.unimisk.com/features`
- `https://servicewise.unimisk.com/pricing`
- `https://servicewise.unimisk.com/contact`
- `https://servicewise.unimisk.com/how-it-works`
- `https://servicewise.unimisk.com/security`

For each URL: open URL Inspection → paste URL → **Request indexing**. Do not overuse; a few key URLs are enough.

---

## 4. Wait for recrawl

- Google will recrawl the sitemap and requested URLs. This usually takes from a few days to a few weeks.
- Recheck **Indexing** → **Pages** (and **Coverage** if available) periodically to see how many URLs are “Indexed” vs “Discovered – currently not indexed”.

---

## 5. Monitor the indexing report

1. In Search Console, go to **Indexing** → **Pages** (or **Coverage**).
2. Watch for:
   - **Indexed:** Public pages (/, /features, /pricing, etc.) should move to “Indexed” over time.
   - **Discovered – currently not indexed:** If this stays high for important public URLs, consider:
     - Ensuring each public page has strong, unique content (H1, 300+ words, clear sections).
     - Checking that robots.txt and meta robots do not block those URLs.
     - Requesting indexing again after a few weeks.
3. Confirm that login, dashboard, and app URLs are **not** being indexed (they use `noindex, nofollow` and are excluded from the sitemap).

---

## Quick reference

| Step | Action |
|------|--------|
| 1 | Submit `sitemap.xml` in Google Search Console → Sitemaps |
| 2 | URL Inspection → `https://servicewise.unimisk.com/` → Test / Request indexing |
| 3 | Optionally request indexing for /features, /pricing, /contact, etc. |
| 4 | Wait for recrawl (days to a few weeks) |
| 5 | Monitor Indexing → Pages and fix any remaining “Discovered – currently not indexed” issues |
