import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape

RSS_URL = "https://anchor.fm/s/ff9626c0/podcast/rss"

SPOTIFY_SHOW_ID = "7kQc1nObXtDTjJxy7oUpdZ"
SPOTIFY_EMBED_URL = (
    f"https://open.spotify.com/embed/show/{SPOTIFY_SHOW_ID}"
)

OUTPUT_FILE = "assets/data/podcast-episodes.json"

ITUNES_NAMESPACE = "http://www.itunes.com/dtds/podcast-1.0.dtd"
CONTENT_NAMESPACE = "http://purl.org/rss/1.0/modules/content/"


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


def fetch_url(url: str, user_agent: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept-Language": "en",
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def fetch_spotify_embed_source() -> str:
    try:
        data = fetch_url(
            SPOTIFY_EMBED_URL,
            (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/150.0 Safari/537.36"
            ),
        )

        return unescape(
            data.decode("utf-8", errors="replace")
        )

    except Exception as error:
        print(
            "Warning: Could not fetch Spotify embed page. "
            f"RSS links will be used instead. Error: {error}"
        )

        return ""


def find_spotify_episode_url(
    spotify_source: str,
    episode_title: str,
) -> str:
    if not spotify_source or not episode_title:
        return ""

    # Spotify's embed source contains JSON-encoded episode data.
    # Try the title both as normal text and as JSON-escaped text.
    title_variants = {
        episode_title,
        json.dumps(
            episode_title,
            ensure_ascii=False,
        )[1:-1],
        json.dumps(
            episode_title,
            ensure_ascii=True,
        )[1:-1],
    }

    for title_variant in title_variants:
        search_start = 0

        while True:
            title_position = spotify_source.find(
                title_variant,
                search_start,
            )

            if title_position == -1:
                break

            # The Spotify episode URI appears immediately after the
            # episode metadata in the embed source.
            search_window = spotify_source[
                title_position:title_position + 2500
            ]

            episode_id_match = re.search(
                r"spotify:episode:([A-Za-z0-9]+)",
                search_window,
            )

            if episode_id_match:
                episode_id = episode_id_match.group(1)

                return (
                    "https://open.spotify.com/episode/"
                    f"{episode_id}"
                )

            search_start = (
                title_position + len(title_variant)
            )

    return ""


def main() -> None:
    rss_data = fetch_url(
        RSS_URL,
        "SkyrScout-Podcast-Updater/1.0",
    )

    root = ET.fromstring(rss_data)
    channel = root.find("channel")

    if channel is None:
        raise RuntimeError(
            "Could not find the RSS channel."
        )

    channel_image = find_text(
        channel,
        f"{{{ITUNES_NAMESPACE}}}image",
    )

    spotify_source = fetch_spotify_embed_source()

    episodes = []
    spotify_links_found = 0

    for item in channel.findall("item"):
        enclosure = item.find("enclosure")
        image = item.find(
            f"{{{ITUNES_NAMESPACE}}}image"
        )

        audio_url = ""
        image_url = ""

        if enclosure is not None:
            audio_url = enclosure.attrib.get(
                "url",
                "",
            )

        if image is not None:
            image_url = image.attrib.get(
                "href",
                "",
            )

        description = find_text(
            item,
            f"{{{CONTENT_NAMESPACE}}}encoded",
        )

        if not description:
            description = find_text(
                item,
                "description",
            )

        title = find_text(item, "title")
        rss_link = find_text(item, "link")

        spotify_link = find_spotify_episode_url(
            spotify_source,
            title,
        )

        if spotify_link:
            spotify_links_found += 1

        episode = {
            "title": title,
            "description": description,
            "published": parse_date(
                find_text(item, "pubDate")
            ),

            # Public Spotify episode URL when available.
            # Falls back to the original RSS link.
            "link": spotify_link or rss_link,

            # Keep the original RSS-provided link as well.
            "rss_link": rss_link,

            "guid": find_text(item, "guid"),
            "audio_url": audio_url,
            "image": image_url or channel_image,

            "duration": find_text(
                item,
                f"{{{ITUNES_NAMESPACE}}}duration",
            ),

            "episode_number": find_text(
                item,
                f"{{{ITUNES_NAMESPACE}}}episode",
            ),

            "season_number": find_text(
                item,
                f"{{{ITUNES_NAMESPACE}}}season",
            ),

            "episode_type": find_text(
                item,
                f"{{{ITUNES_NAMESPACE}}}episodeType",
            ),
        }

        episodes.append(episode)

    output = {
        "updated": datetime.now(
            timezone.utc
        ).isoformat(),
        "episodes": episodes,
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
        f"Saved {len(episodes)} episodes "
        f"to {OUTPUT_FILE}"
    )

    print(
        f"Found {spotify_links_found} "
        "public Spotify episode links."
    )


if __name__ == "__main__":
    main()
