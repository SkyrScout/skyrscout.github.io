import json
import os
import socket
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

CHANNEL_ID = "UCuKJAZQLRdFdLCiVwUj_xHA"
FEED_URL = (
    "https://www.youtube.com/feeds/videos.xml"
    f"?channel_id={CHANNEL_ID}"
)
OUTPUT_FILE = Path("assets/data/music-videos.json")

ATOM_NAMESPACE = "http://www.w3.org/2005/Atom"
YOUTUBE_NAMESPACE = "http://www.youtube.com/xml/schemas/2015"
MEDIA_NAMESPACE = "http://search.yahoo.com/mrss/"

FETCH_ATTEMPTS = 4
FETCH_TIMEOUT_SECONDS = 20
RETRY_DELAYS_SECONDS = (3, 6, 12)


def clean_text(value: str | None) -> str:
    if not value:
        return ""

    return unescape(value).strip()


def find_text(element: ET.Element, tag: str) -> str:
    child = element.find(tag)

    if child is None or child.text is None:
        return ""

    return clean_text(child.text)


def fetch_feed() -> bytes | None:
    request = urllib.request.Request(
        FEED_URL,
        headers={
            "User-Agent": "SkyrScout-Music-Updater/1.1",
            "Accept": "application/atom+xml, application/xml, text/xml",
            "Cache-Control": "no-cache",
        },
    )

    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            print(
                f"Fetching YouTube feed, attempt "
                f"{attempt}/{FETCH_ATTEMPTS}..."
            )

            with urllib.request.urlopen(
                request,
                timeout=FETCH_TIMEOUT_SECONDS,
            ) as response:
                feed_data = response.read()

            if not feed_data.strip():
                raise ValueError("YouTube returned an empty feed.")

            return feed_data

        except (
            urllib.error.HTTPError,
            urllib.error.URLError,
            socket.timeout,
            TimeoutError,
            ValueError,
        ) as error:
            print(
                f"Feed attempt {attempt} failed: "
                f"{type(error).__name__}: {error}"
            )

            if attempt < FETCH_ATTEMPTS:
                delay_index = min(
                    attempt - 1,
                    len(RETRY_DELAYS_SECONDS) - 1,
                )
                delay = RETRY_DELAYS_SECONDS[delay_index]
                print(f"Waiting {delay} seconds before retry...")
                time.sleep(delay)

    print(
        "::warning::Could not fetch the YouTube music feed "
        "after repeated attempts. The existing music data "
        "will be preserved unchanged."
    )
    return None


def parse_videos(feed_data: bytes) -> list[dict] | None:
    try:
        root = ET.fromstring(feed_data)
    except ET.ParseError as error:
        print(
            "::warning::YouTube returned invalid XML. "
            "The existing music data will be preserved unchanged. "
            f"Parse error: {error}"
        )
        return None

    videos = []

    for entry in root.findall(
        f"{{{ATOM_NAMESPACE}}}entry"
    ):
        video_id = find_text(
            entry,
            f"{{{YOUTUBE_NAMESPACE}}}videoId",
        )

        if not video_id:
            continue

        media_group = entry.find(
            f"{{{MEDIA_NAMESPACE}}}group"
        )

        description = ""
        thumbnail_url = ""

        if media_group is not None:
            description = find_text(
                media_group,
                f"{{{MEDIA_NAMESPACE}}}description",
            )

            thumbnail = media_group.find(
                f"{{{MEDIA_NAMESPACE}}}thumbnail"
            )

            if thumbnail is not None:
                thumbnail_url = thumbnail.attrib.get(
                    "url",
                    "",
                )

        videos.append(
            {
                "video_id": video_id,
                "title": find_text(
                    entry,
                    f"{{{ATOM_NAMESPACE}}}title",
                ),
                "published": find_text(
                    entry,
                    f"{{{ATOM_NAMESPACE}}}published",
                ),
                "updated": find_text(
                    entry,
                    f"{{{ATOM_NAMESPACE}}}updated",
                ),
                "description": description,
                "thumbnail": thumbnail_url,
                "url": (
                    f"https://www.youtube.com/watch?v={video_id}"
                ),
                "embed_url": (
                    f"https://www.youtube.com/embed/{video_id}"
                ),
            }
        )

    if not videos:
        print(
            "::warning::The YouTube feed contained no usable "
            "video entries. The existing music data will be "
            "preserved unchanged."
        )
        return None

    return videos


def load_existing_output() -> dict | None:
    if not OUTPUT_FILE.exists():
        return None

    try:
        with OUTPUT_FILE.open(
            "r",
            encoding="utf-8",
        ) as input_file:
            data = json.load(input_file)

        if isinstance(data, dict):
            return data

    except (OSError, json.JSONDecodeError) as error:
        print(
            f"Existing music data could not be read cleanly: "
            f"{error}. A valid feed response may replace it."
        )

    return None


def write_output_atomically(output: dict) -> None:
    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary_file = OUTPUT_FILE.with_suffix(
        OUTPUT_FILE.suffix + ".tmp"
    )

    with temporary_file.open(
        "w",
        encoding="utf-8",
    ) as output_file:
        json.dump(
            output,
            output_file,
            ensure_ascii=False,
            indent=2,
        )
        output_file.write("\n")
        output_file.flush()
        os.fsync(output_file.fileno())

    os.replace(
        temporary_file,
        OUTPUT_FILE,
    )


def main() -> None:
    feed_data = fetch_feed()

    if feed_data is None:
        return

    videos = parse_videos(feed_data)

    if videos is None:
        return

    existing_output = load_existing_output()

    if (
        existing_output is not None
        and existing_output.get("videos") == videos
    ):
        print(
            f"No music-video changes found. "
            f"Keeping {OUTPUT_FILE} unchanged."
        )
        return

    output = {
        "channel": {
            "name": "404 Bon Blondes",
            "channel_id": CHANNEL_ID,
            "url": "https://www.youtube.com/@404BonBlondes",
        },
        "updated": datetime.now(
            timezone.utc
        ).isoformat(),
        "videos": videos,
    }

    write_output_atomically(output)

    print(
        f"Saved {len(videos)} music videos "
        f"to {OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()
