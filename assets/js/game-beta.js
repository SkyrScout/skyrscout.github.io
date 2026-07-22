/*
 * SKYRSCOUT CARD GAME — FUTURE DEVELOPMENT NOTES
 *
 * DATA / CARD STRENGTH:
 * - Total YouTube views should contribute to long-term card strength / rarity.
 * - Recent performance matters too: especially views in the last 48 hours.
 * - Future inputs may include likes, total watch time and retention.
 * - Card strength should be position-normalised so less-viewed position groups
 *   can still produce strong cards, without normalising away true global outliers.
 * - Extreme outliers (for example a video far above the normal SkyrScout range)
 *   may become very rare / Mythic-type cards.
 * - Future evolution can be tied to performance milestones.
 * - Height and explicit game traits may later affect gameplay.
 *
 * GLOBAL LEADERBOARD:
 * If/when scoring is implemented, use a global and persistent leaderboard.
 * Google Firebase / Cloud Firestore is a possible backend while the game
 * remains hosted on GitHub Pages.
 * A local-only highscore is NOT wanted.
 * Do not implement the leaderboard until gameplay and scoring are defined.
 *
 * FUTURE CLUB / LEAGUE MODE:
 * A player may eventually create a club and play a football-style league season
 * (for example 30 matches), earning normal league points and a final table position.
 * Initially the league can use computer-controlled clubs. Matches should include
 * meaningful card/player decisions rather than being pure simulations.
 *
 * VISUAL CARD FEEL:
 * Cards use subtle pointer-driven 3D tilt on desktop.
 * Draft selection visually lifts the chosen card and fades the rejected cards.
 * Rarity-specific material effects are scaffolded for future real rarity data.
 *
 * CARD LAB / DATA PIPELINE:
 * - game-video-stats.json is the intended generated bridge between YouTube data
 *   and the browser game.
 * - Public/live-ish inputs: lifetime views, likes, stored 48h/30d view snapshots.
 * - Private Analytics inputs when authorised: watch time and average viewed %.
 * - Missing values must remain missing; do not silently invent data.
 * - Rarity uses long-term metrics. HEAT is a current-match modifier, not rarity.
 * - Versatility is derived from the player's listed positions.
 * - Future Scout Influence can combine visible Scout stats with damped video reach.
 *
 * CURRENT BETA:
 * Landing menu -> PLAY, CARD LIBRARY or CARD LAB.
 * PLAY: Choose Scout -> Draw 3 -> Choose 1 -> Build a five-player test team.
 * CARD LIBRARY: browse the full player-card pool outside the active game.
 * Scout choice has no bonus yet. Match play is not implemented yet.
 */

document.addEventListener("DOMContentLoaded", function () {
    const cardGrid = document.getElementById("game-card-grid");
    const landing = document.getElementById("game-landing");
    const playBar = document.getElementById("game-play-bar");
    const libraryBar = document.getElementById("game-library-bar");
    const labBar = document.getElementById("game-lab-bar");
    const cardPool = document.getElementById("game-card-pool");
    const cardLab = document.getElementById("game-card-lab");
    const scoutZone = document.getElementById("scout-zone");
    const drawZone = document.getElementById("draw-zone");
    const drawGrid = document.getElementById("draw-grid");
    const teamZone = document.getElementById("team-zone");
    const teamGrid = document.getElementById("team-grid");
    const teamHeading = document.getElementById("team-heading");
    const chosenScoutText = document.getElementById("chosen-scout");
    const draftProgress = document.getElementById("draft-progress");
    const draftComplete = document.getElementById("draft-complete");
    const startButton = document.getElementById("start-draft");
    const restartButton = document.getElementById("restart-draft");
    const showAllButton = document.getElementById("show-all");
    const openLabButton = document.getElementById("open-card-lab");
    const leaveDraftButton = document.getElementById("leave-draft");
    const leaveLibraryButton = document.getElementById("leave-library");
    const leaveLabButton = document.getElementById("leave-lab");
    const count = document.getElementById("game-card-count");
    const filters = Array.from(document.querySelectorAll(".game-filter"));
    const scoutButtons = Array.from(document.querySelectorAll("[data-scout]"));

    const labSourceNote = document.getElementById("game-lab-source-note");
    const labPlayerA = document.getElementById("lab-player-a");
    const labPlayerB = document.getElementById("lab-player-b");
    const labPhase = document.getElementById("lab-phase");
    const runLabClashButton = document.getElementById("run-lab-clash");
    const labClashResult = document.getElementById("lab-clash-result");

    if (!cardGrid) {
        return;
    }

    const cards = Array.from(cardGrid.querySelectorAll("[data-card]"));
    const TEAM_SIZE = 5;

    let selectedScout = "";
    let team = [];
    let availableCards = [];
    let currentDraw = [];

    let gameVideoStats = {};
    let gameVideoStatsMeta = {};
    let labDataLoaded = false;
    const labEdits = { a: {}, b: {} };


    const canTilt =
        window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resetCardTilt(card) {
        card.classList.remove("is-tilting");
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
        card.style.setProperty("--shine-x", "50%");
        card.style.setProperty("--shine-y", "50%");
    }

    function enableCardTilt(card) {
        if (!canTilt || card.dataset.tiltReady === "true") {
            return;
        }

        card.dataset.tiltReady = "true";

        card.addEventListener("pointermove", function (event) {
            if (card.classList.contains("is-chosen") ||
                card.classList.contains("is-rejected")) {
                return;
            }

            const rect = card.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;

            const rotateY = (x - 0.5) * 10;
            const rotateX = (0.5 - y) * 8;

            card.classList.add("is-tilting");
            card.style.setProperty("--tilt-x", rotateX.toFixed(2) + "deg");
            card.style.setProperty("--tilt-y", rotateY.toFixed(2) + "deg");
            card.style.setProperty("--shine-x", (x * 100).toFixed(1) + "%");
            card.style.setProperty("--shine-y", (y * 100).toFixed(1) + "%");
        });

        card.addEventListener("pointerleave", function () {
            resetCardTilt(card);
        });
    }

    function enableTiltWithin(container) {
        if (!container) return;
        Array.from(container.querySelectorAll(".skyr-card")).forEach(enableCardTilt);
    }

    if (count) {
        count.textContent =
            cards.length + (cards.length === 1 ? " card" : " cards") + " in the current pool";
    }

    enableTiltWithin(cardGrid);

    function setFilter(filter) {
        cards.forEach(function (card) {
            card.hidden =
                filter !== "all" &&
                card.dataset.group !== filter;
        });

        filters.forEach(function (button) {
            button.classList.toggle(
                "is-active",
                button.dataset.filter === filter
            );
        });
    }

    filters.forEach(function (button) {
        button.addEventListener("click", function () {
            setFilter(button.dataset.filter);
        });
    });

    function shuffle(source) {
        const copy = source.slice();

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
        }

        return copy;
    }

    function hideGameAreas() {
        if (scoutZone) scoutZone.hidden = true;
        if (drawZone) drawZone.hidden = true;
        if (teamZone) teamZone.hidden = true;
        if (cardLab) cardLab.hidden = true;
    }

    function showLanding() {
        hideGameAreas();

        if (landing) landing.hidden = false;
        if (playBar) playBar.hidden = true;
        if (libraryBar) libraryBar.hidden = true;
        if (labBar) labBar.hidden = true;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = true;

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    function enterPlayMode() {
        if (landing) landing.hidden = true;
        if (playBar) playBar.hidden = false;
        if (libraryBar) libraryBar.hidden = true;
        if (labBar) labBar.hidden = true;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = true;

        resetDraft();
    }

    function enterLibraryMode() {
        hideGameAreas();

        if (landing) landing.hidden = true;
        if (playBar) playBar.hidden = true;
        if (libraryBar) libraryBar.hidden = false;
        if (labBar) labBar.hidden = true;
        if (cardPool) cardPool.hidden = false;
        if (cardLab) cardLab.hidden = true;

        setFilter("all");

        if (libraryBar) {
            libraryBar.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }


    function normaliseSlug(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function numberOrNull(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }

    function median(values) {
        const clean = values
            .filter(function (value) { return Number.isFinite(value); })
            .sort(function (a, b) { return a - b; });

        if (!clean.length) return null;

        const middle = Math.floor(clean.length / 2);
        return clean.length % 2
            ? clean[middle]
            : (clean[middle - 1] + clean[middle]) / 2;
    }

    function classFromPosition(position) {
        const value = String(position || "").trim().toLowerCase();

        if (value.includes("centre-forward") ||
            value.includes("center-forward") ||
            value.includes("striker") ||
            value === "cf") {
            return "Striker";
        }

        if (value.includes("left winger") ||
            value.includes("right winger") ||
            value === "winger" ||
            value === "lw" ||
            value === "rw") {
            return "Raider";
        }

        if (value.includes("left back") ||
            value.includes("right back") ||
            value.includes("wing-back") ||
            value.includes("wing back") ||
            value === "lb" ||
            value === "rb" ||
            value === "lwb" ||
            value === "rwb") {
            return "Engine";
        }

        if (value.includes("centre-back") ||
            value.includes("center-back") ||
            value.includes("defender") ||
            value === "cb") {
            return "Tank";
        }

        if (value.includes("midfield") ||
            value === "dm" ||
            value === "cm" ||
            value === "am") {
            return "Controller";
        }

        return null;
    }

    function eligibleClasses(card) {
        const raw = card.dataset.positionFull || card.dataset.primaryPosition || "";
        const positions = raw.split("/").map(function (position) {
            return position.trim();
        });

        const result = [];

        positions.forEach(function (position) {
            const mapped = classFromPosition(position);
            if (mapped && !result.includes(mapped)) {
                result.push(mapped);
            }
        });

        const primaryClass = card.dataset.cardClass;
        if (primaryClass && !result.includes(primaryClass)) {
            result.unshift(primaryClass);
        }

        return result.length ? result : [primaryClass || "Controller"];
    }

    function cardSeedData(card) {
        return {
            views: numberOrNull(card.dataset.gameViews),
            watch_hours: numberOrNull(card.dataset.gameWatchHours),
            likes: numberOrNull(card.dataset.gameLikes),
            views_48h: numberOrNull(card.dataset.gameViews48h),
            views_30d: numberOrNull(card.dataset.gameViews30d),
            video_age_days: numberOrNull(card.dataset.gameVideoAgeDays),
            video_minutes: numberOrNull(card.dataset.gameVideoMinutes),
            average_viewed_pct: numberOrNull(card.dataset.gameAverageViewedPct)
        };
    }

    function getStoredStats(card) {
        const slug = card.dataset.slug || normaliseSlug(card.dataset.name);
        const nameSlug = normaliseSlug(card.dataset.name);

        return gameVideoStats[slug] ||
            gameVideoStats[nameSlug] ||
            {};
    }

    function mergedCardData(card, side) {
        return Object.assign(
            {},
            cardSeedData(card),
            getStoredStats(card),
            labEdits[side] || {}
        );
    }

    function knownViewsForGroup(group) {
        const values = [];

        cards.forEach(function (card) {
            if (card.dataset.group !== group) return;

            const data = Object.assign({}, cardSeedData(card), getStoredStats(card));
            if (Number.isFinite(data.views) && data.views > 0) {
                values.push(data.views);
            }
        });

        return values;
    }

    function reachBaseline(group) {
        const liveMedian = median(knownViewsForGroup(group));

        if (liveMedian !== null && knownViewsForGroup(group).length >= 4) {
            return {
                value: Math.max(liveMedian, 1),
                source: "current " + group + " median"
            };
        }

        const fallback = {
            defender: 400,
            midfielder: 550,
            winger: 700,
            striker: 700
        };

        return {
            value: fallback[group] || 550,
            source: "temporary " + group + " baseline"
        };
    }

    function calculateReach(card, data) {
        if (!(Number.isFinite(data.views) && data.views > 0)) {
            return { score: null, why: "Lifetime views are missing." };
        }

        const baseline = reachBaseline(card.dataset.group);
        const ratio = data.views / baseline.value;
        const normalised = clamp(
            45 + 20 * Math.log2(Math.max(ratio, 0.125)),
            10,
            85
        );

        const outlierBonus = data.views > 5000
            ? clamp(8 * Math.log2(data.views / 5000), 0, 15)
            : 0;

        return {
            score: clamp(normalised + outlierBonus, 0, 100),
            why:
                Math.round(data.views) + " views vs " +
                Math.round(baseline.value) + " (" + baseline.source + "). " +
                (outlierBonus > 0
                    ? "Global outlier bonus +" + outlierBonus.toFixed(1) + "."
                    : "No global outlier bonus.")
        };
    }

    function calculateDepth(data) {
        if (!(Number.isFinite(data.views) && data.views > 0 &&
              Number.isFinite(data.watch_hours) && data.watch_hours >= 0)) {
            return {
                score: null,
                why: "Watch time and lifetime views are both needed."
            };
        }

        const minutesPerView = (data.watch_hours * 60) / data.views;
        const watchScore = clamp(
            25 + 18 * Math.log2(1 + minutesPerView / 2),
            0,
            90
        );

        let viewedPct = Number.isFinite(data.average_viewed_pct)
            ? data.average_viewed_pct
            : null;

        let retentionSource = "YouTube average viewed %";

        if (viewedPct === null &&
            Number.isFinite(data.video_minutes) &&
            data.video_minutes > 0) {
            viewedPct = clamp((minutesPerView / data.video_minutes) * 100, 0, 100);
            retentionSource = "derived from watch time / views / video length";
        }

        if (viewedPct === null) {
            return {
                score: Math.min(watchScore, 85),
                why:
                    minutesPerView.toFixed(1) +
                    " average minutes watched per view. Retention/video length is missing, " +
                    "so DEPTH is provisional and capped at 85."
            };
        }

        const retentionScore = clamp(((viewedPct - 15) / 65) * 100, 0, 100);
        const score = watchScore * 0.55 + retentionScore * 0.45;

        return {
            score: clamp(score, 0, 100),
            why:
                minutesPerView.toFixed(1) + " min/view + " +
                viewedPct.toFixed(1) + "% viewed (" + retentionSource + ")."
        };
    }

    function calculateHeat(data) {
        if (!(Number.isFinite(data.views) && data.views > 0 &&
              Number.isFinite(data.views_48h) &&
              Number.isFinite(data.video_age_days) &&
              data.video_age_days > 0)) {
            return {
                score: null,
                why: "48h views and video age are needed."
            };
        }

        if (data.views_48h <= 0) {
            return {
                score: 0,
                why: "No views in the last 48 hours."
            };
        }

        const age = Math.max(data.video_age_days, 7);
        const expected48h = Math.max((data.views / age) * 2, 1);
        const paceRatio = data.views_48h / expected48h;
        const paceScore = clamp(50 + 25 * Math.log2(paceRatio), 0, 100);
        const volumeScore = clamp(
            (Math.log2(1 + data.views_48h) / Math.log2(51)) * 100,
            0,
            100
        );

        return {
            score: clamp(paceScore * 0.72 + volumeScore * 0.28, 0, 100),
            why:
                Math.round(data.views_48h) + " views / 48h vs about " +
                expected48h.toFixed(1) + " expected from the video's lifetime pace."
        };
    }

    function calculateResponse(data) {
        if (!(Number.isFinite(data.views) && data.views > 0 &&
              Number.isFinite(data.likes) && data.likes >= 0)) {
            return {
                score: null,
                why: "Likes and lifetime views are needed."
            };
        }

        // Bayesian smoothing: a tiny sample should not become a monster card.
        const priorViews = 100;
        const priorRate = 0.03;
        const smoothedRate =
            (data.likes + priorViews * priorRate) /
            (data.views + priorViews);

        return {
            score: clamp((smoothedRate / 0.08) * 100, 0, 100),
            why:
                data.likes + " likes / " + Math.round(data.views) +
                " views. Smoothed engagement: " +
                (smoothedRate * 100).toFixed(2) + "%."
        };
    }

    function calculateStayingPower(data) {
        if (!(Number.isFinite(data.views) && data.views > 0 &&
              Number.isFinite(data.views_30d) &&
              Number.isFinite(data.video_age_days) &&
              data.video_age_days >= 60)) {
            return {
                score: null,
                why: "Needs 30-day views and a video at least 60 days old."
            };
        }

        const expected30d = Math.max(
            (data.views / data.video_age_days) * 30,
            1
        );
        const ratio = data.views_30d / expected30d;
        const ageBonus = clamp((data.video_age_days / 365) * 10, 0, 10);

        return {
            score: clamp(50 + 20 * Math.log2(Math.max(ratio, 0.125)) + ageBonus, 0, 100),
            why:
                Math.round(data.views_30d) + " views in 30d vs about " +
                expected30d.toFixed(1) + " expected from lifetime pace. " +
                "Older videos get a small durability bonus."
        };
    }

    function weightedAvailable(metrics, weights) {
        let totalWeight = 0;
        let total = 0;

        Object.keys(weights).forEach(function (key) {
            const metric = metrics[key];
            if (metric && Number.isFinite(metric.score)) {
                total += metric.score * weights[key];
                totalWeight += weights[key];
            }
        });

        return totalWeight > 0 ? total / totalWeight : null;
    }

    function rarityFromIndex(index) {
        if (!Number.isFinite(index)) return "Pending";
        if (index >= 80) return "Mythic";
        if (index >= 65) return "Epic";
        if (index >= 50) return "Rare";
        if (index >= 35) return "Uncommon";
        return "Common";
    }

    function calculateCardEngine(card, data) {
        const metrics = {
            reach: calculateReach(card, data),
            depth: calculateDepth(data),
            heat: calculateHeat(data),
            response: calculateResponse(data),
            staying: calculateStayingPower(data)
        };

        // Rarity is long-term. HEAT deliberately does not affect rarity.
        const baseIndex = weightedAvailable(metrics, {
            reach: 0.45,
            depth: 0.30,
            response: 0.15,
            staying: 0.10
        });

        // Current match strength lets HEAT matter without rewriting the card's rarity.
        let matchIndex = baseIndex;
        if (Number.isFinite(baseIndex) && Number.isFinite(metrics.heat.score)) {
            matchIndex = baseIndex * 0.80 + metrics.heat.score * 0.20;
        }

        return {
            metrics: metrics,
            baseIndex: baseIndex,
            matchIndex: matchIndex,
            rarity: rarityFromIndex(baseIndex)
        };
    }

    const phaseAffinity = {
        "build-up": {
            Controller: 1.12,
            Engine: 1.08,
            Tank: 1.00,
            Raider: 0.98,
            Striker: 0.94
        },
        breakthrough: {
            Raider: 1.12,
            Controller: 1.05,
            Engine: 1.03,
            Striker: 1.00,
            Tank: 0.96
        },
        chance: {
            Striker: 1.14,
            Raider: 1.07,
            Controller: 1.00,
            Engine: 0.97,
            Tank: 0.93
        },
        resistance: {
            Tank: 1.14,
            Engine: 1.08,
            Controller: 1.02,
            Raider: 0.96,
            Striker: 0.92
        }
    };

    const labFields = [
        ["views", "views"],
        ["watch", "watch_hours"],
        ["likes", "likes"],
        ["48h", "views_48h"],
        ["30d", "views_30d"],
        ["age", "video_age_days"],
        ["length", "video_minutes"],
        ["retention", "average_viewed_pct"]
    ];

    function selectedLabCard(side) {
        const select = side === "a" ? labPlayerA : labPlayerB;
        if (!select || !select.value) return null;

        return cards.find(function (card) {
            return (card.dataset.slug || normaliseSlug(card.dataset.name)) === select.value;
        }) || null;
    }

    function populateLabSelectors() {
        [labPlayerA, labPlayerB].forEach(function (select) {
            if (!select) return;

            select.innerHTML = "";

            cards
                .slice()
                .sort(function (a, b) {
                    return (a.dataset.name || "").localeCompare(b.dataset.name || "");
                })
                .forEach(function (card) {
                    const option = document.createElement("option");
                    option.value = card.dataset.slug || normaliseSlug(card.dataset.name);
                    option.textContent =
                        (card.dataset.name || "Player") +
                        " · " + (card.dataset.cardClass || "Card");
                    select.appendChild(option);
                });
        });

        const benkic = cards.find(function (card) {
            return normaliseSlug(card.dataset.name).includes("kevin-benkic");
        });

        if (benkic && labPlayerA) {
            labPlayerA.value = benkic.dataset.slug || normaliseSlug(benkic.dataset.name);
        }

        if (labPlayerB && labPlayerB.options.length > 1) {
            labPlayerB.selectedIndex = labPlayerA && labPlayerA.selectedIndex === 0 ? 1 : 0;
        }
    }

    function inputFor(side, suffix) {
        return document.getElementById("lab-" + side + "-" + suffix);
    }

    function loadInputsFromCard(side) {
        const card = selectedLabCard(side);
        if (!card) return;

        labEdits[side] = {};
        const data = mergedCardData(card, side);

        labFields.forEach(function (entry) {
            const input = inputFor(side, entry[0]);
            if (!input) return;

            const value = data[entry[1]];
            input.value = Number.isFinite(value) ? value : "";
        });

        renderLabSide(side);
    }

    function readLabInputs(side) {
        const edits = {};

        labFields.forEach(function (entry) {
            const input = inputFor(side, entry[0]);
            edits[entry[1]] = input ? numberOrNull(input.value) : null;
        });

        labEdits[side] = edits;
    }

    function metricHtml(label, result) {
        const pending = !result || !Number.isFinite(result.score);
        const score = pending ? null : clamp(result.score, 0, 100);

        return (
            '<div class="game-lab-metric' + (pending ? ' is-pending' : '') + '">' +
                '<span class="game-lab-metric-name">' + label + '</span>' +
                '<span class="game-lab-meter"><span style="--metric-width:' +
                    (pending ? 0 : score.toFixed(1)) + '%"></span></span>' +
                '<span class="game-lab-metric-value">' +
                    (pending ? "—" : Math.round(score)) +
                '</span>' +
            '</div>'
        );
    }

    function renderLabSide(side) {
        const card = selectedLabCard(side);
        if (!card) return;

        const identity = document.getElementById("lab-identity-" + side);
        const metricsBox = document.getElementById("lab-metrics-" + side);
        const whyBox = document.getElementById("lab-why-" + side);
        const data = mergedCardData(card, side);
        const engine = calculateCardEngine(card, data);
        const eligible = eligibleClasses(card);
        const primary = card.dataset.cardClass || eligible[0];

        if (identity) {
            identity.innerHTML =
                "<strong>" + (card.dataset.name || "Player") + "</strong>" +
                (card.dataset.positionFull || card.dataset.primaryPosition || "") +
                " · " + primary +
                '<br><span class="game-lab-eligible">' +
                (eligible.length > 1
                    ? "Versatile: " + eligible.join(" · ")
                    : "Primary class only: " + eligible.join("")) +
                "</span>";
        }

        if (metricsBox) {
            metricsBox.innerHTML =
                metricHtml("Reach", engine.metrics.reach) +
                metricHtml("Depth", engine.metrics.depth) +
                metricHtml("Heat", engine.metrics.heat) +
                metricHtml("Response", engine.metrics.response) +
                metricHtml("Staying", engine.metrics.staying) +
                '<div class="game-lab-summary">' +
                    '<div><span>Rarity</span><strong>' + engine.rarity + '</strong></div>' +
                    '<div><span>Base index</span><strong>' +
                        (Number.isFinite(engine.baseIndex) ? Math.round(engine.baseIndex) : "—") +
                    '</strong></div>' +
                    '<div><span>Match index</span><strong>' +
                        (Number.isFinite(engine.matchIndex) ? Math.round(engine.matchIndex) : "—") +
                    '</strong></div>' +
                '</div>';
        }

        if (whyBox) {
            const items = [
                ["REACH", engine.metrics.reach],
                ["DEPTH", engine.metrics.depth],
                ["HEAT", engine.metrics.heat],
                ["RESPONSE", engine.metrics.response],
                ["STAYING POWER", engine.metrics.staying]
            ];

            whyBox.innerHTML = items.map(function (item) {
                return "<p><strong>" + item[0] + ":</strong> " + item[1].why + "</p>";
            }).join("") +
            "<p><strong>RARITY:</strong> Uses long-term metrics only. HEAT affects the current Match Index, not rarity.</p>";
        }
    }

    function rerenderLab() {
        readLabInputs("a");
        readLabInputs("b");
        renderLabSide("a");
        renderLabSide("b");
    }

    function runPhaseClash() {
        const cardA = selectedLabCard("a");
        const cardB = selectedLabCard("b");

        if (!cardA || !cardB || !labClashResult) return;

        readLabInputs("a");
        readLabInputs("b");

        const dataA = mergedCardData(cardA, "a");
        const dataB = mergedCardData(cardB, "b");
        const engineA = calculateCardEngine(cardA, dataA);
        const engineB = calculateCardEngine(cardB, dataB);
        const phase = labPhase ? labPhase.value : "build-up";

        if (!Number.isFinite(engineA.matchIndex) ||
            !Number.isFinite(engineB.matchIndex)) {
            labClashResult.innerHTML =
                "<strong>Not enough data yet.</strong> " +
                "Each card needs at least one long-term metric before it can enter the test.";
            return;
        }

        const classA = cardA.dataset.cardClass || "Controller";
        const classB = cardB.dataset.cardClass || "Controller";
        const affinityA = (phaseAffinity[phase] && phaseAffinity[phase][classA]) || 1;
        const affinityB = (phaseAffinity[phase] && phaseAffinity[phase][classB]) || 1;
        const scoreA = engineA.matchIndex * affinityA;
        const scoreB = engineB.matchIndex * affinityB;
        const difference = Math.abs(scoreA - scoreB);
        const winner = scoreA === scoreB
            ? null
            : (scoreA > scoreB ? cardA : cardB);

        const phaseLabel = {
            "build-up": "BUILD-UP",
            breakthrough: "BREAKTHROUGH",
            chance: "CHANCE",
            resistance: "RESISTANCE"
        }[phase] || phase.toUpperCase();

        labClashResult.innerHTML =
            "<strong>" + phaseLabel + " PHASE</strong>" +
            '<div class="game-clash-scoreline">' +
                "<div>" + cardA.dataset.name +
                    "<b>" + scoreA.toFixed(1) + "</b>" +
                    classA + " × " + affinityA.toFixed(2) +
                "</div>" +
                '<span class="game-clash-vs">VS</span>' +
                "<div>" + cardB.dataset.name +
                    "<b>" + scoreB.toFixed(1) + "</b>" +
                    classB + " × " + affinityB.toFixed(2) +
                "</div>" +
            "</div>" +
            (winner
                ? "<strong>" + winner.dataset.name + " wins this phase.</strong> "
                : "<strong>Draw.</strong> ") +
            "Difference: " + difference.toFixed(1) + ". " +
            "The result comes from the current Match Index plus the card class's affinity for this phase. " +
            "There is no random roll in the Lab yet.";
    }

    async function loadGameVideoStats() {
        if (labDataLoaded) return;

        try {
            const response = await fetch("/assets/data/game-video-stats.json", {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const payload = await response.json();
            gameVideoStatsMeta = payload._meta || {};

            Object.keys(payload).forEach(function (key) {
                if (key !== "_meta") {
                    gameVideoStats[key] = payload[key];
                }
            });

            if (labSourceNote) {
                labSourceNote.textContent =
                    "Prototype data file loaded. " +
                    (gameVideoStatsMeta.note || "Live automation is not connected yet.");
            }
        } catch (error) {
            if (labSourceNote) {
                labSourceNote.textContent =
                    "No generated video-data file was available. " +
                    "The Lab still works with player YAML values or numbers entered here.";
            }
        }

        labDataLoaded = true;
    }

    async function enterLabMode() {
        hideGameAreas();

        if (landing) landing.hidden = true;
        if (playBar) playBar.hidden = true;
        if (libraryBar) libraryBar.hidden = true;
        if (labBar) labBar.hidden = false;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = false;

        await loadGameVideoStats();

        if (!labPlayerA || !labPlayerA.options.length) {
            populateLabSelectors();
        }

        loadInputsFromCard("a");
        loadInputsFromCard("b");

        if (labBar) {
            labBar.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    function resetDraft() {
        selectedScout = "";
        team = [];
        availableCards = shuffle(cards);
        currentDraw = [];

        scoutButtons.forEach(function (button) {
            button.classList.remove("is-selected");
        });

        if (drawGrid) drawGrid.innerHTML = "";
        if (teamGrid) teamGrid.innerHTML = "";
        if (teamHeading) teamHeading.textContent = "0 / " + TEAM_SIZE + " players";
        if (chosenScoutText) chosenScoutText.textContent = "";
        if (draftProgress) draftProgress.textContent = "Pick one player to add to your team.";
        if (draftComplete) draftComplete.hidden = true;
        if (drawZone) drawZone.hidden = true;
        if (teamZone) teamZone.hidden = true;
        if (scoutZone) scoutZone.hidden = false;

        scoutZone.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function renderTeam() {
        teamGrid.innerHTML = "";

        team.forEach(function (card) {
            const clone = card.cloneNode(true);
            clone.hidden = false;
            delete clone.dataset.tiltReady;

            const choiceButton = clone.querySelector(".game-draft-choice");
            if (choiceButton) choiceButton.remove();

            teamGrid.appendChild(clone);
        });

        enableTiltWithin(teamGrid);

        teamHeading.textContent = team.length + " / " + TEAM_SIZE + " players";
        chosenScoutText.textContent = "Scout: " + selectedScout;
        teamZone.hidden = false;
    }

    function finishDraft() {
        drawZone.hidden = true;
        draftComplete.hidden = false;
        draftComplete.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    function chooseCard(card) {
        team.push(card);

        currentDraw.forEach(function (drawnCard) {
            availableCards = availableCards.filter(function (candidate) {
                return candidate !== drawnCard;
            });
        });

        renderTeam();

        if (team.length >= TEAM_SIZE) {
            finishDraft();
            return;
        }

        drawThree();
    }

    function drawThree() {
        if (availableCards.length < 3) {
            availableCards = shuffle(
                cards.filter(function (card) {
                    return !team.includes(card);
                })
            );
        }

        currentDraw = availableCards.slice(0, 3);
        drawGrid.innerHTML = "";

        currentDraw.forEach(function (card) {
            const clone = card.cloneNode(true);
            clone.hidden = false;
            delete clone.dataset.tiltReady;

            const choice = document.createElement("button");
            choice.type = "button";
            choice.className = "game-draft-choice";
            choice.textContent = "Add to my team";

            clone.setAttribute("role", "button");
            clone.setAttribute("tabindex", "0");
            clone.setAttribute("aria-label", "Add " + (card.dataset.name || "this player") + " to my team");

            function selectThisCard() {
                if (drawGrid.classList.contains("is-resolving")) {
                    return;
                }

                drawGrid.classList.add("is-resolving");

                Array.from(drawGrid.querySelectorAll(".skyr-card")).forEach(function (drawnClone) {
                    resetCardTilt(drawnClone);

                    if (drawnClone === clone) {
                        drawnClone.classList.add("is-chosen");
                    } else {
                        drawnClone.classList.add("is-rejected");
                    }
                });

                window.setTimeout(function () {
                    drawGrid.classList.remove("is-resolving");
                    chooseCard(card);
                }, 620);
            }

            clone.addEventListener("click", function (event) {
                if (event.target.closest(".skyr-card-footer a")) {
                    return;
                }

                selectThisCard();
            });

            clone.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectThisCard();
                }
            });

            choice.addEventListener("click", function (event) {
                event.stopPropagation();
                selectThisCard();
            });

            const profileLink = clone.querySelector(".skyr-card-footer a");
            if (profileLink) {
                profileLink.addEventListener("click", function (event) {
                    event.stopPropagation();
                });
            }

            clone.querySelector(".skyr-card-frame").appendChild(choice);
            drawGrid.appendChild(clone);
        });

        enableTiltWithin(drawGrid);

        draftProgress.textContent =
            "Pick 1 player. " + (TEAM_SIZE - team.length) + " team spot" +
            ((TEAM_SIZE - team.length) === 1 ? "" : "s") + " remaining.";

        drawZone.hidden = false;
        teamZone.hidden = false;

        drawZone.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    scoutButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            selectedScout = button.dataset.scout;

            scoutButtons.forEach(function (candidate) {
                candidate.classList.toggle(
                    "is-selected",
                    candidate === button
                );
            });

            chosenScoutText.textContent = "Scout: " + selectedScout;
            scoutZone.hidden = true;
            teamZone.hidden = false;
            drawThree();
        });
    });

    if (startButton) {
        startButton.addEventListener("click", enterPlayMode);
    }

    if (restartButton) {
        restartButton.addEventListener("click", resetDraft);
    }

    if (showAllButton) {
        showAllButton.addEventListener("click", enterLibraryMode);
    }

    if (leaveDraftButton) {
        leaveDraftButton.addEventListener("click", showLanding);
    }

    if (leaveLibraryButton) {
        leaveLibraryButton.addEventListener("click", showLanding);
    }

    if (openLabButton) {
        openLabButton.addEventListener("click", enterLabMode);
    }

    if (leaveLabButton) {
        leaveLabButton.addEventListener("click", showLanding);
    }

    if (labPlayerA) {
        labPlayerA.addEventListener("change", function () {
            loadInputsFromCard("a");
        });
    }

    if (labPlayerB) {
        labPlayerB.addEventListener("change", function () {
            loadInputsFromCard("b");
        });
    }

    labFields.forEach(function (entry) {
        ["a", "b"].forEach(function (side) {
            const input = inputFor(side, entry[0]);
            if (input) {
                input.addEventListener("input", function () {
                    readLabInputs(side);
                    renderLabSide(side);
                });
            }
        });
    });

    if (runLabClashButton) {
        runLabClashButton.addEventListener("click", runPhaseClash);
    }

    populateLabSelectors();
    showLanding();
});
