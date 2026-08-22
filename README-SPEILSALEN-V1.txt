Scoutland Yard - Speilsalen / navigation skeleton v1
2026-08-23

UPLOAD THESE PATHS EXACTLY TO THE REPOSITORY ROOT:

NEW:
  speilsalen/index.html
  assets/css/speilsalen.css
  assets/images/scoutland-yard-speilsalen.webp

REPLACE CURRENT FILES:
  assets/js/staff-firebase-config.js
  assets/js/control-room-auth.js
  foyer/index.html

WHAT THIS DOES:
- creates the real protected /speilsalen/ route
- adds /speilsalen/ to the existing Staff roomRoots allowlist
- adds Speilsalen as the third actual room link in Foyer
- makes Library and Speilsalen clickable in the current Control Room sidebar
- adds one Foyer return link below Speilsalen in the Control Room sidebar
- Speilsalen itself links to Foyer, Library and Control Room
- uses the existing staff-room-auth.js for access checking and sign-out
- does not modify the large control-room/index.html file
- does not modify Control Room data collection/rendering

BACKGROUND:
The supplied Christmas Speilsalen source was used only as architectural source material.
The deployed background in this package contains no person, Christmas trees, table setting,
red ornaments or other Christmas decoration.
