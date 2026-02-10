# SEO Improvement & Sitemap Submission Guide

## 1. Where to Submit Your Sitemap

Submit your sitemap in **two** places so Google, Bing, DuckDuckGo (Bing index), and others can discover and index your pages faster.

| Service | URL | What it does |
|--------|-----|----------------|
| **Google Search Console** | https://search.google.com/search-console | Google indexing, queries, coverage |
| **Bing Webmaster Tools** | https://www.bing.com/webmasters | Bing + DuckDuckGo (Bing powers DDG) |

Your sitemap URL (use this when submitting):

```
https://servicewise.unimisk.com/sitemap.xml
```

---

## 2. How to Submit the Sitemap

### Google Search Console

1. Go to **https://search.google.com/search-console**
2. Sign in with the Google account that should “own” the site.
3. **Add a property** (if the site isn’t added yet):
   - Click **Add property**
   - Choose **URL prefix** and enter: `https://servicewise.unimisk.com`
   - Prove ownership using one of:
     - **HTML file upload** (upload the file they give you to your site’s root or `public/`)
     - **HTML meta tag** (add the tag they give you in `index.html` `<head>`)
     - **Google Analytics** or **Google Tag Manager** if already on the site
     - **DNS** (add a TXT record they provide)
4. After verification, open the property.
5. In the left menu go to **Sitemaps** (under “Indexing”).
6. Under **Add a new sitemap**, enter: `sitemap.xml`
7. Click **Submit**.
8. Status will show “Success” or “Couldn’t fetch” until Google processes it (can take a few hours to days).

### Bing Webmaster Tools

1. Go to **https://www.bing.com/webmasters**
2. Sign in with a Microsoft account.
3. **Add a site** (if not added yet):
   - Click **Add a site**
   - Enter: `https://servicewise.unimisk.com`
   - Prove ownership (options similar to Google: XML file, meta tag, or DNS).
4. After verification, select the site.
5. Go to **Sitemaps** in the left menu.
6. Under **Submit a sitemap**, enter: `https://servicewise.unimisk.com/sitemap.xml`
7. Click **Submit**.
8. Bing will show status; indexing can take a few days.

---

## 3. How to Improve SEO Further

You already have in place:

- Unique title and description for each public page (Home, Features, How It Works, Security, Pricing, Contact)
- Canonical URLs, Open Graph, Twitter Card
- `robots.txt` and sitemap with only public pages
- Noindex for app, auth, admin, onboarding, verify-email
- JSON-LD (WebPage) for generative engines

**Next steps to improve rankings:**

| Priority | Action | Why it helps |
|----------|--------|----------------|
| 1 | **Submit sitemap** in Google Search Console and Bing Webmaster Tools | Faster discovery and indexing of your 6 public pages. |
| 2 | **Add a blog or “Resources” section** | More pages with keywords like “fleet management”, “car management software”, “travel operator software” = more chances to rank for those terms. |
| 3 | **Use clear headings (H1, H2)** on each public page | One H1 per page (e.g. “Fleet & Booking Management for Travel Operators”), H2s for sections. Helps both users and search engines. |
| 4 | **Internal links** | Link between your public pages (e.g. Home → Features → Pricing → Contact). Helps crawlers and distributes “weight” across pages. |
| 5 | **Page speed** | Use Lighthouse (Chrome DevTools) and fix big issues (images, JS). Fast sites tend to rank better. |
| 6 | **Backlinks** | Get other sites (partners, directories, press) to link to `https://servicewise.unimisk.com`. Start with: industry directories, “fleet software” or “travel tech” lists, partner pages. |
| 7 | **Structured content** | Add an FAQ section on key pages (or a dedicated FAQ page) and use FAQ schema if you add JSON-LD for FAQs (optional; can do later). |

**Quick wins:**

- In **Google Search Console**, after sitemap is submitted: use **URL Inspection** to “Request indexing” for your most important URL (e.g. `https://servicewise.unimisk.com/`).
- In **Bing Webmaster Tools**: use **URL Submission** (if available) to submit the homepage and maybe `/features` and `/pricing` for faster crawling.

---

## 4. Sitemap Location (for reference)

- **Live URL:** `https://servicewise.unimisk.com/sitemap.xml`
- **In repo:** `public/sitemap.xml`

The sitemap lists only the 6 public pages. After you change those URLs or add new public pages, update `public/sitemap.xml` and optionally resubmit the sitemap in Search Console and Bing (they will re-crawl it periodically).

---

## 5. Checklist

- [ ] Add and verify site in **Google Search Console**
- [ ] Submit `sitemap.xml` in Google Search Console
- [ ] Add and verify site in **Bing Webmaster Tools**
- [ ] Submit `https://servicewise.unimisk.com/sitemap.xml` in Bing Webmaster Tools
- [ ] (Optional) Request indexing for homepage in Google URL Inspection
- [ ] (Optional) Add more content (blog/Resources) and internal links for long-term SEO
