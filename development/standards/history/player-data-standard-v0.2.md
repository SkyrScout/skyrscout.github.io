# SkyrScout Player Data Standard v0.2 — current draft

Goal: keep the player profile human-readable while giving Game structured facts it can safely consume.

## Core rule

**Missing information = no effect.**

The Game must never infer or invent a value just because a field is absent.

Examples:
- no `height_cm` → no height effect
- no `preferred_foot` → no foot-related effect
- no structured trait → no trait effect
- no YouTube metric → no Momentum/Buzz effect from that metric
- no real scouting summary → no summary-derived Game effect

## Existing fields kept

Existing profile fields remain useful and should not be removed merely to satisfy Game:

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

## Structured fields

```yaml
nationalities:
  - Sweden
  - Somalia

birth_date: "2003-09-24"
height_cm: 201
preferred_foot: "Right"

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
```

Only use a value when the information is actually known. Empty/missing values must not be treated as zero or as a negative attribute.

### Date of birth

Use `birth_date` only when the exact date is known, in ISO format `YYYY-MM-DD`.

The site calculates:
- current age from `birth_date`
- Age at report from `birth_date` + `report_date`

A birth year alone is not enough to generate either age.

### Height

Use centimetres as an integer in `height_cm`.

When reliable evidence shows two measurements for a young player who has grown, use the newer/higher measurement rather than preserving an obviously outdated youth value.

### Preferred foot

Allowed values:
- `Right`
- `Left`
- `Both`

This field is deliberately optional.

Source priority:
1. explicit SkyrScout scouting observations / report text
2. reliable first-party information (player, club, federation)
3. external databases as supporting evidence

Transfermarkt or similar databases must not automatically override direct scouting evidence. If sources conflict and the correct value is uncertain, leave `preferred_foot` empty until it is resolved.

Being able to finish or cross with both feet does **not** automatically mean `preferred_foot: "Both"`. Use `Both` only when the player is genuinely described/known as two-footed.

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

`positions` stores the same information structurally. `rank: 1` means the primary position. `side` may be omitted when it is genuinely unknown or not meaningful.

## Traits

Do not automatically convert every adjective in a scouting report into Game data.

When structured traits are introduced, use a controlled vocabulary and only tag traits genuinely supported by the scouting material, for example:

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

YouTube performance remains generated/stored separately from the player profile. The profile identifies the relevant videos; generated snapshot data supplies views, recent views, likes and watch-time metrics when available.

Missing YouTube values stay `null`/missing and produce no effect.
