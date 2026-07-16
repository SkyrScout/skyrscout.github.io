import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from html import unescape

RSS_URL = "https://anchor.fm/s/ff9626c0/podcast/rss"
OUTPUT_FILE = "assets/data/podcast-episodes.json"

ITUNES_NAMESPACE = "http://www.itunes.com/dtds/podcast-1.0.dtd"


def clean_text(value: str | None) -> str:
    if not value:
        return ""

    return unescape(value).strip()


def parse_date(value: str | None) -> str:
    if not value:
        return ""

    try:
        parsed = parsedate_to_datetime(value)
        return parsed.isoformat()
    except (TypeError, ValueError):
        return value


def find_text(item: ET.Element, tag: str) -> str:
    element = item.find(tag)

    if element is None or element.text is None:
        return ""

    return clean_text(element.text)


def main() -> None:
    request = urllib.request.Request(
        RSS_URL,
        headers={
            "User-Agent": "SkyrScout-Podcast-Updater/1.0"
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        rss_data = response.read()

    root = ET.fromstring(rss_data)
    channel = root.find("channel")

    if channel is None:
        raise RuntimeError("Could not find the RSS channel.")

    episodes = []

    for item in channel.findall("item"):
        enclosure = item.find("enclosure")
        image = item.find(f"{{{ITUNES_NAMESPACE}}}image")

        audio_url = ""
        image_url = ""

        if enclosure is not None:
            audio_url = enclosure.attrib.get("url", "")

        if image is not None:
            image_url = image.attrib.get("href", "")

        episode = {
            "title": find_text(item, "title"),
            "description": find_text(item, "description"),
            "published": parse_date(find_text(item, "pubDate")),
            "link": find_text(item, "link"),
            "guid": find_text(item, "guid"),
            "audio_url": audio_url,
            "image": image_url,
            "duration": find_text(
                item,
                f"{{{ITUNES_NAMESPACE}}}duration",
            ),
        }

        episodes.append(episode)

    output = {
        "updated": datetime.utcnow().isoformat() + "Z",
        "episodes": episodes,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as output_file:
        json.dump(
            output,
            output_file,
            ensure_ascii=False,
            indent=2,
        )

        output_file.write("\n")

    print(f"Saved {len(episodes)} episodes to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
