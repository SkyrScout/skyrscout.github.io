# Hese-Fredrik MVP

This is the first simple backend + public widget for Scoutland Yard.

## What this version does

- Polls every public upload on the SkyrScout YouTube channel every 5 minutes.
- Uses the same public YouTube `viewCount` data we tested.
- Stores a short rolling history server-side.
- Reads/writes the rolling history in bulk, rather than doing hundreds of individual Script Property operations per poll.
- Detects fast increases.
- Exposes only the current alarm state publicly.
- Keeps the API key server-side.
- Shows **nothing** on the public website unless a threshold is actually met.
- Uses real YouTube data only. No demo numbers.

## Starter public thresholds

They are at the top of `Code.gs`:

```js
ALERT_RULES: [
  { minutes: 15, minViews: 50 },
  { minutes: 60, minViews: 100 }
]
```

These are starter values, not sacred numbers. The backend is built so we can change them later without changing the widget.

## 1. Create the backend in Google Apps Script

1. Open Google Apps Script and create a new project, for example `SkyrScout Hese-Fredrik`.
2. Replace `Code.gs` with the supplied `Code.gs`.
3. Open **Project Settings** and add a Script Property:
   - Name: `YOUTUBE_API_KEY`
   - Value: the existing **SkyrScout YouTube** API key.
4. Save.
5. Run `installHeseFredrik()` once from the editor.
6. Approve the permissions Apps Script asks for.
7. Run `logStatus()` if you want to inspect the first real poll in the execution log.

`installHeseFredrik()` automatically:
- discovers the SkyrScout channel from the Ladefoged video,
- discovers the channel uploads playlist,
- loads all public uploads,
- takes the first real snapshot,
- installs the 5-minute trigger.

The 15/60-minute movement fields need enough history before they can be calculated.

## 2. Check the backend before touching the website

Deploy the Apps Script project as a **Web app**:

- Execute as: **Me**
- Who has access: **Anyone**

Copy the deployed `/exec` URL.

Open:

```text
YOUR_EXEC_URL?mode=debug
```

That gives real backend status and the top current movers. It does **not** expose the API key.

The normal public endpoint:

```text
YOUR_EXEC_URL
```

returns `active: false` until Hese-Fredrik actually fires.

## 3. Connect the public widget

Open:

```text
_includes/hese-fredrik.html
```

Find:

```js
const HESE_FREDRIK_ENDPOINT = "PASTE_APPS_SCRIPT_EXEC_URL_HERE";
```

Paste the `/exec` URL there.

The supplied `index.html` already contains:

```liquid
{% include hese-fredrik.html %}
```

directly under the existing `LATEST UPDATES` ticker.

Upload only the changed/new site files:
- `index.html`
- `_includes/hese-fredrik.html`

## Public behaviour

If no alarm is active, the widget is completely hidden.

If a rule fires, the homepage shows:

**🚨 HESE-FREDRIK GÅR!**

plus:
- the actual video title,
- the actual YouTube thumbnail,
- the measured increase,
- the measured time window,
- a link to the matching SkyrScout player/Short page when one exists,
- otherwise a direct YouTube link.

## Useful backend URL

The debug endpoint is intentionally based only on public YouTube-derived data:

```text
YOUR_EXEC_URL?mode=debug
```

That is already a primitive first data feed for the future private Scoutland Yard Control Center.

## One possible snag

If the existing API key has a browser/referrer **application restriction**, server-side Apps Script requests can be rejected even though the key itself is correct. The key should remain restricted to **YouTube Data API v3**. If the first Apps Script run returns a 403, inspect the key's application restriction rather than creating another key.
