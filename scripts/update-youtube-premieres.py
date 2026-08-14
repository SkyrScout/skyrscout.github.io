#!/usr/bin/env python3
"""
Generate assets/data/youtube-premieres.json from every YouTube link in _players/.

Design goals:
- No manual premiere fields in player profiles.
- Check both the featured `youtube` video and `additional_videos`.
- Preserve the relation between an upcoming video and its player profile so
  cards can advertise an upcoming additional video without changing the
  profile's featured/main video.
- Only write the JSON after every YouTube API batch succeeds.
- Keep the previous good file untouched on API/network/configuration failure.
- Do not rewrite the file when the actual premiere data has not changed.
"""

from __future__ import annotations

import datetime as dt
import html
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
PLAYERS_DIR = ROOT / "_players"
OUTPUT = ROOT / "assets" / "data" / "youtube-premieres.json"
API_URL = "https://www.googleapis.com/youtube/v3/videos"
BATCH_SIZE = 50
REQUEST_TIMEOUT = 20
MAX_ATTEMPTS = 4


YOUTUBE_LINE_RE = re.compile(
    r'(?m)^([ \t]*)(-\s+)?youtube:\s*'
    r'(?:(?:"([^"]+)")|(?:\'([^\']+)\')|([^\s#]+))\s*$'
)


def warning(message: str) -> None:
    print(f"::warning::{message}")


def extract_front_matter(text: str) -> str:
    if not text.startswith("---"):
        return ""

    parts = text.split("---", 2)
    if len(parts) < 3:
        return ""

    return parts[1]


def extract_profile_youtube_urls(front_matter: str) -> list[tuple[str, str]]:
    """Return profile YouTube URLs as (kind, url), preserving file order."""
    videos: list[tuple[str, str]] = []
    main_seen = False

    for match in YOUTUBE_LINE_RE.finditer(front_matter):
        indent, bullet = match.group(1), match.group(2)
        url = html.unescape(
            next(group for group in match.groups()[2:] if group is not None)
        )

        # The featured/main field is the unindented, non-list `youtube:` key.
        # Any indented/list occurrence belongs to additional_videos.
        is_main = not main_seen and indent == "" and bullet is None
        kind = "main" if is_main else "additional"

        if is_main:
            main_seen = True

        videos.append((kind, url))

    return videos


def extract_video_id(url: str) -> str:
    if not url:
        return ""

    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")

    if host in {"youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [""])[0]
        if parsed.path.startswith("/embed/"):
            return parsed.path.split("/embed/", 1)[1].split("/", 1)[0]

    if host == "youtu.be":
        return parsed.path.strip("/").split("/", 1)[0]

    match = re.search(r"(?:v=|youtu\.be/|embed/)([A-Za-z0-9_-]{6,})", url)
    return match.group(1) if match else ""


def collect_player_videos() -> dict[str, list[dict[str, str]]]:
    """Map each YouTube ID to every player-profile relation that uses it."""
    sources: dict[str, list[dict[str, str]]] = {}

    for path in sorted(PLAYERS_DIR.glob("*.md")):
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            warning(f"Could not read {path.name}: {exc}")
            continue

        front_matter = extract_front_matter(text)
        profile_videos = extract_profile_youtube_urls(front_matter)
        if not profile_videos:
            continue

        parsed: list[tuple[str, str]] = []
        for kind, url in profile_videos:
            video_id = extract_video_id(url)
            if video_id:
                parsed.append((kind, video_id))

        if not parsed:
            continue

        main_video_id = next(
            (video_id for kind, video_id in parsed if kind == "main"),
            "",
        )
        if not main_video_id:
            warning(
                f"{path.name} has YouTube links but no valid featured/main video. "
                "Skipping its premiere relations."
            )
            continue

        seen_in_profile: set[str] = set()
        for kind, video_id in parsed:
            if video_id in seen_in_profile:
                continue
            seen_in_profile.add(video_id)

            relation = {
                "player_slug": path.stem,
                "kind": kind,
                "main_video_id": main_video_id,
            }
            sources.setdefault(video_id, []).append(relation)

    for relations in sources.values():
        relations.sort(
            key=lambda item: (
                item["player_slug"],
                item["kind"],
                item["main_video_id"],
            )
        )

    return dict(sorted(sources.items()))


def request_json(url: str) -> dict:
    last_error: Exception | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            request = Request(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "SkyrScout-Premiere-Updater/2.0",
                },
            )

            with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")

                return json.load(response)

        except (HTTPError, URLError, TimeoutError, OSError, ValueError, RuntimeError) as exc:
            last_error = exc

            if attempt < MAX_ATTEMPTS:
                delay = 3 * (2 ** (attempt - 1))
                print(
                    f"YouTube API attempt {attempt}/{MAX_ATTEMPTS} failed: "
                    f"{exc}. Retrying in {delay}s..."
                )
                time.sleep(delay)

    raise RuntimeError(
        f"YouTube API failed after {MAX_ATTEMPTS} attempts: {last_error}"
    )


def fetch_upcoming(
    video_sources: dict[str, list[dict[str, str]]],
    api_key: str,
) -> dict[str, dict]:
    upcoming: dict[str, dict] = {}
    video_ids = list(video_sources)

    for start in range(0, len(video_ids), BATCH_SIZE):
        batch = video_ids[start : start + BATCH_SIZE]

        params = {
            "part": "snippet,liveStreamingDetails",
            "id": ",".join(batch),
            "key": api_key,
            "fields": (
                "items(id,"
                "snippet/title,"
                "snippet/liveBroadcastContent,"
                "liveStreamingDetails/scheduledStartTime)"
            ),
        }

        payload = request_json(f"{API_URL}?{urlencode(params)}")

        items = payload.get("items")
        if not isinstance(items, list):
            raise RuntimeError("YouTube API returned an invalid items payload.")

        for item in items:
            if not isinstance(item, dict):
                continue

            snippet = item.get("snippet") or {}
            live = item.get("liveStreamingDetails") or {}

            if snippet.get("liveBroadcastContent") != "upcoming":
                continue

            scheduled_start = live.get("scheduledStartTime")
            video_id = item.get("id")

            if not video_id or not scheduled_start:
                continue

            # Validate timestamp before publishing it to the website.
            try:
                dt.datetime.fromisoformat(
                    scheduled_start.replace("Z", "+00:00")
                )
            except ValueError:
                continue

            upcoming[video_id] = {
                "status": "upcoming",
                "scheduled_start": scheduled_start,
                "title": snippet.get("title") or "",
                "profiles": video_sources.get(video_id, []),
            }

    return dict(sorted(upcoming.items()))


def read_existing_videos() -> dict[str, dict] | None:
    if not OUTPUT.exists():
        return None

    try:
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None

    videos = payload.get("videos")
    return videos if isinstance(videos, dict) else None


def atomic_write(upcoming: dict[str, dict]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "_meta": {
            "status": "ok",
            "updated_utc": dt.datetime.now(dt.timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z"),
            "source": "YouTube Data API",
        },
        "videos": upcoming,
    }

    temp = OUTPUT.with_suffix(".json.tmp")
    temp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temp.replace(OUTPUT)


def main() -> int:
    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()

    if not api_key:
        warning(
            "YOUTUBE_API_KEY is not configured. "
            "Keeping the previous premiere status file unchanged."
        )
        return 0

    video_sources = collect_player_videos()

    if not video_sources:
        warning(
            "No player YouTube video IDs were found. "
            "Keeping the previous premiere status file unchanged."
        )
        return 0

    relation_count = sum(len(relations) for relations in video_sources.values())
    additional_count = sum(
        1
        for relations in video_sources.values()
        for relation in relations
        if relation["kind"] == "additional"
    )

    print(
        f"Checking {len(video_sources)} unique player videos "
        f"({relation_count} profile relation(s), "
        f"{additional_count} additional video(s)) in YouTube Data API."
    )

    try:
        upcoming = fetch_upcoming(video_sources, api_key)
    except Exception as exc:
        warning(
            f"Premiere update aborted safely: {exc}. "
            "The previous good status file is unchanged."
        )
        return 0

    existing = read_existing_videos()

    if existing == upcoming:
        print(
            f"No premiere-status change. "
            f"{len(upcoming)} upcoming video(s) remain."
        )
        return 0

    atomic_write(upcoming)
    print(
        f"Premiere status updated successfully: "
        f"{len(upcoming)} upcoming video(s)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
