Hese-Fredrik / Control Room hybrid alert update

Changed files:
- backend-apps-script/Code.gs
- assets/js/control-room-data.js
- assets/css/control-room.css

INTERNAL detection model:
- Absolute: +12 / 15 min OR +30 / 60 min.
- Relative: +5 / 15 min AND >= 3.0x previous comparable 15-minute window.
- Relative: +10 / 60 min AND >= 2.5x previous comparable 60-minute window.
- If the previous comparable window was 0, the relative minimum alone qualifies.
- Public Hese-Fredrik remains unchanged: +50 / 15 min OR +100 / 60 min.

Control Room UX:
- Persistent bottom-left status remains green/live, amber/alert, red/offline.
- A NEW internal alert opens a non-modal amber overlay at the upper-right on desktop.
- Overlay shows thumbnail, video title, movement, previous comparable window and relative pace where available.
- ACK / X hides the overlay for the same alert signature for 45 minutes.
- The underlying dashboard remains fully usable.
- On mobile the same alert becomes a bottom-sheet style overlay.

IMPORTANT DEPLOYMENT:
1. Copy backend-apps-script/Code.gs into the existing Apps Script project.
2. Deploy a NEW web-app version so the existing /exec endpoint serves the new debug payload.
3. Upload assets/js/control-room-data.js and assets/css/control-room.css to the same repo paths.

No new secret is required for this update. It uses the existing YOUTUBE_API_KEY Script Property.
