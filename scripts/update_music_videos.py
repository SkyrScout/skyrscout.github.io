import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape

CHANNEL_ID = "UCuKJAZQLRdFdLCiVWUj_xHA"
FEED_URL = (
    "https://www.youtube.com/feeds/videos.xml"
    f"?channel_id={CHANNEL_ID}"
)
OUTPUT_FILE = "assets/data/music-videos.json"

ATOM_NAMESPACE = "http://www.w3.org/2005/Atom"
YOUTUBE_NAMESPACE = "http://www.youtube.com/xml/schemas/2015"
MEDIA_NAMESPACE = "http://search.yahoo.com/mrss/"


def clean_text(value: str | None) -> str:
    if not value:
        return ""

    return unescape(value).strip()


def find_text(element: ET.Element, tag: str) -> str:
    child = element.find(tag)

    if child is None or child.text is None:
        return ""

    return clean_text(child.text)


def main() -> None:
    request = urllib.request.Request(
        FEED_URL,
        headers={
            "User-Agent": "SkyrScout-Music-Updater/1.0"
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        feed_data = response.read()

    root = ET.fromstring(feed_data)
    videos = []

    for entry in root.findall(
        f"{{{ATOM_NAMESPACE}}}entry"
    ):
        video_id = find_text(
            entry,
            f"{{{YOUTUBE_NAMESPACE}}}videoId",
        )

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

        video_url = (
            f"https://www.youtube.com/watch?v={video_id}"
            if video_id
            else ""
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
                "url": video_url,
                "embed_url": (
                    f"https://www.youtube.com/embed/{video_id}"
                    if video_id
                    else ""
                ),
            }
        )

    output = {
        "channel": {
            "name": "404 Bon Blondes",
            "channel_id": CHANNEL_ID,
            "url": "https://www.youtube.com/@404BonBlondes",
        },
        "updated": datetime.now(timezone.utc).isoformat(),
        "videos": videos,
    }

    os.makedirs(
        os.path.dirname(OUTPUT_FILE),
        exist_ok=True,
    )

    with open(
        OUTPUT_FILE,
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

    print(
        f"Saved {len(videos)} music videos "
        f"to {OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()
