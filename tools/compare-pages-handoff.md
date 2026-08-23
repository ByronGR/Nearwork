# Nearwork compare pages — handoff

## What this is
Seven static pages for the marketing site: a comparison hub plus six "Nearwork vs <competitor>" pages, built on the existing site nav, footer and `service-page.css`.

## Files to add
Copy to the site root (same folder as index.html / service-page.css):

- compare.html                     -> /compare
- nearwork-vs-bairesdev.html       -> /nearwork-vs-bairesdev
- nearwork-vs-turing.html          -> /nearwork-vs-turing
- nearwork-vs-revelo.html          -> /nearwork-vs-revelo
- nearwork-vs-toptal.html          -> /nearwork-vs-toptal
- nearwork-vs-tecla.html           -> /nearwork-vs-tecla
- nearwork-vs-hirelatam.html       -> /nearwork-vs-hirelatam
- compare.css                      -> /compare.css   (new stylesheet, loaded after service-page.css)

`build_compare_pages.py` is the generator used to produce the six vs pages from one data table. Optional — keep it in the repo if you want to regenerate them; it is not deployed.

## Dependencies
- `/service-page.css` (existing, unchanged) and `/compare.css` (new). Every page links both, in that order.
- Poppins from Google Fonts, same link tag as the rest of the site.
- Nav and footer markup is copied verbatim from the live root-level pages (cost-calculator.html), with root-absolute hrefs.
- Competitor logos load from `https://www.google.com/s2/favicons?domain=<competitor>&sz=64` and remove themselves if the request fails. Swap for local files in /logos/ if you prefer no third-party request.

## Still to wire up on the site side
1. Add the routes to vercel.json (clean URLs, same pattern as the other root pages).
2. Add the seven URLs to sitemap.xml.
3. Footer link: the Company column now includes "Pricing comparison" -> /compare.html. Apply the same line to the rest of the site's footers so it matches everywhere.
4. Nav: no change required. If you want compare surfaced in the Pricing dropdown, add a dd-item pointing to /compare.html.
5. Analytics/consent: these pages do NOT include the GTM, Cookiebot, PostHog or Intercom snippets. Add the standard head/body blocks used by the other pages before publishing.

## SEO notes
- Each page has canonical, OG/Twitter tags, FAQPage + BreadcrumbList JSON-LD, and one H1.
- FAQ answers sit inside <details> elements — content is still in the DOM and indexable.
- All competitor figures are the providers' own published numbers; where a provider does not publish pricing, the page says so instead of estimating. Do not replace those with guesses.
