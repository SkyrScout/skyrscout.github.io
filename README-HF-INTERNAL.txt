Hese-Fredrik internal Control Room alert fix

Changed files:
- backend-apps-script/Code.gs
- assets/js/control-room-data.js

Behavior:
- Public siren remains strict: +50/15m or +100/60m.
- Private Control Room warning is more sensitive: +12/15m or +30/60m.
- Debug payload now includes internalRules and internalAlerts.
- Control Room uses internalAlerts for amber highlighting/status.

IMPORTANT:
Code.gs is Apps Script backend code. Upload/copy it into the existing Apps Script project and deploy a NEW web-app version. Updating GitHub alone does not update the deployed Apps Script endpoint.
