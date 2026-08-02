# SkyrScout Player Data Standard v0.3 — current draft

Goal: keep the player profile human-readable while giving Game structured facts it can safely consume.

## Core rule

**Missing information = no effect.**

The Game must never infer or invent a value just because a field is absent.

Examples:
- no `height_cm` → no height effect
- no `dominant_foot` → no dominant-foot effect
- no `two_footed_ability` → no two-footed effect
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
dominant_foot: "Right"
two_footed_ability: "Reliable"

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

### Dominant foot

Allowed values:
- `Right`
- `Left`
- `Both`

This field describes the player's genuinely dominant/natural foot, not the quality of the other foot.

Use `Both` only when direct scouting supports that there is no meaningful dominant foot. Being able to finish, pass or cross well with the other foot is not enough by itself.

If the player uses both feet well but the dominant foot is not established, leave `dominant_foot` empty and use `two_footed_ability` instead.

Source priority:
1. explicit SkyrScout scouting observations / report text
2. reliable first-party information (player, club, federation)
3. external databases as supporting evidence

Transfermarkt or similar databases must not automatically override direct scouting evidence. If sources conflict and the correct value is uncertain, leave `dominant_foot` empty until it is resolved.

### Two-footed ability

Allowed values:
- `Reliable`
- `Strong`
- `Genuine`

This field is optional and only records meaningful use of both feet supported by scouting evidence.

- `Reliable` — the other foot is explicitly described as dependable, functional, decent or reliable.
- `Strong` — effective use of both feet is a notable part of the player's game, for example finishing, passing, crossing or shooting.
- `Genuine` — the player is explicitly assessed as genuinely two-footed, with no meaningful weak side in the relevant scouting evidence.

The field does not measure the absolute quality of the dominant foot. A player can have an exceptional dominant foot and still have `Reliable` or `Strong` two-footed ability.

Exceptional foot qualities such as an elite left foot, set-piece delivery or unusual shot power remain scouting information and may later become separate structured traits.
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

Each Short keeps one canonical primary player in `player_slug`. This is the original/main owner of the Short.

When another scouted player performs an equally Signature-worthy action in the same clip, add the optional list `co_signature_player_slugs`:

```yaml
player_slug: "eduards-daskevics"
co_signature_player_slugs:
  - "josue-vergara"
```

Both players then receive a gold **Signature Short** card on their profiles. `player_slug` remains the canonical primary field so existing links and sorting remain stable.

When another scouted player has a meaningful positive involvement but is not an equal star of the Short, use `secondary_player_slugs`:

```yaml
player_slug: "sean-rea"
secondary_player_slugs:
  - "tiago-coimbra"
```

The primary player receives a gold **Signature Short** card, while the secondary player receives a silver **Featured In** card. These links do not automatically define a Game bonus or synergy; those effects must be designed separately in the Game data.

## YouTube

YouTube performance remains generated/stored separately from the player profile. The profile identifies the relevant videos; generated snapshot data supplies views, recent views, likes and watch-time metrics when available.

Missing YouTube values stay `null`/missing and produce no effect.
