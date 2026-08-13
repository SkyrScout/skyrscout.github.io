import json
import os
import re
import socket
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path

RSS_URL = "https://anchor.fm/s/ff9626c0/podcast/rss"

SPOTIFY_SHOW_ID = "7kQc1nObXtDTjJxy7oUpdZ"
SPOTIFY_EMBED_URL = (
    f"https://open.spotify.com/embed/show/{SPOTIFY_SHOW_ID}"
)

OUTPUT_FILE = Path("assets/data/podcast-episodes.json")

ITUNES_NAMESPACE = "http://www.itunes.com/dtds/podcast-1.0.dtd"
CONTENT_NAMESPACE = "http://purl.org/rss/1.0/modules/content/"

FETCH_ATTEMPTS = 4
FETCH_TIMEOUT_SECONDS = 20
RETRY_DELAYS_SECONDS = (3, 6, 12)


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


def fetch_url_with_retries(
    url: str,
    user_agent: str,
    label: str,
) -> bytes | None:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept-Language": "en",
            "Cache-Control": "no-cache",
        },
    )

    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            print(
                f"Fetching {label}, attempt "
                f"{attempt}/{FETCH_ATTEMPTS}..."
            )

            with urllib.request.urlopen(
                request,
                timeout=FETCH_TIMEOUT_SECONDS,
            ) as response:
                data = response.read()

            if not data.strip():
                raise ValueError(
                    f"{label} returned an empty response."
                )

            return data

        except (
            urllib.error.HTTPError,
            urllib.error.URLError,
            socket.timeout,
            TimeoutError,
            ValueError,
        ) as error:
            print(
                f"{label} attempt {attempt} failed: "
                f"{type(error).__name__}: {error}"
            )

            if attempt < FETCH_ATTEMPTS:
                delay_index = min(
                    attempt - 1,
                    len(RETRY_DELAYS_SECONDS) - 1,
                )
                delay = RETRY_DELAYS_SECONDS[delay_index]
                print(
                    f"Waiting {delay} seconds before retry..."
                )
                time.sleep(delay)

    return None


def fetch_spotify_embed_source() -> str:
    data = fetch_url_with_retries(
        SPOTIFY_EMBED_URL,
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/150.0 Safari/537.36"
        ),
        "Spotify embed page",
    )

    if data is None:
        print(
            "::warning::Could not fetch the Spotify embed page "
            "after repeated attempts. Existing Spotify episode "
            "links will be preserved where possible."
        )
        return ""

    return unescape(
        data.decode("utf-8", errors="replace")
    )


def find_spotify_episode_url(
    spotify_source: str,
    episode_title: str,
) -> str:
    if not spotify_source or not episode_title:
        return ""

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
            f"Existing podcast data could not be read cleanly: "
            f"{error}. A valid RSS response may replace it."
        )

    return None


def existing_episode_maps(
    existing_output: dict | None,
) -> tuple[dict[str, dict], dict[str, dict]]:
    by_guid = {}
    by_title = {}

    if not existing_output:
        return by_guid, by_title

    episodes = existing_output.get("episodes")

    if not isinstance(episodes, list):
        return by_guid, by_title

    for episode in episodes:
        if not isinstance(episode, dict):
            continue

        guid = episode.get("guid")
        title = episode.get("title")

        if guid:
            by_guid[guid] = episode

        if title:
            by_title[title] = episode

    return by_guid, by_title


def preserved_spotify_link(
    existing_episode: dict | None,
) -> str:
    if not existing_episode:
        return ""

    link = existing_episode.get("link", "")

    if (
        isinstance(link, str)
        and link.startswith(
            "https://open.spotify.com/episode/"
        )
    ):
        return link

    return ""


def parse_rss(
    rss_data: bytes,
    spotify_source: str,
    existing_output: dict | None,
) -> list[dict] | None:
    try:
        root = ET.fromstring(rss_data)
    except ET.ParseError as error:
        print(
            "::warning::Podcast RSS returned invalid XML. "
            "The existing podcast data will be preserved "
            f"unchanged. Parse error: {error}"
        )
        return None

    channel = root.find("channel")

    if channel is None:
        print(
            "::warning::Podcast RSS did not contain a channel. "
            "The existing podcast data will be preserved "
            "unchanged."
        )
        return None

    channel_image = ""
    channel_image_element = channel.find(
        f"{{{ITUNES_NAMESPACE}}}image"
    )

    if channel_image_element is not None:
        channel_image = clean_text(
            channel_image_element.attrib.get(
                "href",
                "",
            )
        )

    existing_by_guid, existing_by_title = (
        existing_episode_maps(existing_output)
    )

    episodes = []
    spotify_links_found = 0
    spotify_links_preserved = 0

    for item in channel.findall("item"):
        enclosure = item.find("enclosure")
        image = item.find(
            f"{{{ITUNES_NAMESPACE}}}image"
        )

        audio_url = ""
        image_url = ""

        if enclosure is not None:
            audio_url = clean_text(
                enclosure.attrib.get(
                    "url",
                    "",
                )
            )

        if image is not None:
            image_url = clean_text(
                image.attrib.get(
                    "href",
                    "",
                )
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
        guid = find_text(item, "guid")

        existing_episode = (
            existing_by_guid.get(guid)
            or existing_by_title.get(title)
        )

        spotify_link = find_spotify_episode_url(
            spotify_source,
            title,
        )

        if spotify_link:
            spotify_links_found += 1
        else:
            spotify_link = preserved_spotify_link(
                existing_episode
            )

            if spotify_link:
                spotify_links_preserved += 1

        episode = {
            "title": title,
            "description": description,
            "published": parse_date(
                find_text(item, "pubDate")
            ),
            "link": spotify_link or rss_link,
            "rss_link": rss_link,
            "guid": guid,
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

    if not episodes:
        print(
            "::warning::Podcast RSS contained no usable "
            "episodes. The existing podcast data will be "
            "preserved unchanged."
        )
        return None

    existing_episodes = []

    if existing_output:
        candidate = existing_output.get("episodes")

        if isinstance(candidate, list):
            existing_episodes = candidate

    if (
        existing_episodes
        and len(episodes) < len(existing_episodes)
    ):
        print(
            "::warning::Podcast RSS returned fewer episodes "
            f"than the existing data ({len(episodes)} vs "
            f"{len(existing_episodes)}). To avoid accidental "
            "data loss, the existing podcast data will be "
            "preserved unchanged."
        )
        return None

    print(
        f"Parsed {len(episodes)} podcast episodes."
    )
    print(
        f"Found {spotify_links_found} fresh Spotify links "
        f"and preserved {spotify_links_preserved} existing "
        "Spotify links."
    )

    return episodes


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
    existing_output = load_existing_output()

    rss_data = fetch_url_with_retries(
        RSS_URL,
        "SkyrScout-Podcast-Updater/1.1",
        "podcast RSS feed",
    )

    if rss_data is None:
        print(
            "::warning::Could not fetch the podcast RSS feed "
            "after repeated attempts. The existing podcast "
            "data will be preserved unchanged."
        )
        return

    spotify_source = fetch_spotify_embed_source()

    episodes = parse_rss(
        rss_data,
        spotify_source,
        existing_output,
    )

    if episodes is None:
        return

    if (
        existing_output is not None
        and existing_output.get("episodes") == episodes
    ):
        print(
            f"No podcast changes found. "
            f"Keeping {OUTPUT_FILE} unchanged."
        )
        return

    output = {
        "updated": datetime.now(
            timezone.utc
        ).isoformat(),
        "episodes": episodes,
    }

    write_output_atomically(output)

    print(
        f"Saved {len(episodes)} episodes "
        f"to {OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()
