(() => {
    "use strict";

    const STATUS_URL = "/assets/data/youtube-premieres.json";
    const FETCH_TIMEOUT_MS = 4500;

    function extractVideoId(value) {
        if (!value) return "";

        const patterns = [
            /img\.youtube\.com\/vi\/([^/?#]+)/i,
            /youtube\.com\/embed\/([^/?#]+)/i,
            /youtube\.com\/watch\?.*?[?&]v=([^&#]+)/i,
            /youtu\.be\/([^/?#]+)/i
        ];

        for (const pattern of patterns) {
            const match = String(value).match(pattern);
            if (match && match[1]) return match[1];
        }

        return "";
    }

    function getActivePremieres(data) {
        const videos = data && data.videos && typeof data.videos === "object"
            ? data.videos
            : {};

        const now = Date.now();
        const active = new Map();

        for (const [videoId, item] of Object.entries(videos)) {
            if (!item || item.status !== "upcoming" || !item.scheduled_start) {
                continue;
            }

            const start = Date.parse(item.scheduled_start);

            if (!Number.isFinite(start) || now >= start) {
                continue;
            }

            active.set(videoId, {
                ...item,
                start
            });
        }

        return active;
    }

    function formatCardTime(timestamp) {
        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        })
            .format(new Date(timestamp))
            .replace(",", " ·")
            .toUpperCase();
    }

    function formatProfileTime(timestamp) {
        return new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZoneName: "short"
        }).format(new Date(timestamp));
    }

    function makeBadge() {
        const badge = document.createElement("span");
        badge.className = "skyr-premiere-badge";

        const dot = document.createElement("span");
        dot.className = "skyr-premiere-dot";
        dot.setAttribute("aria-hidden", "true");

        const text = document.createElement("span");
        text.textContent = "PREMIERE";

        badge.append(dot, text);
        return badge;
    }

    function makeTimeChip(timestamp) {
        const chip = document.createElement("span");
        chip.className = "skyr-premiere-time";
        chip.textContent = formatCardTime(timestamp);
        return chip;
    }

    function decorateThumbnails(activePremieres) {
        const images = document.querySelectorAll(
            ".yard-report-image img, .player-list-image img"
        );

        images.forEach((image) => {
            const videoId = extractVideoId(image.currentSrc || image.src);
            const premiere = activePremieres.get(videoId);

            if (!premiere) return;

            const media =
                image.closest(".yard-report-image") ||
                image.closest(".player-list-image");

            if (!media || media.dataset.premiereDecorated === "true") {
                return;
            }

            media.dataset.premiereDecorated = "true";
            media.classList.add("skyr-premiere-media");
            media.append(makeBadge(), makeTimeChip(premiere.start));
        });
    }

    function buildProfilePoster(videoId, premiere, iframe) {
        const wrapper = iframe.closest(".video-wrapper");
        if (!wrapper || wrapper.dataset.premiereDecorated === "true") {
            return;
        }

        wrapper.dataset.premiereDecorated = "true";
        wrapper.classList.add("skyr-premiere-active");

        const poster = document.createElement("div");
        poster.className = "skyr-premiere-poster";

        const image = document.createElement("img");
        image.className = "skyr-premiere-poster-image";
        image.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        image.alt = "";
        image.addEventListener("error", () => {
            if (!image.src.endsWith("/hqdefault.jpg")) {
                image.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            }
        }, { once: true });

        const shade = document.createElement("div");
        shade.className = "skyr-premiere-poster-shade";
        shade.setAttribute("aria-hidden", "true");

        const content = document.createElement("div");
        content.className = "skyr-premiere-poster-content";

        const copy = document.createElement("div");
        copy.className = "skyr-premiere-poster-copy";

        const kicker = document.createElement("div");
        kicker.className = "skyr-premiere-kicker";
        kicker.textContent = "Upcoming SkyrScout video";

        const title = document.createElement("h2");
        title.className = "skyr-premiere-poster-title";
        title.textContent =
            document.querySelector(".player-header h1")?.textContent?.trim() ||
            premiere.title ||
            "Video premiere";

        const date = document.createElement("p");
        date.className = "skyr-premiere-poster-date";
        date.textContent = `Premieres ${formatProfileTime(premiere.start)}`;

        copy.append(kicker, title, date);

        const link = document.createElement("a");
        link.className = "skyr-premiere-youtube-link";
        link.href = `https://www.youtube.com/watch?v=${videoId}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Watch on YouTube";

        content.append(copy, link);
        poster.append(image, shade, makeBadge(), content);
        wrapper.append(poster);
    }

    function decoratePlayerVideo(activePremieres) {
        const iframe = document.querySelector(
            ".player-video .video-wrapper iframe[src*='youtube.com/embed/']"
        );

        if (!iframe) return;

        const videoId = extractVideoId(iframe.src);
        const premiere = activePremieres.get(videoId);

        if (!premiere) return;

        buildProfilePoster(videoId, premiere, iframe);
    }

    async function loadStatuses() {
        const controller = new AbortController();
        const timer = window.setTimeout(
            () => controller.abort(),
            FETCH_TIMEOUT_MS
        );

        try {
            const response = await fetch(STATUS_URL, {
                cache: "no-store",
                signal: controller.signal
            });

            if (!response.ok) return null;

            const data = await response.json();

            if (!data || typeof data !== "object") return null;

            return data;
        } catch (error) {
            return null;
        } finally {
            window.clearTimeout(timer);
        }
    }

    async function init() {
        const data = await loadStatuses();
        if (!data) return;

        const activePremieres = getActivePremieres(data);
        if (!activePremieres.size) return;

        decorateThumbnails(activePremieres);
        decoratePlayerVideo(activePremieres);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
