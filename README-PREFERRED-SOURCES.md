# SkyrScout — Google Preferred Sources

Implementation date: 2026-10-01

## Purpose

SkyrScout includes Google's official Preferred Sources control on public, indexable pages. A reader can use it to select `skyrscout.github.io` as a preferred source in Google Search.

Google states that selected preferred sources are more likely to appear for that user in Top Stories and can receive a preferred-source badge in supported AI Mode / AI Overview experiences. The feature itself does not guarantee ranking, indexing or inclusion.

Official documentation:
`https://developers.google.com/search/docs/appearance/preferred-sources`

## Current implementation

Google's standard JavaScript implementation is used. This is the implementation recommended by Google because it keeps the user in the Google Preferred Sources flow and returns them to the page afterwards.

Library loaded on public/indexable pages:

```html
<script async src="https://news.google.com/swg/js/v1/publisher.js"></script>
```

Rendered control:

```html
<div google-add-preferred-source-btn data-theme="dark"></div>
```

The button is allowed to localize itself from the reader's browser settings. The dark Google theme is used to fit the existing SkyrScout navigation/header.

A `noscript` fallback links directly to Google's source preferences tool for `skyrscout.github.io`.

## Files

- `_layouts/default.html` — loads Google's Preferred Sources library.
- `_includes/site-header.html` — renders the Preferred Sources strip below the public navigation.
- `assets/css/style.css` — layout and responsive styling for the strip.
- `README-PREFERRED-SOURCES.md` — this implementation/recovery note.

## Visibility rule

The Preferred Sources library and UI are excluded when the current page has a `robots` value containing `noindex`. This keeps the control off private/experimental surfaces such as the current noindex Game/Lab pages while showing it on ordinary public pages and collection pages.

This is independent of the sitemap setup and does not modify `robots.txt`, `sitemap.xml` or `sitemap-skyrscout.xml`.

## Backend / security impact

None.

- No VPS changes.
- No Firebase changes.
- No Apps Script changes.
- No API key or secret.
- No new database or stored user data.
- No change to Search Console or sitemap submission.

The browser loads Google's public Preferred Sources JavaScript only on indexable public pages.

## Verification after deployment

1. Open a normal public SkyrScout page in a fresh browser tab.
2. Confirm the Preferred Sources strip appears below the navigation.
3. Use the Google button and confirm the Google Preferred Sources flow opens for SkyrScout.
4. Confirm the flow can return to the SkyrScout page.
5. Check desktop and mobile layout.
6. Check a page with `robots: "noindex, nofollow"`; the Preferred Sources strip must not appear there.

Important: Google's documentation says the site must appear in its source preferences tool to be selectable. The website button does not itself make a site eligible. If Google does not offer SkyrScout in the selection flow, leave the implementation unchanged and investigate eligibility separately rather than changing the site's sitemap or URL structure.

## Rollback

Rollback is limited to the three website files listed above. Removing the script block from `_layouts/default.html`, the Preferred Sources strip from `_includes/site-header.html`, and the related CSS from `assets/css/style.css` fully removes the feature. No backend cleanup is required.
