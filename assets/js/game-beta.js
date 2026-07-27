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
 * MATCH LAB / SIGNATURE ABILITIES:
 * - v0.9 keeps the tiny match loop but adds visible squads, direct card match-ups and a duel overlay: structured draft -> auto opponent -> attacks + opponent replies.
 * - Signature abilities are linked player events sourced from Shorts, NOT drawable cards.
 * - One player may accumulate multiple linked Shorts / abilities over time.
 * - game-signature-events.json is a temporary bridge shaped like future generated data.
 * - Missing Short metrics remain missing. Known Short views may add a small capped Buzz modifier.
 * - Shorts stay separate from long-form base rarity and need their own popularity scale.
 * - Football data supplies the base/context. Long-form YouTube Match Index is a capped Momentum modifier. Missing data = no effect.
 * - Defenders reduce the opponent scoring chance; situational height only matters against aerial opponents.
 * - Opponent tactical archetypes are auto-drawn from game-opponents.json; the five-player computer squad is drawn from the live SkyrScout card pool.
 *
 * CURRENT BETA:
 * Landing menu -> PLAY, CARD LIBRARY or CARD LAB.
 * PLAY: Choose Scout -> Defender -> Midfielder -> Attacker -> 2 Wildcards -> auto opponent -> match.
 * CARD LIBRARY: browse the full player-card pool outside the active game.
 * Scout influence is deliberately small and data-driven: own reports / dominant category, plus Bon Scout signature authorship.
 */

document.addEventListener("DOMContentLoaded", function () {
    const cardGrid = document.getElementById("game-card-grid");
    const landing = document.getElementById("game-landing");
    const playBar = document.getElementById("game-play-bar");
    const libraryBar = document.getElementById("game-library-bar");
    const labBar = document.getElementById("game-lab-bar");
    const matchBar = document.getElementById("game-match-bar");
    const cardPool = document.getElementById("game-card-pool");
    const cardLab = document.getElementById("game-card-lab");
    const matchLab = document.getElementById("game-match-lab");
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
    const continueToMatchButton = document.getElementById("continue-to-match");
    const showAllButton = document.getElementById("show-all");
    const openLabButton = document.getElementById("open-card-lab");
    const openMatchLabButton = document.getElementById("open-match-lab");
    const leaveDraftButton = document.getElementById("leave-draft");
    const leaveLibraryButton = document.getElementById("leave-library");
    const leaveLabButton = document.getElementById("leave-lab");
    const leaveMatchLabButton = document.getElementById("leave-match-lab");
    const count = document.getElementById("game-card-count");
    const filters = Array.from(document.querySelectorAll(".game-filter"));
    const scoutButtons = Array.from(document.querySelectorAll("[data-scout]"));

    const labSourceNote = document.getElementById("game-lab-source-note");
    const labPlayerA = document.getElementById("lab-player-a");
    const labPlayerB = document.getElementById("lab-player-b");
    const labPhase = document.getElementById("lab-phase");
    const runLabClashButton = document.getElementById("run-lab-clash");
    const labClashResult = document.getElementById("lab-clash-result");

    const matchAttacks = document.getElementById("match-attacks");
    const matchGoals = document.getElementById("match-goals");
    const matchOpponentGoals = document.getElementById("match-opponent-goals");
    const matchSignatures = document.getElementById("match-signatures");
    const matchPhaseStrip = document.getElementById("match-phase-strip");
    const matchNarrative = document.getElementById("match-narrative");
    const startMatchAttackButton = document.getElementById("start-match-attack");
    const resetMatchLabButton = document.getElementById("reset-match-lab");
    const matchChoiceHeading = document.getElementById("match-choice-heading");
    const matchPhaseTitle = document.getElementById("match-phase-title");
    const matchPhaseHelp = document.getElementById("match-phase-help");
    const matchChoiceGrid = document.getElementById("match-choice-grid");
    const matchLineupStatus = document.getElementById("match-lineup-status");
    const matchOpponentStatus = document.getElementById("match-opponent-status");
    const matchOpponentStyle = document.getElementById("match-opponent-style");
    const matchHomeTeamName = document.getElementById("match-home-team-name");
    const matchAwayTeamName = document.getElementById("match-away-team-name");
    const matchTeamNameInput = document.getElementById("match-team-name-input");
    const matchGenerateTeamNameButton = document.getElementById("match-generate-team-name");
    const matchDuelOverlay = document.getElementById("match-duel-overlay");
    const matchDuelPhase = document.getElementById("match-duel-phase");
    const matchDuelTitle = document.getElementById("match-duel-title");
    const matchDuelHome = document.getElementById("match-duel-home");
    const matchDuelAway = document.getElementById("match-duel-away");
    const matchDuelEvent = document.getElementById("match-duel-event");
    const matchDuelNumbers = document.getElementById("match-duel-numbers");
    const matchDuelResult = document.getElementById("match-duel-result");
    const matchDuelContinueButton = document.getElementById("match-duel-continue");

    if (!cardGrid) {
        return;
    }

    const cards = Array.from(cardGrid.querySelectorAll("[data-card]"));
    const TEAM_SIZE = 5;
    const DRAFT_SLOTS = ["defender", "midfielder", "attacker", "wildcard", "wildcard"];

    let selectedScout = "";
    let team = [];
    let availableCards = [];
    let currentDraw = [];
    let draftSlotIndex = 0;

    let gameVideoStats = {};
    let gameVideoStatsMeta = {};
    let labDataLoaded = false;
    const labEdits = { a: {}, b: {} };

    const MATCH_ATTACK_LIMIT = 5;
    const MATCH_PHASES = ["build-up", "breakthrough", "chance"];
    const MATCH_DEMO_SLUGS = [
        "yacqub-finey",
        "sander-alamaa",
        "erbol-atabaev",
        "kevin-benkic",
        "fernando-mimbacas"
    ];

    let signatureEvents = [];
    let signatureDataLoaded = false;
    let opponentTeams = [];
    let opponentDataLoaded = false;
    let currentOpponent = null;
    let currentOpponentLineup = [];
    let matchHomeClubName = "";
    let matchAwayClubName = "";
    let matchCurrentOpponentCard = null;
    let matchOpponentUsedPlayers = new Set();
    let matchOverlayContinueHandler = null;
    let matchAttackCount = 0;
    let matchGoalCount = 0;
    let matchOpponentGoalCount = 0;
    let matchCurrentPhaseIndex = -1;
    let matchAttackUsedPlayers = new Set();
    let matchUsedSignatures = new Set();
    let matchAttackActive = false;


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
        if (matchLab) matchLab.hidden = true;
    }

    function showLanding() {
        hideGameAreas();

        if (landing) landing.hidden = false;
        if (playBar) playBar.hidden = true;
        if (libraryBar) libraryBar.hidden = true;
        if (labBar) labBar.hidden = true;
        if (matchBar) matchBar.hidden = true;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = true;
        if (matchLab) matchLab.hidden = true;

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
        if (matchBar) matchBar.hidden = true;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = true;
        if (matchLab) matchLab.hidden = true;

        resetDraft();
    }

    function enterLibraryMode() {
        hideGameAreas();

        if (landing) landing.hidden = true;
        if (playBar) playBar.hidden = true;
        if (libraryBar) libraryBar.hidden = false;
        if (labBar) labBar.hidden = true;
        if (matchBar) matchBar.hidden = true;
        if (cardPool) cardPool.hidden = false;
        if (cardLab) cardLab.hidden = true;
        if (matchLab) matchLab.hidden = true;

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

    function parseJsonDataset(value, fallback) {
        if (!value) return fallback;
        try {
            const parsed = JSON.parse(value);
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (error) {
            return fallback;
        }
    }

    function structuredPositions(card) {
        const structured = parseJsonDataset(card.dataset.positionsJson, []);
        if (Array.isArray(structured) && structured.length) {
            return structured.map(function (entry) {
                if (typeof entry === "string") return entry;
                if (entry && entry.role) return String(entry.role);
                return "";
            }).filter(Boolean);
        }

        const raw = card.dataset.positionFull || card.dataset.primaryPosition || "";
        return raw.split("/").map(function (position) {
            return position.trim();
        }).filter(Boolean);
    }

    function cardHeightCm(card) {
        const raw = card.dataset.heightCm;
        if (raw === null || raw === undefined || raw === "") return null;
        const match = String(raw).replace(",", ".").match(/\d+(?:\.\d+)?/);
        if (!match) return null;
        const value = Number(match[0]);
        return Number.isFinite(value) ? Math.round(value) : null;
    }

    function cardTraits(card) {
        const traits = parseJsonDataset(card.dataset.gameTraitsJson, []);
        return Array.isArray(traits) ? traits : [];
    }

    function cardDraftCategory(card) {
        if (card.dataset.group === "defender") return "defender";
        if (card.dataset.group === "midfielder") return "midfielder";
        if (card.dataset.group === "winger" || card.dataset.group === "striker") return "attacker";
        return "wildcard";
    }

    function eligibleClasses(card) {
        const positions = structuredPositions(card);

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
        if (matchBar) matchBar.hidden = true;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = false;
        if (matchLab) matchLab.hidden = true;

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

    function matchDemoCards() {
        // A completed draft is the real Match Lab lineup.
        // Only use the hard-coded demo five when Match Lab is opened without a draft.
        if (team.length === TEAM_SIZE) {
            return team.slice();
        }

        const bySlug = new Map();
        cards.forEach(function (card) {
            const slug = card.dataset.slug || normaliseSlug(card.dataset.name);
            bySlug.set(slug, card);
        });

        return MATCH_DEMO_SLUGS
            .map(function (slug) { return bySlug.get(slug); })
            .filter(Boolean);
    }

    function scoutProfiles() {
        const profiles = {};
        const global = { total: 0, defender: 0, midfielder: 0, attacker: 0 };

        cards.forEach(function (card) {
            const scout = card.dataset.scout || "SkyrScout";
            const category = cardDraftCategory(card);
            if (!profiles[scout]) {
                profiles[scout] = {
                    total: 0,
                    defender: 0,
                    midfielder: 0,
                    attacker: 0
                };
            }
            profiles[scout].total += 1;
            global.total += 1;
            if (category !== "wildcard") {
                profiles[scout][category] += 1;
                global[category] += 1;
            }
        });

        // Raw counts are attack-heavy across SkyrScout. A useful Scout identity therefore
        // comes from relative specialisation: how over-represented a category is for that
        // Scout compared with the whole player pool.
        Object.keys(profiles).forEach(function (scout) {
            const profile = profiles[scout];
            let bestCategory = null;
            let bestRatio = -Infinity;

            ["defender", "midfielder", "attacker"].forEach(function (category) {
                if (!profile.total || !global.total || !global[category]) return;
                const scoutShare = profile[category] / profile.total;
                const globalShare = global[category] / global.total;
                const ratio = scoutShare / globalShare;
                if (ratio > bestRatio) {
                    bestRatio = ratio;
                    bestCategory = category;
                }
            });

            profile.dominant = bestCategory;
            profile.specialityRatio = Number.isFinite(bestRatio) ? bestRatio : null;
        });

        return profiles;
    }

    function renderScoutStats() {
        const profiles = scoutProfiles();

        scoutButtons.forEach(function (button) {
            const scout = button.dataset.scout;
            const profile = profiles[scout];
            const detail = button.querySelector("span:last-child");
            if (!detail || !profile) return;

            const base =
                profile.total + " profiles · " +
                profile.defender + " DEF · " +
                profile.midfielder + " MID · " +
                profile.attacker + " ATT" +
                (profile.dominant ? " · speciality " + profile.dominant.toUpperCase() : "");

            detail.textContent = scout === "Bon Scout"
                ? base + " · Short creator"
                : base;
        });
    }

    function scoutInfluence(card, signature) {
        if (!selectedScout) {
            return { bonus: 0, labels: [] };
        }

        let bonus = 0;
        const labels = [];
        const profiles = scoutProfiles();
        const profile = profiles[selectedScout];
        const category = cardDraftCategory(card);

        if (card.dataset.scout === selectedScout) {
            bonus += 1;
            labels.push("+1 own report");
        }

        if (profile && profile.dominant === category) {
            bonus += 1;
            labels.push("+1 scout tendency");
        }

        if (signature && selectedScout === "Bon Scout" && signature.created_by === "Bon Scout") {
            bonus += 3;
            labels.push("+3 Short creator");
        }

        return { bonus: bonus, labels: labels };
    }

    const CLUB_NAME_PREFIXES = [
        "Northbridge", "Ravenhill", "Blackwater", "Eastgate", "Ironvale", "Westmoor",
        "Southbank", "Stormhaven", "Kingsway", "Redwood", "Nightfall", "Copperfield"
    ];

    const CLUB_NAME_SUFFIXES = [
        "FC", "United", "Athletic", "Rovers", "Wanderers", "Sporting", "City"
    ];

    const OPPONENT_STYLE_NAMES = {
        "High Press": ["Redline", "Hornet", "Pressing", "Overdrive"],
        "Low Block": ["Fortress", "Brickwall", "Citadel", "Bunker Hill"],
        "Counter Attack": ["Roadrunner", "Breakaway", "Lightning", "Rapid"],
        "Crosses & Aerial Threat": ["Skyhook", "High Tower", "Airborne", "Crosswind"],
        Balanced: ["Nomad", "Union", "Compass", "Vanguard"]
    };

    function randomItem(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    function generateClubName(style, opponent) {
        const prefixPool = opponent && OPPONENT_STYLE_NAMES[style]
            ? OPPONENT_STYLE_NAMES[style]
            : CLUB_NAME_PREFIXES;
        return randomItem(prefixPool) + " " + randomItem(CLUB_NAME_SUFFIXES);
    }

    function ensureHomeClubName() {
        if (!matchHomeClubName) {
            matchHomeClubName = generateClubName("Balanced", false);
        }
        if (matchTeamNameInput && !matchTeamNameInput.value.trim()) {
            matchTeamNameInput.value = matchHomeClubName;
        }
        if (matchHomeTeamName) {
            matchHomeTeamName.textContent = matchHomeClubName;
        }
    }

    function setHomeClubName(value) {
        const clean = String(value || "").trim().slice(0, 36);
        matchHomeClubName = clean || generateClubName("Balanced", false);
        if (matchTeamNameInput) matchTeamNameInput.value = matchHomeClubName;
        if (matchHomeTeamName) matchHomeTeamName.textContent = matchHomeClubName;
    }

    function cardThumbnail(card) {
        const image = card ? card.querySelector(".skyr-card-image img") : null;
        return image ? image.getAttribute("src") : "";
    }

    function cardDisplayPosition(card) {
        return card ? (card.dataset.positionFull || card.dataset.primaryPosition || "") : "";
    }

    function cardSlug(card) {
        return card ? (card.dataset.slug || normaliseSlug(card.dataset.name)) : "";
    }

    function renderMiniLineup(container, lineup, activeSlug) {
        if (!container) return;
        container.innerHTML = "";

        if (!lineup.length) {
            const empty = document.createElement("p");
            empty.className = "game-match-card-row-empty";
            empty.textContent = "No five-player lineup available.";
            container.appendChild(empty);
            return;
        }

        lineup.forEach(function (card) {
            const item = document.createElement("div");
            item.className = "game-match-mini-card";
            if (activeSlug && cardSlug(card) === activeSlug) {
                item.classList.add("is-active-matchup");
            }

            const imageSrc = cardThumbnail(card);
            if (imageSrc) {
                const image = document.createElement("img");
                image.src = imageSrc;
                image.alt = "";
                image.loading = "lazy";
                item.appendChild(image);
            }

            const copy = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = card.dataset.name || "Player";
            const meta = document.createElement("span");
            meta.textContent = (card.dataset.cardClass || "Controller") + " · " + cardDisplayPosition(card);
            copy.appendChild(name);
            copy.appendChild(meta);
            item.appendChild(copy);
            container.appendChild(item);
        });
    }

    function renderMatchLineupStatus(activeSlug) {
        const lineup = matchDemoCards();
        ensureHomeClubName();
        renderMiniLineup(matchLineupStatus, lineup, activeSlug || "");
    }

    function drawComputerLineup() {
        const homeCards = new Set(matchDemoCards());
        const chosen = [];
        const slots = ["defender", "midfielder", "attacker", "wildcard", "wildcard"];

        function eligiblePool(slot, avoidHome) {
            return cards.filter(function (card) {
                if (chosen.includes(card)) return false;
                if (avoidHome && homeCards.has(card)) return false;
                return slot === "wildcard" || cardDraftCategory(card) === slot;
            });
        }

        slots.forEach(function (slot) {
            let pool = eligiblePool(slot, true);
            if (!pool.length) pool = eligiblePool(slot, false);
            if (!pool.length) {
                pool = cards.filter(function (card) { return !chosen.includes(card); });
            }
            if (pool.length) chosen.push(randomItem(pool));
        });

        return chosen;
    }

    function drawOpponent() {
        if (!opponentTeams.length) {
            currentOpponent = {
                id: "fallback",
                name: "Prototype XI",
                style: "Balanced",
                description: "Fallback opponent while opponent data is unavailable.",
                attack: 44,
                attack_type: "balanced",
                phase_penalties: { "build-up": 0, breakthrough: 0, chance: 0 }
            };
        } else {
            currentOpponent = opponentTeams[Math.floor(Math.random() * opponentTeams.length)];
        }

        currentOpponentLineup = drawComputerLineup();
        matchAwayClubName = generateClubName(currentOpponent.style || "Balanced", true);
        if (matchAwayClubName === matchHomeClubName) {
            matchAwayClubName = generateClubName(currentOpponent.style || "Balanced", true);
        }
    }

    function renderOpponentStatus(activeSlug) {
        if (matchAwayTeamName) {
            matchAwayTeamName.textContent = matchAwayClubName || "Opponent XI";
        }
        renderMiniLineup(matchOpponentStatus, currentOpponentLineup, activeSlug || "");

        if (matchOpponentStyle) {
            if (!currentOpponent) {
                matchOpponentStyle.textContent = "Opponent pending.";
            } else {
                matchOpponentStyle.textContent = currentOpponent.style + " · " + currentOpponent.description;
            }
        }
    }

    function signaturesForPlayer(slug, phase) {
        return signatureEvents.filter(function (event) {
            return event.player_slug === slug &&
                event.phase === phase &&
                !matchUsedSignatures.has(event.id);
        });
    }

    function signatureBuzz(views) {
        if (!Number.isFinite(Number(views))) {
            return { bonus: 0, label: "Views pending · no effect" };
        }

        const value = Number(views);
        if (value >= 50000) return { bonus: 8, label: "+8 Short Buzz" };
        if (value >= 15000) return { bonus: 6, label: "+6 Short Buzz" };
        if (value >= 5000) return { bonus: 4, label: "+4 Short Buzz" };
        if (value >= 1000) return { bonus: 2, label: "+2 Short Buzz" };
        return { bonus: 0, label: "No Short Buzz bonus" };
    }

    function youtubeMomentum(card) {
        const data = Object.assign({}, cardSeedData(card), getStoredStats(card));
        const engine = calculateCardEngine(card, data);

        if (!Number.isFinite(engine.matchIndex)) {
            return { bonus: 0, score: null, label: "YouTube data missing · no effect" };
        }

        const bonus = clamp(Math.round((engine.matchIndex - 20) / 10), 0, 8);
        return {
            bonus: bonus,
            score: engine.matchIndex,
            label: "+" + bonus + " YouTube Momentum"
        };
    }

    function opponentPhasePenalty(phase) {
        if (!currentOpponent || !currentOpponent.phase_penalties) return 0;
        const value = Number(currentOpponent.phase_penalties[phase]);
        return Number.isFinite(value) ? value : 0;
    }

    function phaseBaseChance(card, phase) {
        const className = card.dataset.cardClass || "Controller";
        const affinity = (phaseAffinity[phase] && phaseAffinity[phase][className]) || 1;
        return clamp(Math.round(58 + (affinity - 1) * 100), 42, 76);
    }

    function phaseOpponentFit(card, phase) {
        const category = cardDraftCategory(card);
        const className = card.dataset.cardClass || "Controller";
        const categoryFit = {
            "build-up": { attacker: 3, midfielder: 3, defender: 1, wildcard: 1 },
            breakthrough: { defender: 3, midfielder: 3, attacker: 1, wildcard: 1 },
            chance: { defender: 4, midfielder: 2, attacker: 0, wildcard: 1 }
        }[phase] || {};

        let score = categoryFit[category] || 0;
        if (phase === "build-up" && (className === "Raider" || className === "Striker" || className === "Controller")) score += 1;
        if (phase === "breakthrough" && (className === "Engine" || className === "Controller" || className === "Tank")) score += 1;
        if (phase === "chance" && (className === "Tank" || className === "Engine")) score += 2;
        return score;
    }

    function selectOpponentForPhase(phase) {
        if (!currentOpponentLineup.length) return null;
        const unused = currentOpponentLineup.filter(function (card) {
            return !matchOpponentUsedPlayers.has(cardSlug(card));
        });
        const pool = unused.length ? unused : currentOpponentLineup.slice();
        let best = -Infinity;
        pool.forEach(function (card) {
            best = Math.max(best, phaseOpponentFit(card, phase));
        });
        const bestCards = pool.filter(function (card) {
            return phaseOpponentFit(card, phase) === best;
        });
        const offset = Math.max(0, matchAttackCount + MATCH_PHASES.indexOf(phase));
        return bestCards[offset % bestCards.length] || pool[0] || null;
    }

    function signatureIsAerial(signature) {
        if (!signature) return false;
        const tags = Array.isArray(signature.event_tags) ? signature.event_tags : [];
        return tags.some(function (tag) {
            return ["header", "heading", "aerial", "cross"].includes(String(tag).toLowerCase());
        });
    }

    function opponentPlayerResistance(card, phase, signature) {
        if (!card) return { bonus: 0, reasons: ["No direct opponent card"] };

        const category = cardDraftCategory(card);
        const className = card.dataset.cardClass || "Controller";
        const baseByPhase = {
            "build-up": { defender: 1, midfielder: 2, attacker: 2, wildcard: 1 },
            breakthrough: { defender: 2, midfielder: 2, attacker: 1, wildcard: 1 },
            chance: { defender: 3, midfielder: 1, attacker: 0, wildcard: 1 }
        }[phase] || {};

        let value = baseByPhase[category] || 0;
        const reasons = value ? ["+" + value + " positional resistance"] : [];

        if (phase === "chance" && className === "Tank") {
            value += 2;
            reasons.push("+2 Tank");
        } else if ((phase === "breakthrough" || phase === "chance") && className === "Engine") {
            value += 1;
            reasons.push("+1 Engine");
        } else if ((phase === "build-up" || phase === "breakthrough") && className === "Controller") {
            value += 1;
            reasons.push("+1 Controller");
        } else if ((phase === "build-up" || phase === "breakthrough") && className === "Raider") {
            value += 1;
            reasons.push("+1 Raider");
        } else if (phase === "build-up" && className === "Striker") {
            value += 1;
            reasons.push("+1 Striker press");
        }

        const momentum = youtubeMomentum(card);
        const momentumResistance = Math.round(momentum.bonus * 0.25);
        if (momentumResistance) {
            value += momentumResistance;
            reasons.push("+" + momentumResistance + " momentum");
        } else if (momentum.score === null) {
            reasons.push("YouTube: no effect");
        }

        if (phase === "chance" && signatureIsAerial(signature)) {
            const height = cardHeightCm(card);
            if (Number.isFinite(height)) {
                if (height >= 195) {
                    value += 2;
                    reasons.push("+2 height vs aerial");
                } else if (height >= 188) {
                    value += 1;
                    reasons.push("+1 height vs aerial");
                }
            }
        }

        return {
            bonus: clamp(value, 0, 6),
            reasons: reasons.length ? reasons : ["No extra card resistance"]
        };
    }

    function phaseChanceParts(card, phase, signature, opponentCard) {
        const base = phaseBaseChance(card, phase);
        const momentum = youtubeMomentum(card);
        const scout = scoutInfluence(card, signature);
        const opponentPenalty = opponentPhasePenalty(phase);
        const opponentResistance = opponentPlayerResistance(opponentCard, phase, signature);
        let signatureBonus = 0;
        let buzz = { bonus: 0, label: "" };

        if (signature) {
            signatureBonus = 10;
            buzz = signatureBuzz(signature.views);
        }

        return {
            base: base,
            momentum: momentum,
            scout: scout,
            opponentPenalty: opponentPenalty,
            opponentResistance: opponentResistance,
            signatureBonus: signatureBonus,
            buzz: buzz,
            total: clamp(
                base + momentum.bonus + scout.bonus + signatureBonus + buzz.bonus - opponentPenalty - opponentResistance.bonus,
                5,
                95
            )
        };
    }

    function phaseDisplayName(phase) {
        return {
            "build-up": "BUILD-UP",
            breakthrough: "BREAKTHROUGH",
            chance: "CHANCE"
        }[phase] || String(phase || "").toUpperCase();
    }

    function phaseHelpText(phase, opponentCard) {
        const opponentText = currentOpponent
            ? " " + matchAwayClubName + " play " + currentOpponent.style + "."
            : "";
        const duelText = opponentCard
            ? " Direct match-up: " + (opponentCard.dataset.name || "Opponent") + " (" +
                (opponentCard.dataset.cardClass || "Controller") + " · " + cardDisplayPosition(opponentCard) + ")."
            : "";

        return ({
            "build-up": "Controllers and Engines are natural fits. Get the move started without losing possession.",
            breakthrough: "Raiders are strongest here. Beat the next line and create danger.",
            chance: "Strikers are natural finishers, but a matching signature ability can create a special route to goal."
        }[phase] || "Choose the player who fits this phase best.") + opponentText + duelText;
    }

    function normalActionText(card, phase, opponentCard) {
        const name = card.dataset.name || "The player";
        const opponentName = opponentCard ? (opponentCard.dataset.name || "the opponent") : "the opponent";
        return {
            "build-up": name + " takes the first touch and tries to play through " + opponentName + "'s pressure.",
            breakthrough: name + " drives at the next line. " + opponentName + " steps across to close the route.",
            chance: name + " gets the final action. " + opponentName + " makes the last defensive move."
        }[phase] || name + " takes the next action against " + opponentName + ".";
    }

    function successTransition(phase, card, opponentCard, signature) {
        const name = card.dataset.name || "The player";
        const opponentName = opponentCard ? (opponentCard.dataset.name || "the opponent") : "the opponent";
        if (signature) {
            return phase === "chance"
                ? name + " lands the signature move. GOAL!"
                : name + " lands the signature move and wins the duel.";
        }
        return {
            "build-up": name + " wins the first duel and plays through " + opponentName + ".",
            breakthrough: name + " gets beyond " + opponentName + ". The defence is opening.",
            chance: name + " wins the duel and FINDS THE NET!"
        }[phase] || "Success.";
    }

    function failureTransition(phase, card, opponentCard) {
        const name = card.dataset.name || "The player";
        const opponentName = opponentCard ? (opponentCard.dataset.name || "The opponent") : "The opponent";
        return {
            "build-up": opponentName + " reads the move and forces " + name + " into the turnover.",
            breakthrough: opponentName + " shuts the route. Possession is gone.",
            chance: opponentName + " gets enough on it. The chance is stopped."
        }[phase] || "Possession is lost.";
    }

    function renderMatchScoreboard() {
        if (matchAttacks) matchAttacks.textContent = matchAttackCount + " / " + MATCH_ATTACK_LIMIT;
        if (matchGoals) matchGoals.textContent = String(matchGoalCount);
        if (matchOpponentGoals) matchOpponentGoals.textContent = String(matchOpponentGoalCount);
        if (matchSignatures) matchSignatures.textContent = String(matchUsedSignatures.size);
    }

    function renderMatchPhaseStrip() {
        if (!matchPhaseStrip) return;

        const currentPhase = MATCH_PHASES[matchCurrentPhaseIndex];
        Array.from(matchPhaseStrip.querySelectorAll("[data-match-phase]")).forEach(function (item) {
            const phase = item.dataset.matchPhase;
            const phaseIndex = MATCH_PHASES.indexOf(phase);
            item.classList.toggle("is-current", phase === currentPhase && matchAttackActive);
            item.classList.toggle(
                "is-complete",
                matchAttackActive && phaseIndex >= 0 && phaseIndex < matchCurrentPhaseIndex
            );
        });
    }

    function renderDuelCard(container, card, labelText) {
        if (!container) return;
        container.innerHTML = "";

        const label = document.createElement("span");
        label.className = "game-duel-side-label";
        label.textContent = labelText;
        container.appendChild(label);

        if (!card) {
            const missing = document.createElement("div");
            missing.className = "game-duel-missing-card";
            missing.textContent = "No card available";
            container.appendChild(missing);
            return;
        }

        const clone = card.cloneNode(true);
        clone.hidden = false;
        clone.classList.remove("is-chosen", "is-rejected", "is-tilting");
        clone.classList.add("game-duel-card-clone");
        clone.removeAttribute("role");
        clone.removeAttribute("tabindex");
        clone.querySelectorAll("button").forEach(function (button) { button.remove(); });
        clone.querySelectorAll("a").forEach(function (link) {
            const span = document.createElement("span");
            span.textContent = link.textContent;
            link.replaceWith(span);
        });
        const footer = clone.querySelector(".skyr-card-footer");
        if (footer) footer.remove();
        container.appendChild(clone);
    }

    function closeMatchDuel() {
        if (matchDuelOverlay) matchDuelOverlay.hidden = true;
        document.body.classList.remove("game-duel-open");
        matchOverlayContinueHandler = null;
    }

    function showMatchDuel(config, onContinue) {
        if (!matchDuelOverlay) {
            onContinue();
            return;
        }

        matchOverlayContinueHandler = onContinue;
        if (matchDuelPhase) matchDuelPhase.textContent = config.phaseLabel || "PLAYER DUEL";
        if (matchDuelTitle) matchDuelTitle.textContent = config.title || "Match-up";
        renderDuelCard(matchDuelHome, config.homeCard, config.homeLabel || matchHomeClubName || "YOUR TEAM");
        renderDuelCard(matchDuelAway, config.awayCard, config.awayLabel || matchAwayClubName || "OPPONENT");

        if (matchDuelEvent) {
            matchDuelEvent.innerHTML = "";
            const action = document.createElement("p");
            action.textContent = config.eventText || "The duel begins.";
            matchDuelEvent.appendChild(action);
        }

        if (matchDuelNumbers) {
            matchDuelNumbers.innerHTML = "";
            (config.numbers || []).forEach(function (item) {
                const box = document.createElement("div");
                if (item.emphasis) box.classList.add("is-emphasis");
                const label = document.createElement("span");
                label.textContent = item.label;
                const value = document.createElement("strong");
                value.textContent = item.value;
                box.appendChild(label);
                box.appendChild(value);
                if (item.detail) {
                    const detail = document.createElement("small");
                    detail.textContent = item.detail;
                    box.appendChild(detail);
                }
                matchDuelNumbers.appendChild(box);
            });
        }

        if (matchDuelResult) {
            matchDuelResult.className = "game-duel-result " + (config.success ? "is-success" : "is-failure");
            matchDuelResult.textContent = config.resultText || "Result";
        }

        matchDuelOverlay.hidden = false;
        document.body.classList.add("game-duel-open");
        if (matchDuelContinueButton) matchDuelContinueButton.focus();
    }

    function defenderContribution(card, attackType) {
        if (cardDraftCategory(card) !== "defender") return null;

        const className = card.dataset.cardClass || "Controller";
        const height = cardHeightCm(card);
        const momentum = youtubeMomentum(card);
        const slug = cardSlug(card);
        const usedInAttack = matchAttackUsedPlayers.has(slug);

        let football = 7;
        const reasons = ["7 defender"];

        if (className === "Tank") {
            football += 4;
            reasons.push("+4 Tank");
        } else if (className === "Engine") {
            football += 3;
            reasons.push("+3 Engine");
        }

        if (attackType === "aerial" && Number.isFinite(height)) {
            let heightBonus = 0;
            if (height >= 195) heightBonus = 5;
            else if (height >= 188) heightBonus = 3;
            else if (height >= 183) heightBonus = 1;
            if (heightBonus) {
                football += heightBonus;
                reasons.push("+" + heightBonus + " height vs aerial");
            }
        }

        let total = football + Math.round(momentum.bonus * 0.5);
        if (momentum.bonus) reasons.push("+" + Math.round(momentum.bonus * 0.5) + " momentum");
        else if (momentum.score === null) reasons.push("YouTube: no effect");

        if (usedInAttack) {
            total = Math.round(total * 0.5);
            reasons.push("×0.5 used in attack");
        }

        return {
            card: card,
            name: card.dataset.name || "Defender",
            total: total,
            reasons: reasons,
            height: height,
            momentum: momentum
        };
    }

    function teamDefensiveEffect() {
        const attackType = currentOpponent ? currentOpponent.attack_type : "balanced";
        const contributions = matchDemoCards()
            .map(function (card) { return defenderContribution(card, attackType); })
            .filter(Boolean)
            .sort(function (a, b) { return b.total - a.total; });

        return {
            total: contributions.reduce(function (sum, item) { return sum + item.total; }, 0),
            contributions: contributions,
            primary: contributions[0] || null
        };
    }

    function opponentAttackCard() {
        if (!currentOpponentLineup.length) return null;
        const attackType = currentOpponent ? currentOpponent.attack_type : "balanced";
        let pool = currentOpponentLineup.filter(function (card) {
            return cardDraftCategory(card) === "attacker";
        });
        if (!pool.length) {
            pool = currentOpponentLineup.filter(function (card) {
                return cardDraftCategory(card) === "midfielder";
            });
        }
        if (!pool.length) pool = currentOpponentLineup.slice();

        if (attackType === "aerial") {
            return pool.slice().sort(function (a, b) {
                return (cardHeightCm(b) || 0) - (cardHeightCm(a) || 0);
            })[0];
        }

        return pool[(matchAttackCount - 1 + pool.length) % pool.length] || pool[0];
    }

    function finishRoundControls() {
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        matchCurrentOpponentCard = null;
        renderOpponentStatus();
        renderMatchLineupStatus();

        if (!startMatchAttackButton) return;
        if (matchAttackCount >= MATCH_ATTACK_LIMIT) {
            startMatchAttackButton.disabled = true;
            startMatchAttackButton.textContent = "Playtest complete";
            if (matchNarrative) {
                matchNarrative.insertAdjacentHTML(
                    "beforeend",
                    '<div class="game-match-final"><strong>Final score: ' +
                    matchGoalCount + '–' + matchOpponentGoalCount +
                    ' vs ' + (matchAwayClubName || 'Opponent') +
                    '.</strong></div>'
                );
            }
        } else {
            startMatchAttackButton.disabled = false;
            startMatchAttackButton.textContent = "Start next attack";
        }
    }

    function resolveOpponentAttack(onComplete) {
        if (!currentOpponent) {
            onComplete();
            return;
        }

        const defence = teamDefensiveEffect();
        const baseAttack = Number.isFinite(Number(currentOpponent.attack)) ? Number(currentOpponent.attack) : 44;
        const chance = clamp(baseAttack - defence.total, 8, 78);
        const roll = Math.floor(Math.random() * 100) + 1;
        const scored = roll <= chance;
        const attackingCard = opponentAttackCard();
        const homeLineup = matchDemoCards();
        const primaryCard = defence.primary ? defence.primary.card : (homeLineup[0] || null);
        const attackerName = attackingCard ? (attackingCard.dataset.name || "Opponent attacker") : matchAwayClubName;
        const defenderName = primaryCard ? (primaryCard.dataset.name || "Your defender") : "Your defence";
        const eventText = attackerName + " leads the reply. " + defenderName + " is the first player into the defensive duel.";
        const resultText = scored
            ? attackerName + " breaks through. " + matchAwayClubName + " score."
            : defenderName + " and the defensive unit kill the attack.";

        if (startMatchAttackButton) {
            startMatchAttackButton.disabled = true;
            startMatchAttackButton.textContent = "Opponent reply in progress";
        }

        showMatchDuel({
            phaseLabel: "OPPONENT REPLY · " + (currentOpponent.style || "ATTACK"),
            title: attackerName + " vs " + defenderName,
            homeCard: primaryCard,
            awayCard: attackingCard,
            homeLabel: matchHomeClubName,
            awayLabel: matchAwayClubName,
            eventText: eventText,
            success: !scored,
            resultText: resultText,
            numbers: [
                { label: "Opponent attack", value: String(baseAttack), detail: currentOpponent.style },
                { label: "Team resistance", value: "−" + defence.total, detail: defence.contributions.length ? defence.contributions.map(function (item) { return item.name + " −" + item.total; }).join(" · ") : "No defender effect" },
                { label: "Scoring chance", value: chance + "%", emphasis: true },
                { label: "Roll", value: String(roll), detail: roll + (scored ? " ≤ " : " > ") + chance }
            ]
        }, function () {
            closeMatchDuel();
            if (scored) matchOpponentGoalCount += 1;

            if (matchNarrative) {
                const defenderLines = defence.contributions.length
                    ? defence.contributions.map(function (item) {
                        return item.name + " −" + item.total + " (" + item.reasons.join(", ") + ")";
                    }).join(" · ")
                    : "No defender effect";

                matchNarrative.insertAdjacentHTML(
                    "beforeend",
                    '<div class="game-match-opponent-play ' + (scored ? 'is-goal' : 'is-stopped') + '">' +
                        '<div class="game-match-play-head"><strong>' + matchAwayClubName + ' · ' + attackerName + '</strong>' +
                        '<span>' + roll + ' / ' + chance + '%</span></div>' +
                        '<p>' + currentOpponent.style + '. Defensive resistance: ' + defenderLines + '.</p>' +
                        '<p class="game-match-transition"><strong>' +
                            (scored ? 'Opponent scores.' : 'Your defence stops the attack.') +
                        '</strong></p>' +
                    '</div>'
                );
            }

            renderMatchScoreboard();
            onComplete();
        });
    }

    function finishMatchAttack(message, scored) {
        matchAttackActive = false;
        matchAttackCount += 1;
        if (scored) matchGoalCount += 1;

        if (matchChoiceGrid) matchChoiceGrid.innerHTML = "";
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;

        if (matchNarrative) {
            matchNarrative.insertAdjacentHTML(
                "beforeend",
                '<div class="game-match-outcome ' + (scored ? 'is-goal' : 'is-ended') + '">' +
                    '<strong>' + message + '</strong>' +
                '</div>'
            );
        }

        renderMatchScoreboard();
        renderMatchPhaseStrip();
        resolveOpponentAttack(finishRoundControls);
    }

    function resolveMatchAction(card, phase, signature) {
        if (!matchAttackActive) return;

        const slug = cardSlug(card);
        if (matchAttackUsedPlayers.has(slug)) return;

        const opponentCard = matchCurrentOpponentCard || selectOpponentForPhase(phase);
        const parts = phaseChanceParts(card, phase, signature, opponentCard);
        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= parts.total;
        const actionText = signature ? signature.description : normalActionText(card, phase, opponentCard);
        const resultText = success
            ? successTransition(phase, card, opponentCard, signature)
            : failureTransition(phase, card, opponentCard);
        const opponentName = opponentCard ? (opponentCard.dataset.name || "Opponent") : "Opponent";
        const numbers = [
            { label: "Football base", value: String(parts.base), detail: (card.dataset.cardClass || "Controller") + " phase fit" },
            { label: "Momentum", value: "+" + parts.momentum.bonus, detail: parts.momentum.label },
            { label: "Scout", value: "+" + parts.scout.bonus, detail: parts.scout.labels.length ? parts.scout.labels.join(" · ") : "No scout effect" }
        ];

        if (signature) {
            numbers.push({ label: "Signature", value: "+" + (parts.signatureBonus + parts.buzz.bonus), detail: "+" + parts.signatureBonus + " ability · " + parts.buzz.label });
        }
        numbers.push(
            { label: "Team style", value: "−" + parts.opponentPenalty, detail: currentOpponent ? currentOpponent.style : "No phase penalty" },
            { label: opponentName, value: "−" + parts.opponentResistance.bonus, detail: parts.opponentResistance.reasons.join(" · ") },
            { label: "Success chance", value: parts.total + "%", emphasis: true },
            { label: "Roll", value: String(roll), detail: roll + (success ? " ≤ " : " > ") + parts.total }
        );

        showMatchDuel({
            phaseLabel: phaseDisplayName(phase),
            title: (card.dataset.name || "Player") + " vs " + opponentName,
            homeCard: card,
            awayCard: opponentCard,
            homeLabel: matchHomeClubName,
            awayLabel: matchAwayClubName,
            eventText: actionText,
            numbers: numbers,
            success: success,
            resultText: resultText
        }, function () {
            closeMatchDuel();
            matchAttackUsedPlayers.add(slug);
            if (opponentCard) matchOpponentUsedPlayers.add(cardSlug(opponentCard));
            if (signature) matchUsedSignatures.add(signature.id);
            renderMatchScoreboard();
            renderMatchLineupStatus(slug);
            renderOpponentStatus(opponentCard ? cardSlug(opponentCard) : "");

            if (matchNarrative) {
                const modifiers = [
                    "Football " + parts.base,
                    parts.momentum.label,
                    parts.scout.labels.length ? parts.scout.labels.join(" + ") : "Scout: no effect",
                    parts.opponentPenalty ? "Team style −" + parts.opponentPenalty : "Team style: no phase penalty",
                    opponentName + " −" + parts.opponentResistance.bonus
                ];
                if (signature) modifiers.push("Signature +" + parts.signatureBonus + " · " + parts.buzz.label);

                matchNarrative.insertAdjacentHTML(
                    "beforeend",
                    '<div class="game-match-play">' +
                        '<div class="game-match-play-head"><strong>' +
                            phaseDisplayName(phase) + ' · ' + (card.dataset.name || "Player") + ' vs ' + opponentName +
                        '</strong><span>' + roll + ' / ' + parts.total + '%</span></div>' +
                        '<p>' + actionText + '</p>' +
                        (signature ? '<span class="game-match-signature-used">Signature: ' + signature.title + ' · ' + parts.buzz.label + '</span>' : '') +
                        '<p class="game-match-modifiers">' + modifiers.join(' · ') + '</p>' +
                        '<p class="game-match-transition">' + resultText + '</p>' +
                    '</div>'
                );
            }

            if (!success) {
                finishMatchAttack("Attack ended.", false);
                return;
            }

            if (phase === "chance") {
                finishMatchAttack("Goal scored.", true);
                return;
            }

            matchCurrentPhaseIndex += 1;
            matchCurrentOpponentCard = null;
            renderMatchPhase();
        });
    }

    function renderMatchChoice(card, phase) {
        const slug = cardSlug(card);
        const used = matchAttackUsedPlayers.has(slug);
        const className = card.dataset.cardClass || "Controller";
        const opponentCard = matchCurrentOpponentCard;
        const normalParts = phaseChanceParts(card, phase, null, opponentCard);
        const signatures = signaturesForPlayer(slug, phase);
        const opponentName = opponentCard ? (opponentCard.dataset.name || "Opponent") : "Opponent";

        const article = document.createElement("article");
        article.className = "game-match-choice" + (used ? " is-used" : "");

        const heading = document.createElement("div");
        heading.className = "game-match-choice-top";
        heading.innerHTML =
            '<div><strong>' + (card.dataset.name || "Player") + '</strong>' +
            '<span>' + className + ' · ' + cardDisplayPosition(card) + '</span></div>' +
            '<b>' + normalParts.total + '%</b>';
        article.appendChild(heading);

        const dataLine = document.createElement("p");
        dataLine.className = "game-match-data-line";
        dataLine.textContent =
            "Football " + normalParts.base +
            " · " + normalParts.momentum.label +
            " · vs " + opponentName + " −" + normalParts.opponentResistance.bonus +
            (normalParts.opponentPenalty ? " · style −" + normalParts.opponentPenalty : "") +
            (normalParts.scout.bonus ? " · scout +" + normalParts.scout.bonus : "");
        article.appendChild(dataLine);

        const normalButton = document.createElement("button");
        normalButton.type = "button";
        normalButton.className = "game-match-play-button";
        normalButton.disabled = used;
        normalButton.textContent = used ? "Already used this attack" : "Play action vs " + opponentName;
        normalButton.addEventListener("click", function () {
            resolveMatchAction(card, phase, null);
        });
        article.appendChild(normalButton);

        signatures.forEach(function (signature) {
            const parts = phaseChanceParts(card, phase, signature, opponentCard);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "game-match-signature-button";
            button.disabled = used;
            button.innerHTML =
                '<span>★ ' + signature.title + '</span>' +
                '<small>' + signature.event_category + ' · ' + parts.total + '% · ' + parts.buzz.label + '</small>';
            button.addEventListener("click", function () {
                resolveMatchAction(card, phase, signature);
            });
            article.appendChild(button);

            const description = document.createElement("p");
            description.className = "game-match-signature-preview";
            description.textContent = signature.description;
            article.appendChild(description);
        });

        if (!signatures.length) {
            const noSignature = document.createElement("p");
            noSignature.className = "game-match-no-signature";
            noSignature.textContent = "No unused linked Short ability for this phase.";
            article.appendChild(noSignature);
        }

        return article;
    }

    function renderMatchPhase() {
        if (!matchAttackActive) return;

        const phase = MATCH_PHASES[matchCurrentPhaseIndex];
        if (!matchCurrentOpponentCard) {
            matchCurrentOpponentCard = selectOpponentForPhase(phase);
        }
        const opponentName = matchCurrentOpponentCard
            ? (matchCurrentOpponentCard.dataset.name || "Opponent")
            : "Opponent";

        renderMatchPhaseStrip();
        renderOpponentStatus(matchCurrentOpponentCard ? cardSlug(matchCurrentOpponentCard) : "");
        renderMatchLineupStatus();

        if (matchChoiceHeading) matchChoiceHeading.hidden = false;
        if (matchPhaseTitle) matchPhaseTitle.textContent = phaseDisplayName(phase) + " · choose one player vs " + opponentName;
        if (matchPhaseHelp) matchPhaseHelp.textContent = phaseHelpText(phase, matchCurrentOpponentCard);
        if (matchChoiceGrid) {
            matchChoiceGrid.innerHTML = "";
            matchDemoCards().forEach(function (card) {
                matchChoiceGrid.appendChild(renderMatchChoice(card, phase));
            });
        }
    }

    function startMatchAttack() {
        if (matchAttackActive || matchAttackCount >= MATCH_ATTACK_LIMIT) return;

        matchAttackActive = true;
        matchCurrentPhaseIndex = 0;
        matchAttackUsedPlayers = new Set();
        matchOpponentUsedPlayers = new Set();
        matchCurrentOpponentCard = null;

        if (startMatchAttackButton) {
            startMatchAttackButton.disabled = true;
            startMatchAttackButton.textContent = "Attack in progress";
        }

        if (matchNarrative) {
            matchNarrative.innerHTML =
                '<strong>Attack ' + (matchAttackCount + 1) + ' begins against ' + matchAwayClubName + '.</strong>' +
                '<p>Build the move one phase at a time. The computer assigns a direct opponent for each phase. A defender used in your attack only gives half resistance on the opponent reply.</p>';
        }

        renderMatchPhase();
    }

    function resetMatchLab() {
        closeMatchDuel();
        matchAttackCount = 0;
        matchGoalCount = 0;
        matchOpponentGoalCount = 0;
        matchCurrentPhaseIndex = -1;
        matchAttackUsedPlayers = new Set();
        matchOpponentUsedPlayers = new Set();
        matchUsedSignatures = new Set();
        matchCurrentOpponentCard = null;
        matchAttackActive = false;
        ensureHomeClubName();
        drawOpponent();

        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus();
        renderOpponentStatus();

        if (matchChoiceGrid) matchChoiceGrid.innerHTML = "";
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;
        if (matchNarrative) {
            matchNarrative.innerHTML =
                '<strong>Ready for the first attack.</strong>' +
                '<p>' + matchAwayClubName + ' were drawn automatically. Both five-player squads are visible above. Missing player facts or YouTube data give no effect.</p>';
        }
        if (startMatchAttackButton) {
            startMatchAttackButton.disabled = false;
            startMatchAttackButton.textContent = "Start first attack";
        }
    }

    async function loadSignatureEvents() {
        if (signatureDataLoaded) return;

        try {
            const response = await fetch("/assets/data/game-signature-events.json", {
                cache: "no-store"
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const payload = await response.json();
            signatureEvents = Array.isArray(payload.events) ? payload.events : [];
        } catch (error) {
            signatureEvents = [];
        }

        signatureDataLoaded = true;
    }

    async function loadOpponentTeams() {
        if (opponentDataLoaded) return;

        try {
            const response = await fetch("/assets/data/game-opponents.json", {
                cache: "no-store"
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const payload = await response.json();
            opponentTeams = Array.isArray(payload.teams) ? payload.teams : [];
        } catch (error) {
            opponentTeams = [];
        }

        opponentDataLoaded = true;
    }

    async function enterMatchLabMode() {
        hideGameAreas();

        if (landing) landing.hidden = true;
        if (playBar) playBar.hidden = true;
        if (libraryBar) libraryBar.hidden = true;
        if (labBar) labBar.hidden = true;
        if (matchBar) matchBar.hidden = false;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = true;
        if (matchLab) matchLab.hidden = false;

        await Promise.all([loadSignatureEvents(), loadOpponentTeams(), loadGameVideoStats()]);
        resetMatchLab();

        if (matchBar) {
            matchBar.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function draftSlotLabel(slot) {
        return {
            defender: "DEFENDER",
            midfielder: "MIDFIELDER",
            attacker: "ATTACKER",
            wildcard: "WILDCARD"
        }[slot] || String(slot || "").toUpperCase();
    }

    function resetDraft() {
        selectedScout = "";
        team = [];
        availableCards = shuffle(cards);
        currentDraw = [];
        draftSlotIndex = 0;

        scoutButtons.forEach(function (button) {
            button.classList.remove("is-selected");
        });

        if (drawGrid) drawGrid.innerHTML = "";
        if (teamGrid) teamGrid.innerHTML = "";
        if (teamHeading) teamHeading.textContent = "0 / " + TEAM_SIZE + " players";
        if (chosenScoutText) chosenScoutText.textContent = "";
        if (draftProgress) draftProgress.textContent = "First slot: DEFENDER.";
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

        team.forEach(function (card, index) {
            const clone = card.cloneNode(true);
            clone.hidden = false;
            delete clone.dataset.tiltReady;

            const choiceButton = clone.querySelector(".game-draft-choice");
            if (choiceButton) choiceButton.remove();

            const slot = DRAFT_SLOTS[index] || "wildcard";
            const badge = document.createElement("span");
            badge.className = "game-draft-slot-badge";
            badge.textContent = draftSlotLabel(slot);
            clone.querySelector(".skyr-card-frame").appendChild(badge);

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

        draftSlotIndex += 1;
        renderTeam();

        if (team.length >= TEAM_SIZE) {
            finishDraft();
            return;
        }

        drawThree();
    }

    function cardMatchesDraftSlot(card, slot) {
        if (slot === "wildcard") return true;
        return cardDraftCategory(card) === slot;
    }

    function draftCandidates(slot) {
        const available = availableCards.filter(function (card) {
            return !team.includes(card) && cardMatchesDraftSlot(card, slot);
        });

        if (available.length >= 3) return shuffle(available);

        // Rebuild the category pool from every unpicked card if two rejected cards
        // exhausted the current shuffled list. Drafted players never return.
        return shuffle(cards.filter(function (card) {
            return !team.includes(card) && cardMatchesDraftSlot(card, slot);
        }));
    }

    function drawThree() {
        const slot = DRAFT_SLOTS[draftSlotIndex] || "wildcard";
        const candidates = draftCandidates(slot);
        currentDraw = candidates.slice(0, 3);
        drawGrid.innerHTML = "";

        currentDraw.forEach(function (card) {
            const clone = card.cloneNode(true);
            clone.hidden = false;
            delete clone.dataset.tiltReady;

            const choice = document.createElement("button");
            choice.type = "button";
            choice.className = "game-draft-choice";
            choice.textContent = "Add as " + draftSlotLabel(slot).toLowerCase();

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
            "Slot " + (draftSlotIndex + 1) + " / " + TEAM_SIZE +
            ": choose 1 " + draftSlotLabel(slot) +
            ". " + (TEAM_SIZE - team.length) + " team spot" +
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

    if (continueToMatchButton) {
        continueToMatchButton.addEventListener("click", enterMatchLabMode);
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

    if (openMatchLabButton) {
        openMatchLabButton.addEventListener("click", enterMatchLabMode);
    }

    if (leaveMatchLabButton) {
        leaveMatchLabButton.addEventListener("click", showLanding);
    }

    if (startMatchAttackButton) {
        startMatchAttackButton.addEventListener("click", startMatchAttack);
    }

    if (resetMatchLabButton) {
        resetMatchLabButton.addEventListener("click", resetMatchLab);
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

    if (matchTeamNameInput) {
        matchTeamNameInput.addEventListener("input", function () {
            const clean = matchTeamNameInput.value.trim().slice(0, 36);
            if (clean) {
                matchHomeClubName = clean;
                if (matchHomeTeamName) matchHomeTeamName.textContent = matchHomeClubName;
            }
        });
        matchTeamNameInput.addEventListener("change", function () {
            setHomeClubName(matchTeamNameInput.value);
        });
    }

    if (matchGenerateTeamNameButton) {
        matchGenerateTeamNameButton.addEventListener("click", function () {
            setHomeClubName(generateClubName("Balanced", false));
        });
    }

    if (matchDuelContinueButton) {
        matchDuelContinueButton.addEventListener("click", function () {
            const handler = matchOverlayContinueHandler;
            if (typeof handler === "function") handler();
        });
    }

    populateLabSelectors();
    renderScoutStats();
    showLanding();
});
