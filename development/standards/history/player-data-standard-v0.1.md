# SkyrScout Player Data Standard v0.1 — draft

Goal: keep the player profile human-readable while giving Game structured facts it can safely consume.

## Core rule

**Missing information = no effect.**

The Game must never infer or invent a value just because a field is absent.

Examples:
- no `height_cm` → no height effect
- no structured trait → no trait effect
- no YouTube metric → no Momentum/Buzz effect from that metric
- no real scouting summary → no summary-derived Game effect

## Existing fields kept

Existing profile fields such as these remain useful and should not be removed just to satisfy Game:

```yaml
layout: player
title: "Player Name (2003) – Club | League"
youtube: "https://..."
report_by: "Scout Pilgrim"
report_date: "06.12.2024"
site_added: "23.07.2026"
position: "Right Back"
summary: |
  ...
report: |
  ...
```

`position` remains the reader-facing/backwards-compatible display value during migration.

## Structured fields to standardise

```yaml
nationalities:
  - Sweden
  - Somalia

birth_date: "2003-09-24"
height_cm: 201

positions:
  - role: "Attacking Midfielder"
    side: "centre"
    rank: 1
  - role: "Centre-Forward"
    side: "centre"
    rank: 2
  - role: "Right Winger"
    side: "right"
    rank: 3

preferred_foot: "Right"
```

Only include a field when the information is actually known.

## Position spelling

Use normal football names consistently for the reader-facing `position` field:

- `Right Back`
- `Left Back`
- `Right Winger`
- `Left Winger`
- `Centre-Back`
- `Centre-Forward`
- `Central Midfielder`
- `Attacking Midfielder`
- `Defensive Midfielder`

The Game parser should remain tolerant of legacy forms such as `Right-Back`, but new/cleaned profiles should use the standard spelling.

## Traits

Do not automatically convert every adjective in a scouting report into Game data.

When we later introduce structured traits, use a controlled vocabulary and only tag traits genuinely supported by the scouting material, for example:

```yaml
game_traits:
  - vision
  - ball-striking
  - dribbling
```

An empty or absent `game_traits` list means no trait effect.

## Shorts

Do **not** store a fixed list of Shorts in the player file.

The relationship remains one-to-many through each Short's `player_slug`. The Game discovers all matching Shorts, so publishing a new Short can add a new signature ability without editing the player profile.

## YouTube

YouTube performance should remain generated/stored separately from the player profile. The profile identifies the relevant videos; generated snapshot data supplies views, recent views, likes, watch-time metrics when available.

Missing YouTube values stay `null`/missing and produce no effect.
