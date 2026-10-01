# SkyrScout — Google Preferred Sources

Status updated: 2026-10-01

## Current status

**NOT ACTIVE.**

SkyrScout tested Google's Preferred Sources publisher integration on 2026-10-01. The website implementation itself rendered only the local explanatory strip; Google's Preferred Sources control did not become usable because `skyrscout.github.io` is currently not available in Google's Source Preferences catalogue.

Direct verification in Google's own Source Preferences interface for:

`skyrscout.github.io`

returned:

`No results / Ingen resultater`

Because the site is not currently selectable as a Preferred Source, the public Preferred Sources UI and Google publisher script were rolled back the same day.

## What was tested

The attempted implementation used Google's documented publisher library:

```html
<script async src="https://news.google.com/swg/js/v1/publisher.js"></script>
```

and the standard control:

```html
<div google-add-preferred-source-btn data-theme="dark"></div>
```

The integration was limited to public/indexable pages and did not modify the sitemap, Search Console setup, VPS, Firebase, Apps Script, or any backend data.

## Why it was rolled back

Google's Source Preferences tool does not currently return SkyrScout as a selectable source. Keeping a visible "Make SkyrScout a preferred source" strip on the public site would therefore expose a control with no useful function.

This result must **not** be treated as proof of the cause of SkyrScout's separate Google sitemap/discovery problem. It only establishes that SkyrScout is not currently present in the Preferred Sources catalogue.

## Current production state after rollback

The following website files are restored to their pre-Preferred-Sources state:

- `_layouts/default.html`
- `_includes/site-header.html`
- `assets/css/style.css`

Therefore:

- no Preferred Sources strip is displayed;
- Google's Preferred Sources publisher JavaScript is not loaded by SkyrScout;
- no new backend, data storage, API key, secret, or service exists;
- no VPS, Firebase, Apps Script, Search Console, sitemap or robots configuration was changed for this feature.

This README remains intentionally as project documentation of the attempted feature and rollback.

## Revisit condition

Preferred Sources can be reconsidered later **only after** Google's Source Preferences tool returns `skyrscout.github.io` as a selectable source.

Before re-enabling any website UI:

1. Search for `skyrscout.github.io` in Google's Source Preferences tool.
2. Confirm SkyrScout appears and can actually be selected.
3. Re-check Google's then-current Preferred Sources publisher documentation.
4. Only then reintroduce a public button/control.

Do not change SkyrScout's URL structure, sitemap architecture, hosting, or VPS configuration merely to make this feature available.
