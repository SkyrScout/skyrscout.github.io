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
 * - v0.10 replaces the abstract three-phase loop with a football-RPG possession test: situation -> football action -> teammate -> duel -> consequence.
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
    const matchMinuteEl = document.getElementById("match-minute");
    const matchLivePanel = document.getElementById("match-live-panel");
    const matchStartActions = document.getElementById("match-start-actions");
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
    const matchTurnBanner = document.getElementById("match-turn-banner");
    const matchRoundLabel = document.getElementById("match-round-label");
    const matchTurnLabel = document.getElementById("match-turn-label");
    const matchEngineOpenButton = document.getElementById("match-engine-open");
    const matchEngineOverlay = document.getElementById("match-engine-overlay");
    const matchEngineCloseButton = document.getElementById("match-engine-close");
    const matchEngineMeta = document.getElementById("match-engine-meta");
    const matchEngineCurrent = document.getElementById("match-engine-current");
    const matchEngineHome = document.getElementById("match-engine-home");
    const matchEngineAway = document.getElementById("match-engine-away");
    const matchEngineSignatures = document.getElementById("match-engine-signatures");

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
    let matchOverlayContinueHandler = null;
    let matchAttackCount = 0;
    let matchGoalCount = 0;
    let matchOpponentGoalCount = 0;
    let matchAttackActive = false;

    // v0.10 football-RPG possession state. Players remain on the pitch and may
    // be involved repeatedly; their movement can affect the counter after a turnover.
    let matchFieldZone = 0;
    let matchBallCarrier = null;
    let matchPendingAction = null;
    let matchPendingTarget = null;
    let matchPlayerStates = new Map();
    let matchBallState = "Ready";

    // v0.11 match state: finite 90-minute match, dynamic team moves and contextual BREAK / Signature actions.
    let matchMinute = 0;
    let matchEnded = false;
    let matchPossessionNo = 0;
    let matchBreakBonus = 0;
    let matchDefensivePosture = "hold";
    let matchSignatureRolls = new Set();

    // v0.12 turn-based match + transparent engine state.
    const MATCH_ROUNDS = 5;
    let matchRound = 1;
    let matchTurn = "home_attack";
    let matchActionsThisTurn = 0;
    let matchOpponentActionsThisTurn = 0;
    let matchOpponentTransitionBonus = 0;
    let matchAwayBallCarrier = null;
    let matchAwayFieldZone = 0;
    let matchOpponentPendingMove = null;
    let matchLastEngineSnapshot = null;
    let signatureEventsMeta = {};


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
        document.body.classList.remove("game-match-mode");
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
        document.body.classList.remove("game-match-mode");
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
        document.body.classList.remove("game-match-mode");
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
        document.body.classList.remove("game-match-mode");
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

    function youtubeMomentum(card) {
        const data = Object.assign({}, cardSeedData(card), getStoredStats(card));
        const engine = calculateCardEngine(card, data);

        if (!Number.isFinite(engine.matchIndex)) {
            return { bonus: 0, score: null, label: "YouTube: no effect" };
        }

        const bonus = clamp(Math.round((engine.matchIndex - 20) / 10), 0, 8);
        return {
            bonus: bonus,
            score: engine.matchIndex,
            label: bonus ? "+" + bonus + " Momentum" : "Momentum: no bonus"
        };
    }

    function cardSummaryText(card) {
        return String(card && card.dataset.summary ? card.dataset.summary : "").toLowerCase();
    }

    function traitHit(text, patterns, score) {
        return patterns.some(function (pattern) { return text.includes(pattern); }) ? score : 0;
    }

    function cardRpgTraits(card) {
        const text = cardSummaryText(card);
        const className = card ? (card.dataset.cardClass || "Controller") : "Controller";
        const twoFooted = String(card && card.dataset.twoFootedAbility ? card.dataset.twoFootedAbility : "").toLowerCase();
        const traits = {
            pace: traitHit(text, ["quick", "fast", "pace", "acceleration", "speed"], 4),
            power: traitHit(text, ["strong", "powerful", "physical", "strength"], 4),
            passing: traitHit(text, ["passing", "passer", "distribution", "vision", "delivery", "crossing"], 4),
            aerial: traitHit(text, ["aerial", "header", "heading", "in the air"], 4),
            work: traitHit(text, ["pressing", "high press", "hardworking", "hard-working", "work rate", "relentless", "stamina", "engine"], 4),
            dribble: traitHit(text, ["dribbl", "ball-carry", "ball carry", "1v1", "take players on", "close control"], 4),
            finishing: traitHit(text, ["finishing", "goalscorer", "goal scorer", "goal threat", "clinical", "shooting", "strike"], 4),
            technique: traitHit(text, ["technique", "technical", "composed", "control", "first touch"], 3)
        };

        if (className === "Controller") {
            traits.passing += 2;
            traits.technique += 1;
        } else if (className === "Raider") {
            traits.pace += 2;
            traits.dribble += 2;
        } else if (className === "Striker") {
            traits.finishing += 3;
            traits.power += 1;
        } else if (className === "Engine") {
            traits.work += 2;
            traits.passing += 1;
        } else if (className === "Tank") {
            traits.power += 2;
            traits.aerial += 2;
        }

        if (twoFooted === "reliable") traits.technique += 1;
        if (twoFooted === "strong") traits.technique += 2;
        if (twoFooted === "genuine") traits.technique += 3;

        Object.keys(traits).forEach(function (key) {
            traits[key] = clamp(traits[key], 0, 9);
        });
        return traits;
    }

    function cardSides(card) {
        if (!card) return [];
        try {
            const parsed = JSON.parse(card.dataset.positionsJson || "[]");
            if (!Array.isArray(parsed)) return [];
            return parsed.map(function (item) { return String(item.side || "").toLowerCase(); }).filter(Boolean);
        } catch (error) {
            return [];
        }
    }

    function isWideCard(card) {
        const position = cardDisplayPosition(card).toLowerCase();
        const sides = cardSides(card);
        return sides.includes("left") || sides.includes("right") || position.includes("wing") || position.includes("back");
    }

    function isCentralCard(card) {
        const sides = cardSides(card);
        return sides.includes("centre") || sides.includes("center") || !isWideCard(card);
    }

    function isAttackingCard(card) {
        const position = cardDisplayPosition(card).toLowerCase();
        const category = cardDraftCategory(card);
        return category === "attacker" || position.includes("forward") || position.includes("winger") || position.includes("striker");
    }

    function isDefensiveCard(card) {
        return cardDraftCategory(card) === "defender";
    }

    function fieldLabel(zone) {
        return ["OWN HALF", "MIDFIELD", "FINAL THIRD", "BOX"][clamp(zone, 0, 3)];
    }

    function initialisePlayerStates() {
        matchPlayerStates = new Map();
        matchDemoCards().forEach(function (card) {
            matchPlayerStates.set(cardSlug(card), "normal");
        });
    }

    function setPlayerState(card, state) {
        if (!card) return;
        matchPlayerStates.set(cardSlug(card), state);
    }

    function getPlayerState(card) {
        if (!card) return "normal";
        return matchPlayerStates.get(cardSlug(card)) || "normal";
    }

    function naturalStarterScore(card) {
        const traits = cardRpgTraits(card);
        const category = cardDraftCategory(card);
        let score = traits.passing + traits.technique;
        if (category === "defender") score += 8;
        else if (category === "midfielder") score += 5;
        else score -= 2;
        return score;
    }

    function chooseNaturalStarter() {
        const lineup = matchDemoCards().slice();
        lineup.sort(function (a, b) { return naturalStarterScore(b) - naturalStarterScore(a); });
        return lineup[0] || null;
    }

    function matchActionsForZone(zone) {
        if (zone <= 0) {
            return [
                { id: "centre", title: "PLAY THROUGH THE CENTRE", description: "Keep it on the deck and find a central teammate.", needsTarget: true, target: "central", duel: "carrier", base: 58, advance: 1, actorTraits: ["passing", "technique"], targetTraits: ["technique", "passing"] },
                { id: "wide", title: "SWITCH WIDE", description: "Move the defence and release a player on the flank.", needsTarget: true, target: "wide", duel: "carrier", base: 55, advance: 1, actorTraits: ["passing", "technique"], targetTraits: ["pace", "dribble"], targetState: "advanced" },
                { id: "direct", title: "GO DIRECT", description: "Skip the press and hit a forward early.", needsTarget: true, target: "attacker", duel: "target", base: 48, advance: 2, actorTraits: ["passing", "power"], targetTraits: ["aerial", "power"], targetState: "advanced", aerial: true }
            ];
        }
        if (zone === 1) {
            return [
                { id: "combine", title: "PLAY A ONE-TWO", description: "Use a teammate to combine through midfield.", needsTarget: true, target: "any", duel: "carrier", base: 60, advance: 1, actorTraits: ["passing", "technique"], targetTraits: ["passing", "technique"] },
                { id: "release", title: "RELEASE THE WINGER", description: "Send a wide player into space behind the next line.", needsTarget: true, target: "wide", duel: "target", base: 54, advance: 1, actorTraits: ["passing", "technique"], targetTraits: ["pace", "dribble"], targetState: "advanced" },
                { id: "carry", title: "DRIVE FORWARD", description: "Keep the ball and attack the space yourself.", needsTarget: false, duel: "carrier", base: 55, advance: 1, actorTraits: ["dribble", "pace", "power"], targetTraits: [], targetState: "advanced" }
            ];
        }
        if (zone === 2) {
            return [
                { id: "through", title: "SLIP A THROUGH BALL", description: "Try to send a runner in behind the defence.", needsTarget: true, target: "attacker", duel: "target", base: 50, advance: 1, actorTraits: ["passing", "technique"], targetTraits: ["pace", "finishing"], targetState: "advanced" },
                { id: "cross", title: "CROSS INTO THE BOX", description: "Deliver early and attack the aerial duel.", needsTarget: true, target: "attacker", duel: "target", base: 47, advance: 1, actorTraits: ["passing", "technique"], targetTraits: ["aerial", "power"], targetState: "advanced", aerial: true },
                { id: "long-shot", title: "SHOOT FROM RANGE", description: "Back the player on the ball to beat the defence from distance.", needsTarget: false, duel: "carrier", base: 34, advance: 0, actorTraits: ["finishing", "power", "technique"], targetTraits: [], scoresOnSuccess: true }
            ];
        }
        return [
            { id: "finish", title: "TAKE THE SHOT", description: "The player on the ball takes responsibility.", needsTarget: false, duel: "carrier", base: 56, advance: 0, actorTraits: ["finishing", "technique"], targetTraits: [], scoresOnSuccess: true },
            { id: "square", title: "SQUARE IT", description: "Pass across goal to a teammate arriving in the box.", needsTarget: true, target: "attacker", duel: "target", base: 58, advance: 0, actorTraits: ["passing", "technique"], targetTraits: ["finishing", "technique"], targetState: "advanced", scoresOnSuccess: true },
            { id: "far-post", title: "CLIP TO THE FAR POST", description: "Put it in the air and trust the target to win the duel.", needsTarget: true, target: "attacker", duel: "target", base: 50, advance: 0, actorTraits: ["passing", "technique"], targetTraits: ["aerial", "power"], targetState: "advanced", aerial: true, scoresOnSuccess: true }
        ];
    }

    function eligibleTargets(action) {
        const lineup = matchDemoCards().filter(function (card) { return card !== matchBallCarrier; });
        let filtered = lineup;
        if (action.target === "wide") filtered = lineup.filter(isWideCard);
        else if (action.target === "central") filtered = lineup.filter(isCentralCard);
        else if (action.target === "attacker") filtered = lineup.filter(isAttackingCard);
        if (!filtered.length) filtered = lineup;
        return filtered;
    }

    function actionTraitBonus(card, keys, scale) {
        const traits = cardRpgTraits(card);
        const details = [];
        let sum = 0;
        (keys || []).forEach(function (key) {
            const value = traits[key] || 0;
            if (value > 0) {
                const bonus = Math.max(1, Math.round(value * (scale || 0.65)));
                sum += bonus;
                details.push(key.charAt(0).toUpperCase() + key.slice(1) + " +" + bonus);
            }
        });
        return { bonus: clamp(sum, 0, 12), details: details };
    }

    function heightAerialBonus(card) {
        const height = cardHeightCm(card);
        if (!Number.isFinite(height)) return { bonus: 0, detail: "" };
        if (height >= 198) return { bonus: 5, detail: height + " cm +5" };
        if (height >= 193) return { bonus: 4, detail: height + " cm +4" };
        if (height >= 188) return { bonus: 3, detail: height + " cm +3" };
        if (height >= 183) return { bonus: 1, detail: height + " cm +1" };
        return { bonus: 0, detail: height + " cm" };
    }

    function opponentCardScore(card, action) {
        if (!card) return 0;
        const traits = cardRpgTraits(card);
        let score = 5;
        if (action.aerial) {
            score += traits.aerial + Math.round(traits.power * 0.5);
            score += heightAerialBonus(card).bonus;
        } else if (action.id === "long-shot" || action.id === "finish" || action.id === "square") {
            score += isDefensiveCard(card) ? 5 : 1;
            score += Math.round((traits.power + traits.aerial + traits.work) * 0.35);
        } else {
            score += Math.round((traits.work + traits.pace + traits.technique) * 0.4);
            if (cardDraftCategory(card) === "midfielder") score += 2;
            if (isDefensiveCard(card)) score += 1;
        }
        const momentum = youtubeMomentum(card);
        score += Math.round(momentum.bonus * 0.25);
        return clamp(score, 3, 18);
    }

    function selectOpponentForAction(action) {
        if (!currentOpponentLineup.length) return null;
        let pool;
        if (action.aerial || action.scoresOnSuccess || action.duel === "target") {
            pool = currentOpponentLineup.filter(isDefensiveCard);
        } else {
            pool = currentOpponentLineup.filter(function (card) {
                return cardDraftCategory(card) === "midfielder" || cardDraftCategory(card) === "attacker";
            });
        }
        if (!pool.length) pool = currentOpponentLineup.slice();
        return pool.slice().sort(function (a, b) {
            return opponentCardScore(b, action) - opponentCardScore(a, action);
        })[0] || null;
    }

    function actionResolution(action, target) {
        const carrier = matchBallCarrier;
        const actor = action.duel === "target" && target ? target : carrier;
        const opponentCard = selectOpponentForAction(action);
        const actorPart = actionTraitBonus(carrier, action.actorTraits, 0.55);
        const targetPart = target ? actionTraitBonus(target, action.targetTraits, 0.45) : { bonus: 0, details: [] };
        const momentum = youtubeMomentum(actor || carrier);
        const scout = scoutInfluence(actor || carrier, null);
        const height = action.aerial && target ? heightAerialBonus(target) : { bonus: 0, detail: "" };
        const resistance = opponentCardScore(opponentCard, action);
        const total = clamp(
            action.base + actorPart.bonus + targetPart.bonus + height.bonus + Math.round(momentum.bonus * 0.6) + scout.bonus - resistance,
            18,
            88
        );
        return {
            carrier: carrier,
            actor: actor,
            target: target,
            opponent: opponentCard,
            actorPart: actorPart,
            targetPart: targetPart,
            momentum: momentum,
            scout: scout,
            height: height,
            resistance: resistance,
            chance: total
        };
    }

    function actionEventText(action, resolution) {
        const carrierName = resolution.carrier ? (resolution.carrier.dataset.name || "The player") : "The player";
        const targetName = resolution.target ? (resolution.target.dataset.name || "a teammate") : "";
        const opponentName = resolution.opponent ? (resolution.opponent.dataset.name || "the opponent") : "the opponent";
        const lines = {
            centre: carrierName + " tries to play through the middle towards " + targetName + ". " + opponentName + " steps up to press the pass.",
            wide: carrierName + " looks across the pitch and tries to release " + targetName + " on the flank. " + opponentName + " reads the switch.",
            direct: carrierName + " goes long towards " + targetName + ". " + targetName + " has to win the duel against " + opponentName + ".",
            combine: carrierName + " tries to combine quickly with " + targetName + " through midfield. " + opponentName + " attacks the passing lane.",
            release: carrierName + " releases " + targetName + " into the channel. " + opponentName + " turns to chase.",
            carry: carrierName + " keeps the ball and drives straight at " + opponentName + ".",
            through: carrierName + " slips the ball in behind for " + targetName + ". " + opponentName + " tries to track the run.",
            cross: carrierName + " delivers into the box. " + targetName + " attacks the ball against " + opponentName + ".",
            "long-shot": carrierName + " sees the opening and lets fly from distance. " + opponentName + " tries to close the shot.",
            finish: carrierName + " is in the box and takes the shot. " + opponentName + " makes the last defensive move.",
            square: carrierName + " squares the ball across goal for " + targetName + ". " + opponentName + " tries to cut it out.",
            "far-post": carrierName + " clips the ball to the far post. " + targetName + " rises against " + opponentName + "."
        };
        return lines[action.id] || carrierName + " tries the next action.";
    }

    function actionSuccessText(action, resolution) {
        const carrierName = resolution.carrier ? (resolution.carrier.dataset.name || "The player") : "The player";
        const targetName = resolution.target ? (resolution.target.dataset.name || "The teammate") : carrierName;
        if (action.scoresOnSuccess) return targetName + " FINDS THE NET!";
        return {
            centre: targetName + " receives cleanly. The press is broken.",
            wide: targetName + " controls on the flank and drives the move forward.",
            direct: targetName + " wins it and brings the attack into the final third.",
            combine: targetName + " completes the combination. Space opens ahead.",
            release: targetName + " gets beyond the next line and attacks the final third.",
            carry: carrierName + " beats the first challenge and keeps going.",
            through: targetName + " gets in behind and reaches the box.",
            cross: targetName + " wins the aerial duel and gets the ball under control in the box."
        }[action.id] || "The move continues.";
    }

    function actionFailureText(action, resolution) {
        const actorName = resolution.actor ? (resolution.actor.dataset.name || "The player") : "The player";
        const opponentName = resolution.opponent ? (resolution.opponent.dataset.name || "The opponent") : "The opponent";
        return opponentName + " wins it from " + actorName + ". TURNOVER!";
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
        if (matchDuelPhase) matchDuelPhase.textContent = config.phaseLabel || "FOOTBALL DUEL";
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

    function renderMatchScoreboard() {
        if (matchAttacks) matchAttacks.textContent = String(matchAttackCount);
        if (matchGoals) matchGoals.textContent = String(matchGoalCount);
        if (matchOpponentGoals) matchOpponentGoals.textContent = String(matchOpponentGoalCount);
        if (matchSignatures) matchSignatures.textContent = matchBallState;
    }

    function renderMatchPhaseStrip() {
        if (!matchPhaseStrip) return;
        const zones = ["own-half", "midfield", "final-third", "box"];
        Array.from(matchPhaseStrip.querySelectorAll("[data-match-phase]")).forEach(function (item) {
            const index = zones.indexOf(item.dataset.matchPhase);
            item.classList.toggle("is-current", matchAttackActive && index === matchFieldZone);
            item.classList.toggle("is-complete", matchAttackActive && index >= 0 && index < matchFieldZone);
        });
    }


    function setDecisionHeading(title, help) {
        if (matchChoiceHeading) matchChoiceHeading.hidden = false;
        if (matchPhaseTitle) matchPhaseTitle.textContent = title;
        if (matchPhaseHelp) matchPhaseHelp.textContent = help || "";
    }

    function renderActionChoices() {
        if (!matchAttackActive || !matchBallCarrier || !matchChoiceGrid) return;
        matchPendingAction = null;
        matchPendingTarget = null;
        matchChoiceGrid.innerHTML = "";
        const carrierName = matchBallCarrier.dataset.name || "Your player";
        setDecisionHeading(
            carrierName + " has the ball · " + fieldLabel(matchFieldZone),
            "Choose what " + carrierName + " should try next."
        );

        matchActionsForZone(matchFieldZone).forEach(function (action) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "game-match-rpg-action";
            button.innerHTML = '<span class="game-match-action-label">' + action.title + '</span>' +
                '<strong>' + action.description + '</strong>' +
                '<small>Uses: ' + action.actorTraits.concat(action.targetTraits).map(function (item) {
                    return item.charAt(0).toUpperCase() + item.slice(1);
                }).filter(function (item, index, all) { return all.indexOf(item) === index; }).join(" · ") + '</small>';
            button.addEventListener("click", function () {
                matchPendingAction = action;
                if (action.needsTarget) renderTargetChoices(action);
                else resolveFootballAction(action, null);
            });
            matchChoiceGrid.appendChild(button);
        });
    }

    function targetHint(card, action) {
        const traits = cardRpgTraits(card);
        const hints = [];
        if (action.aerial) {
            const height = cardHeightCm(card);
            if (Number.isFinite(height)) hints.push(height + " cm");
            if (traits.aerial) hints.push("Aerial +" + traits.aerial);
        } else {
            action.targetTraits.forEach(function (key) {
                if (traits[key]) hints.push(key.charAt(0).toUpperCase() + key.slice(1) + " +" + traits[key]);
            });
        }
        if (!hints.length) hints.push(cardDisplayPosition(card) || "No extra trait data");
        return hints.slice(0, 3).join(" · ");
    }

    function renderTargetChoices(action) {
        if (!matchChoiceGrid || !matchBallCarrier) return;
        const targets = eligibleTargets(action);
        matchChoiceGrid.innerHTML = "";
        setDecisionHeading(
            action.title + " · who are you trying to find?",
            (matchBallCarrier.dataset.name || "The player") + " has the ball. Choose the teammate for this action."
        );

        const back = document.createElement("button");
        back.type = "button";
        back.className = "game-match-rpg-back";
        back.textContent = "← Choose a different action";
        back.addEventListener("click", renderActionChoices);
        matchChoiceGrid.appendChild(back);

        targets.forEach(function (card) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "game-match-rpg-target";
            const image = cardThumbnail(card);
            button.innerHTML = (image ? '<img src="' + image + '" alt="">' : '') +
                '<span><strong>' + (card.dataset.name || "Player") + '</strong>' +
                '<small>' + targetHint(card, action) + '</small></span>';
            button.addEventListener("click", function () {
                matchPendingTarget = card;
                if (action.targetState) setPlayerState(card, action.targetState);
                resolveFootballAction(action, card);
            });
            matchChoiceGrid.appendChild(button);
        });
    }

    function appendMatchEvent(title, text, className) {
        if (!matchNarrative) return;
        matchNarrative.insertAdjacentHTML(
            "beforeend",
            '<div class="game-match-rpg-log ' + (className || "") + '"><strong>' + title + '</strong><p>' + text + '</p></div>'
        );
    }

    function finishPossession(message) {
        matchAttackActive = false;
        matchBallCarrier = null;
        matchPendingAction = null;
        matchPendingTarget = null;
        matchBallState = "Dead";
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus();
        renderOpponentStatus();
        if (matchChoiceGrid) matchChoiceGrid.innerHTML = "";
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;
        if (message) appendMatchEvent("POSSESSION OVER", message, "is-ended");
        if (startMatchAttackButton) {
            startMatchAttackButton.disabled = false;
            startMatchAttackButton.textContent = "Run another attack";
        }
    }

    function recoveryScore(card) {
        const traits = cardRpgTraits(card);
        let score = traits.pace + traits.work + Math.round(traits.power * 0.5);
        if (isDefensiveCard(card)) score += 6;
        else if (cardDraftCategory(card) === "midfielder") score += 2;
        if (getPlayerState(card) === "advanced") score -= 3;
        return score;
    }

    function opponentCounterAttacker() {
        const pool = currentOpponentLineup.filter(function (card) {
            return cardDraftCategory(card) === "attacker" || cardDraftCategory(card) === "midfielder";
        });
        const list = pool.length ? pool : currentOpponentLineup;
        return list.slice().sort(function (a, b) {
            const at = cardRpgTraits(a); const bt = cardRpgTraits(b);
            return (bt.pace + bt.finishing + bt.dribble) - (at.pace + at.finishing + at.dribble);
        })[0] || null;
    }

    function resolveCounter(turnoverTarget) {
        const lineup = matchDemoCards();
        const attacker = opponentCounterAttacker();
        let defender = turnoverTarget || null;
        if (!defender) {
            defender = lineup.slice().sort(function (a, b) { return recoveryScore(b) - recoveryScore(a); })[0] || null;
        }

        const attackerTraits = cardRpgTraits(attacker);
        const defenderTraits = cardRpgTraits(defender);
        const attackerScore = 8 + attackerTraits.pace + attackerTraits.dribble + Math.round(attackerTraits.finishing * 0.5);
        let defenderScore = 8 + recoveryScore(defender);
        const caughtHigh = defender && getPlayerState(defender) === "advanced";
        const stopChance = clamp(52 + defenderScore - attackerScore, 20, 82);
        const roll = Math.floor(Math.random() * 100) + 1;
        const stopped = roll <= stopChance;
        const attackerName = attacker ? (attacker.dataset.name || "Opponent attacker") : matchAwayClubName;
        const defenderName = defender ? (defender.dataset.name || "Your player") : "Your defence";
        const eventText = caughtHigh
            ? defenderName + " had already pushed forward for the move and now has to sprint back as " + attackerName + " breaks into the space."
            : attackerName + " breaks immediately after the turnover. " + defenderName + " is the first player able to engage.";

        matchBallState = matchAwayClubName;
        renderMatchScoreboard();
        renderMatchLineupStatus(defender ? cardSlug(defender) : "");
        renderOpponentStatus(attacker ? cardSlug(attacker) : "");

        showMatchDuel({
            phaseLabel: "TURNOVER · COUNTER ATTACK",
            title: defenderName + " vs " + attackerName,
            homeCard: defender,
            awayCard: attacker,
            homeLabel: matchHomeClubName,
            awayLabel: matchAwayClubName,
            eventText: eventText,
            success: stopped,
            resultText: stopped ? defenderName + " RECOVERS AND STOPS THE COUNTER!" : attackerName + " BREAKS THROUGH AND SCORES!",
            numbers: [
                { label: "Recovery", value: String(defenderScore), detail: caughtHigh ? "Caught high −3 · pace/work can recover" : "Position + pace + work rate" },
                { label: "Counter threat", value: String(attackerScore), detail: "Pace · dribbling · finishing" },
                { label: "Stop chance", value: stopChance + "%", emphasis: true },
                { label: "Roll", value: String(roll), detail: roll + (stopped ? " ≤ " : " > ") + stopChance }
            ]
        }, function () {
            closeMatchDuel();
            if (!stopped) matchOpponentGoalCount += 1;
            appendMatchEvent(
                stopped ? "COUNTER STOPPED" : "GOAL · " + matchAwayClubName,
                stopped ? defenderName + " gets back and kills the break." : attackerName + " punishes the turnover.",
                stopped ? "is-success" : "is-failure"
            );
            finishPossession(stopped ? "The counter is over." : "The turnover ends in an opponent goal.");
        });
    }

    function resolveFootballAction(action, target) {
        if (!matchAttackActive || !matchBallCarrier) return;
        const resolution = actionResolution(action, target);
        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= resolution.chance;
        const duelHome = resolution.actor || matchBallCarrier;
        const duelHomeName = duelHome ? (duelHome.dataset.name || "Your player") : "Your player";
        const opponentName = resolution.opponent ? (resolution.opponent.dataset.name || "Opponent") : "Opponent";
        const modifiers = resolution.actorPart.details.concat(resolution.targetPart.details);
        if (resolution.height.detail) modifiers.push("Height " + resolution.height.detail);
        if (resolution.momentum.bonus) modifiers.push(resolution.momentum.label);
        if (resolution.scout.bonus) modifiers.push("Scout +" + resolution.scout.bonus);

        renderMatchLineupStatus(duelHome ? cardSlug(duelHome) : "");
        renderOpponentStatus(resolution.opponent ? cardSlug(resolution.opponent) : "");

        showMatchDuel({
            phaseLabel: fieldLabel(matchFieldZone) + " · " + action.title,
            title: duelHomeName + " vs " + opponentName,
            homeCard: duelHome,
            awayCard: resolution.opponent,
            homeLabel: matchHomeClubName,
            awayLabel: matchAwayClubName,
            eventText: actionEventText(action, resolution),
            success: success,
            resultText: success ? actionSuccessText(action, resolution) : actionFailureText(action, resolution),
            numbers: [
                { label: "Action base", value: String(action.base), detail: action.title },
                { label: "Your modifiers", value: modifiers.length ? "+" + (resolution.actorPart.bonus + resolution.targetPart.bonus + resolution.height.bonus + Math.round(resolution.momentum.bonus * 0.6) + resolution.scout.bonus) : "+0", detail: modifiers.length ? modifiers.join(" · ") : "No supported extra trait data" },
                { label: "Opponent resistance", value: "−" + resolution.resistance, detail: opponentName },
                { label: "Success chance", value: resolution.chance + "%", emphasis: true },
                { label: "Roll", value: String(roll), detail: roll + (success ? " ≤ " : " > ") + resolution.chance }
            ]
        }, function () {
            closeMatchDuel();
            appendMatchEvent(
                action.title,
                success ? actionSuccessText(action, resolution) : actionFailureText(action, resolution),
                success ? "is-success" : "is-failure"
            );

            if (!success) {
                matchBallState = matchAwayClubName;
                renderMatchScoreboard();
                resolveCounter(target || null);
                return;
            }

            if (action.scoresOnSuccess) {
                matchGoalCount += 1;
                matchBallState = "GOAL";
                renderMatchScoreboard();
                finishPossession(matchHomeClubName + " score.");
                return;
            }

            if (target) {
                setPlayerState(matchBallCarrier, matchFieldZone === 0 ? "deep" : "normal");
                matchBallCarrier = target;
            } else if (action.targetState) {
                setPlayerState(matchBallCarrier, action.targetState);
            }

            matchFieldZone = clamp(matchFieldZone + action.advance, 0, 3);
            setPlayerState(matchBallCarrier, matchFieldZone >= 2 ? "advanced" : (matchFieldZone === 0 ? "deep" : "normal"));
            matchBallState = matchHomeClubName;
            renderMatchScoreboard();
            renderMatchPhaseStrip();
            renderMatchLineupStatus(matchBallCarrier ? cardSlug(matchBallCarrier) : "");
            renderOpponentStatus();
            renderActionChoices();
        });
    }

    function startMatchAttack() {
        if (matchAttackActive) return;
        matchAttackCount += 1;
        matchAttackActive = true;
        matchFieldZone = 0;
        matchPendingAction = null;
        matchPendingTarget = null;
        initialisePlayerStates();
        matchBallCarrier = chooseNaturalStarter();
        setPlayerState(matchBallCarrier, "deep");
        matchBallState = matchHomeClubName;

        if (startMatchAttackButton) {
            startMatchAttackButton.disabled = true;
            startMatchAttackButton.textContent = "Attack in progress";
        }
        if (matchNarrative) {
            matchNarrative.innerHTML = '<strong>POSSESSION ' + matchAttackCount + ' · ' + matchHomeClubName + ' have the ball.</strong>' +
                '<p>' + (matchBallCarrier ? (matchBallCarrier.dataset.name || "Your player") : "Your team") + ' starts the move in your own half. Choose what to do with the ball.</p>';
        }
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus(matchBallCarrier ? cardSlug(matchBallCarrier) : "");
        renderOpponentStatus();
        renderActionChoices();
    }

    function resetMatchLab() {
        closeMatchDuel();
        matchAttackCount = 0;
        matchGoalCount = 0;
        matchOpponentGoalCount = 0;
        matchAttackActive = false;
        matchFieldZone = 0;
        matchBallCarrier = null;
        matchPendingAction = null;
        matchPendingTarget = null;
        matchBallState = "Ready";
        initialisePlayerStates();
        ensureHomeClubName();
        drawOpponent();

        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus();
        renderOpponentStatus();

        if (matchChoiceGrid) matchChoiceGrid.innerHTML = "";
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;
        if (matchNarrative) {
            matchNarrative.innerHTML = '<strong>Ready to test one possession.</strong>' +
                '<p>' + matchAwayClubName + ' have been drawn. Start the attack, then make football choices with the player who has the ball.</p>';
        }
        if (startMatchAttackButton) {
            startMatchAttackButton.disabled = false;
            startMatchAttackButton.textContent = "Start test attack";
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

        await Promise.all([loadOpponentTeams(), loadGameVideoStats()]);
        resetMatchLab();

        if (matchBar) {
            matchBar.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }


    // ============================================================
    // Match Lab v0.11 — one-screen football / RPG prototype
    // ============================================================

    const RPG_TRAIT_PATTERNS = {
        pace: ["quick", "fast", "pace", "acceleration", "speed", "rapid"],
        power: ["strong", "powerful", "physical", "strength", "power"],
        passing: ["passing", "passer", "distribution", "delivery", "long balls", "long-ball"],
        vision: ["vision", "playmaker", "creative", "sees", "intelligence"],
        crossing: ["crossing", "crosses", "delivery from wide", "deliveries"],
        aerial: ["aerial", "in the air", "air duels", "aerial threat"],
        heading: ["header", "heading", "headed"],
        duels: ["duel", "duels", "1v1 defending", "one-v-one defending"],
        work: ["hardworking", "hard-working", "work rate", "relentless", "stamina", "engine"],
        pressing: ["pressing", "high press", "presses", "press"],
        dribble: ["dribbl", "ball-carry", "ball carry", "take players on", "close control", "1v1"],
        finishing: ["finishing", "goalscorer", "goal scorer", "goal threat", "clinical", "shooting", "strike", "goals"],
        technique: ["technique", "technical", "composed", "control", "first touch", "comfortable on the ball"],
        movement: ["movement", "smart runs", "well-timed", "timing", "late runs", "forward runs"],
        deep_runs: ["runs in behind", "run in behind", "deep runs", "runs into space", "forward runs", "late runs into the box", "breaking lines"],
        positioning: ["positioning", "well positioned", "reads danger", "reading the game", "offside line"],
        marking: ["marking", "marker", "tracks runners", "tracking runners"],
        ball_playing: ["ball-playing", "ball playing", "from the back", "comfortable on the ball", "distribution from the back"],
        set_piece: ["set-piece", "set piece", "free kick", "free-kick", "dead-ball", "dead ball"]
    };

    function normaliseTraitToken(value) {
        return String(value || "").toLowerCase().replace(/[_-]+/g, " ").trim();
    }

    function traitText(card) {
        const summary = cardSummaryText(card);
        const explicit = cardTraits(card).map(normaliseTraitToken).join(" ");
        return (summary + " " + explicit).trim();
    }

    function cardRpgTraits(card) {
        const text = traitText(card);
        const traits = {};
        Object.keys(RPG_TRAIT_PATTERNS).forEach(function (key) {
            const hits = RPG_TRAIT_PATTERNS[key].reduce(function (count, pattern) {
                return count + (text.includes(pattern) ? 1 : 0);
            }, 0);
            traits[key] = clamp(hits * 3, 0, 9);
        });

        // Structured fields are facts, not inferred ability. They only add to directly relevant traits.
        const twoFooted = String(card && card.dataset.twoFootedAbility ? card.dataset.twoFootedAbility : "").toLowerCase();
        if (twoFooted === "reliable") traits.technique = clamp(traits.technique + 1, 0, 9);
        if (twoFooted === "strong") traits.technique = clamp(traits.technique + 2, 0, 9);
        if (twoFooted === "genuine") traits.technique = clamp(traits.technique + 3, 0, 9);

        return traits;
    }

    function youtubeCardPower(card) {
        if (!card) return { score: null, impact: 0, label: "YouTube NO EFFECT", metrics: [] };
        const data = Object.assign({}, cardSeedData(card), getStoredStats(card));
        const engine = calculateCardEngine(card, data);
        const index = Number.isFinite(engine.matchIndex) ? engine.matchIndex : engine.baseIndex;
        if (!Number.isFinite(index)) {
            return { score: null, impact: 0, label: "YouTube NO EFFECT", metrics: [] };
        }
        const metrics = [];
        [
            ["Reach", engine.metrics.reach],
            ["Depth", engine.metrics.depth],
            ["Response", engine.metrics.response],
            ["Heat", engine.metrics.heat],
            ["Staying", engine.metrics.staying]
        ].forEach(function (entry) {
            if (entry[1] && Number.isFinite(entry[1].score)) metrics.push(entry[0] + " " + Math.round(entry[1].score));
        });
        // Deliberately substantial: a 0–100 YouTube match index can swing an outcome by ±16.
        const impact = Math.round((index - 50) * 0.32);
        return {
            score: Math.round(index),
            impact: clamp(impact, -16, 16),
            label: "YouTube " + Math.round(index),
            metrics: metrics
        };
    }

    function shortPower(event) {
        if (!event) return { score: null, impact: 0, label: "Short data NO EFFECT" };
        const parts = [];
        if (Number.isFinite(Number(event.views)) && Number(event.views) > 0) {
            const views = Number(event.views);
            parts.push(clamp(40 + 18 * Math.log2(Math.max(views / 1000, 0.125)), 5, 100));
        }
        if (Number.isFinite(Number(event.likes)) && Number(event.likes) >= 0 && Number(event.views) > 0) {
            const rate = Number(event.likes) / Number(event.views);
            parts.push(clamp((rate / 0.08) * 100, 0, 100));
        }
        if (Number.isFinite(Number(event.watch_hours)) && Number(event.watch_hours) >= 0 && Number(event.views) > 0) {
            const minPerView = Number(event.watch_hours) * 60 / Number(event.views);
            parts.push(clamp(25 + 18 * Math.log2(1 + minPerView / 0.5), 0, 100));
        }
        if (Number.isFinite(Number(event.average_viewed_pct))) {
            parts.push(clamp(Number(event.average_viewed_pct), 0, 100));
        }
        if (Number.isFinite(Number(event.views_48h)) && Number(event.views_48h) > 0) {
            parts.push(clamp(20 + 18 * Math.log2(1 + Number(event.views_48h)), 0, 100));
        }
        if (!parts.length) return { score: null, impact: 0, label: "Short data NO EFFECT" };
        const score = parts.reduce(function (a, b) { return a + b; }, 0) / parts.length;
        // Short metrics are intentionally powerful once the signature move is available.
        return { score: Math.round(score), impact: Math.round(score * 0.36), label: "Short power " + Math.round(score) };
    }

    function defensivePostureForOpponent() {
        const style = currentOpponent ? String(currentOpponent.style || "Balanced") : "Balanced";
        if (style === "High Press") return "step_up";
        if (style === "Low Block") return "drop";
        if (style === "Counter Attack") return "compact";
        if (style === "Crosses & Aerial Threat") return "hold";
        return randomItem(["hold", "step_up", "drop", "compact"]);
    }

    function postureLabel(posture) {
        return {
            step_up: "STEP UP",
            drop: "DROP DEEP",
            compact: "STAY COMPACT",
            hold: "HOLD THE LINE"
        }[posture] || "HOLD THE LINE";
    }

    function actionPostureEffect(type, posture) {
        const table = {
            through: { step_up: 8, drop: -8, compact: -2, hold: 3 },
            wide: { step_up: 2, drop: 4, compact: 7, hold: 2 },
            support: { step_up: -2, drop: 6, compact: 1, hold: 3 },
            feet: { step_up: -3, drop: 5, compact: 2, hold: 2 },
            direct: { step_up: 7, drop: -6, compact: -2, hold: 1 },
            carry: { step_up: -4, drop: 5, compact: -2, hold: 2 },
            cross: { step_up: 1, drop: 2, compact: 5, hold: 0 },
            cutback: { step_up: 2, drop: 5, compact: -1, hold: 2 },
            shot: { step_up: -2, drop: 5, compact: -3, hold: 1 },
            signature: { step_up: 0, drop: 0, compact: 0, hold: 0 }
        };
        return (table[type] && Number.isFinite(table[type][posture])) ? table[type][posture] : 0;
    }

    function playerMoveScore(card, keys) {
        const traits = cardRpgTraits(card);
        return (keys || []).reduce(function (sum, key) { return sum + (traits[key] || 0); }, 0);
    }

    function targetMovementScore(card) {
        const traits = cardRpgTraits(card);
        return traits.deep_runs + traits.movement + Math.round(traits.pace * 0.55);
    }

    function moveTargetEligible(move, target) {
        if (!target || target === matchBallCarrier) return false;
        if (move.targetKind === "wide") return isWideCard(target);
        if (move.targetKind === "attacker") return isAttackingCard(target);
        if (move.targetKind === "central") return isCentralCard(target);
        return true;
    }

    function buildMove(type, target, opts) {
        return Object.assign({
            id: type + "-" + (target ? cardSlug(target) : "self"),
            type: type,
            target: target || null,
            title: "",
            description: "",
            actorTraits: [],
            targetTraits: [],
            targetKind: "any",
            advance: 1,
            base: 48,
            aerialContext: null,
            scoresOnSuccess: false,
            positionState: null
        }, opts || {});
    }

    function chooseNaturalStarter() {
        const lineup = matchDemoCards().slice();
        if (!lineup.length) return null;
        const ranked = lineup.map(function (card) {
            const traits = cardRpgTraits(card);
            const category = cardDraftCategory(card);
            let score = traits.passing + traits.vision + traits.ball_playing + traits.technique * 0.5;
            // Position shapes who is likely to receive the first ball; it is not an ability bonus.
            if (category === "defender") score += 4;
            else if (category === "midfielder") score += 3;
            return { card: card, score: score + Math.random() * 5 };
        }).sort(function (a, b) { return b.score - a.score; });
        // Do not force the same restart every possession: choose among the three most plausible starters.
        return randomItem(ranked.slice(0, Math.min(3, ranked.length))).card;
    }

    function generatedTeamMoves() {
        if (!matchBallCarrier) return [];
        const carrier = matchBallCarrier;
        const lineup = matchDemoCards();
        const carrierTraits = cardRpgTraits(carrier);
        const moves = [];

        lineup.forEach(function (target) {
            if (target === carrier) return;
            const name = target.dataset.name || "teammate";
            const tt = cardRpgTraits(target);

            // Creator + runner: a real team combination, not a generic card duel.
            if ((carrierTraits.vision + carrierTraits.passing >= 4) && targetMovementScore(target) >= 4 && matchFieldZone >= 1) {
                moves.push(buildMove("through", target, {
                    title: (carrier.dataset.name || "The passer") + " SEES " + name.toUpperCase() + "'S RUN",
                    description: "Try the pass into the space behind the defensive line.",
                    actorTraits: ["vision", "passing"], targetTraits: ["deep_runs", "movement", "pace"], targetKind: "any",
                    base: 48, advance: matchFieldZone >= 2 ? 1 : 2, positionState: "advanced"
                }));
            }

            if (isWideCard(target) && matchFieldZone <= 2) {
                moves.push(buildMove("wide", target, {
                    title: "RELEASE " + name.toUpperCase() + " WIDE",
                    description: "Use width and let the wide player attack the next line.",
                    actorTraits: ["passing", "vision"], targetTraits: ["pace", "dribble", "crossing"], targetKind: "wide",
                    base: 50, advance: 1, positionState: "advanced"
                }));
            }

            if ((tt.passing + tt.technique + tt.ball_playing >= 3) && matchFieldZone <= 2) {
                moves.push(buildMove("support", target, {
                    title: name.toUpperCase() + " IS IN SUPPORT",
                    description: "Keep the move connected and play through a technical teammate.",
                    actorTraits: ["passing", "technique"], targetTraits: ["passing", "technique", "ball_playing"],
                    base: 55, advance: 1
                }));
            }

            if (isAttackingCard(target)) {
                moves.push(buildMove("feet", target, {
                    title: "PLAY INTO " + name.toUpperCase() + "'S FEET",
                    description: "Find the forward and let the team play off the next action.",
                    actorTraits: ["passing", "vision"], targetTraits: ["technique", "power", "movement"], targetKind: "attacker",
                    base: 53, advance: matchFieldZone >= 2 ? 1 : 1
                }));

                const h = cardHeightCm(target);
                if ((Number.isFinite(h) && h >= 188) || tt.aerial || tt.heading || tt.power) {
                    moves.push(buildMove("direct", target, {
                        title: "GO LONG TO " + name.toUpperCase(),
                        description: "Bypass pressure and contest the first ball.",
                        actorTraits: ["passing", "power"], targetTraits: ["aerial", "heading", "duels", "power"], targetKind: "attacker",
                        base: 45, advance: 2, aerialContext: "long-ball", positionState: "advanced"
                    }));
                }
            }

            if (matchFieldZone >= 2 && isAttackingCard(target)) {
                moves.push(buildMove("cross", target, {
                    title: "DELIVER FOR " + name.toUpperCase(),
                    description: "Put a quality ball into the box for a moving target.",
                    actorTraits: ["crossing", "passing", "vision"], targetTraits: ["movement", "deep_runs", "aerial", "heading", "finishing"], targetKind: "attacker",
                    base: 43, advance: 1, aerialContext: "cross", positionState: "advanced", scoresOnSuccess: matchFieldZone >= 3
                }));
            }

            if (matchFieldZone >= 3 && (tt.finishing || tt.movement || isAttackingCard(target))) {
                moves.push(buildMove("cutback", target, {
                    title: "CUT IT BACK TO " + name.toUpperCase(),
                    description: "Find the arriving runner instead of forcing the aerial duel.",
                    actorTraits: ["passing", "crossing", "vision"], targetTraits: ["movement", "finishing", "technique"],
                    base: 55, advance: 0, scoresOnSuccess: true
                }));
            }
        });

        if (carrierTraits.dribble || carrierTraits.pace || carrierTraits.power) {
            moves.push(buildMove("carry", null, {
                title: (carrier.dataset.name || "PLAYER").toUpperCase() + " DRIVES FORWARD",
                description: "Keep the ball and attack the defender directly.",
                actorTraits: ["dribble", "pace", "power", "technique"], base: 50, advance: 1, positionState: "advanced"
            }));
        }

        if (matchFieldZone >= 2 && (carrierTraits.finishing || carrierTraits.power || carrierTraits.technique)) {
            moves.push(buildMove("shot", null, {
                title: "TAKE THE SHOT",
                description: matchFieldZone >= 3 ? "The goal is there. Back the player on the ball." : "Try to beat the defence from range.",
                actorTraits: ["finishing", "power", "technique"], base: matchFieldZone >= 3 ? 54 : 34,
                advance: 0, scoresOnSuccess: true
            }));
        }

        // Score moves so the visible choices are created by the actual five cards.
        moves.forEach(function (move) {
            move.choiceScore = move.base + playerMoveScore(carrier, move.actorTraits) * 0.7 +
                (move.target ? playerMoveScore(move.target, move.targetTraits) * 0.55 : 0) +
                actionPostureEffect(move.type, matchDefensivePosture);
        });

        const unique = [];
        const seen = new Set();
        moves.sort(function (a, b) { return b.choiceScore - a.choiceScore; }).forEach(function (move) {
            const key = move.type + "|" + (move.target ? cardSlug(move.target) : "self");
            if (!seen.has(key)) { seen.add(key); unique.push(move); }
        });
        return unique.slice(0, 5);
    }

    function signatureContextEligible(event) {
        if (!event || !matchBallCarrier) return false;
        if (event.player_slug !== cardSlug(matchBallCarrier)) return false;
        const tags = (event.event_tags || []).map(function (tag) { return String(tag).toLowerCase(); });
        if (tags.some(function (tag) { return ["nutmeg", "dribbling", "body-feint", "acceleration"].includes(tag); })) {
            return matchFieldZone >= 1 && matchFieldZone <= 2;
        }
        if (tags.some(function (tag) { return ["volley", "flick", "goal", "first-touch"].includes(tag); })) {
            return matchFieldZone >= 2;
        }
        if (tags.some(function (tag) { return ["free-kick", "set-piece"].includes(tag); })) {
            return matchFieldZone >= 2 && (matchMinute % 7 <= 1); // rare contextual dead-ball window in this prototype
        }
        return false;
    }

    function availableSignatureMove() {
        const candidates = signatureEvents.filter(signatureContextEligible);
        if (!candidates.length) return null;
        const event = candidates[0];
        const key = event.id + "|" + matchPossessionNo + "|" + matchFieldZone + "|" + cardSlug(matchBallCarrier);
        if (matchSignatureRolls.has(key)) return null;
        matchSignatureRolls.add(key);
        const power = shortPower(event);
        const triggerChance = clamp(12 + Math.round((power.score || 0) * 0.42), 12, 58);
        if ((Math.floor(Math.random() * 100) + 1) > triggerChance) return null;
        const tags = (event.event_tags || []).map(function (tag) { return String(tag).toLowerCase(); });
        const scoring = tags.some(function (tag) { return ["goal", "volley", "free-kick"].includes(tag); });
        return buildMove("signature", null, {
            id: "signature-" + event.id,
            title: "✨ SIGNATURE · " + String(event.title || "SPECIAL MOVE").toUpperCase(),
            description: event.description || "A documented SkyrScout signature action becomes available.",
            actorTraits: tags.some(function (tag) { return ["nutmeg", "dribbling", "body-feint", "acceleration"].includes(tag); })
                ? ["dribble", "pace", "technique"]
                : ["technique", "finishing", "set_piece"],
            base: scoring ? 42 : 48,
            advance: scoring ? 0 : 1,
            scoresOnSuccess: scoring,
            signatureEvent: event,
            signaturePower: power
        });
    }

    function relevantOpponentPool(move) {
        if (!currentOpponentLineup.length) return [];
        if (move.type === "through" || move.type === "cross" || move.type === "direct" || move.type === "cutback" || move.scoresOnSuccess) {
            const defs = currentOpponentLineup.filter(isDefensiveCard);
            return defs.length ? defs : currentOpponentLineup.slice();
        }
        if (move.type === "wide") {
            const wide = currentOpponentLineup.filter(isWideCard);
            return wide.length ? wide : currentOpponentLineup.slice();
        }
        const mids = currentOpponentLineup.filter(function (card) {
            return cardDraftCategory(card) === "midfielder" || isDefensiveCard(card);
        });
        return mids.length ? mids : currentOpponentLineup.slice();
    }

    function defensiveTraitKeys(move) {
        if (move.aerialContext === "long-ball") return ["aerial", "heading", "duels", "power", "positioning"];
        if (move.aerialContext === "cross") return ["positioning", "marking", "aerial", "heading", "duels"];
        if (move.type === "through") return ["positioning", "marking", "pace"];
        if (move.type === "wide" || move.type === "carry" || move.type === "signature") return ["duels", "pace", "positioning"];
        if (move.type === "shot" || move.type === "cutback") return ["positioning", "marking", "duels"];
        return ["pressing", "work", "positioning", "duels"];
    }

    function aerialHeightEffect(attacker, defender, context) {
        const ah = cardHeightCm(attacker);
        const dh = cardHeightCm(defender);
        if (!Number.isFinite(ah) || !Number.isFinite(dh)) return { home: 0, away: 0, label: "Height: NO EFFECT" };
        const diff = ah - dh;
        const weight = context === "long-ball" ? 0.22 : 0.10; // height matters more on static first balls than moving crosses
        const swing = clamp(Math.round(diff * weight), -5, 5);
        return {
            home: Math.max(0, swing),
            away: Math.max(0, -swing),
            label: ah + " vs " + dh + " cm" + (context === "cross" ? " · movement matters more on the cross" : " · height matters on the first ball")
        };
    }

    function opponentDefenceScore(card, move) {
        if (!card) return { score: 0, details: [], youtube: youtubeCardPower(null) };
        const traits = cardRpgTraits(card);
        const keys = defensiveTraitKeys(move);
        let score = 0;
        const details = [];
        keys.forEach(function (key) {
            if (traits[key] > 0) {
                const add = Math.round(traits[key] * 0.65);
                score += add;
                details.push(key.replace("_", " ") + " +" + add);
            }
        });
        const yt = youtubeCardPower(card);
        score += yt.impact;
        return { score: score, details: details, youtube: yt };
    }

    function selectOpponentForMove(move) {
        const pool = relevantOpponentPool(move);
        if (!pool.length) return null;
        return pool.slice().sort(function (a, b) {
            return opponentDefenceScore(b, move).score - opponentDefenceScore(a, move).score;
        })[0];
    }

    function moveResolution(move) {
        const carrier = matchBallCarrier;
        const target = move.target;
        const attacker = (move.type === "through" || move.type === "direct" || move.type === "cross" || move.type === "cutback") && target ? target : carrier;
        const opponent = selectOpponentForMove(move);
        const actorTraits = actionTraitBonus(carrier, move.actorTraits, 0.58);
        const targetTraits = target ? actionTraitBonus(target, move.targetTraits, 0.48) : { bonus: 0, details: [] };
        const carrierYT = youtubeCardPower(carrier);
        const targetYT = target ? youtubeCardPower(target) : { score: null, impact: 0, label: "Target YouTube NO EFFECT", metrics: [] };
        const defence = opponentDefenceScore(opponent, move);
        const posture = actionPostureEffect(move.type, matchDefensivePosture);
        const synergyRaw = actorTraits.bonus + targetTraits.bonus;
        const synergy = clamp(Math.round(synergyRaw * 0.75), 0, 14);
        const youtubeAttack = carrierYT.impact + Math.round(targetYT.impact * 0.55);
        const height = move.aerialContext && target ? aerialHeightEffect(target, opponent, move.aerialContext) : { home: 0, away: 0, label: "" };
        const signature = move.signatureEvent ? (move.signaturePower || shortPower(move.signatureEvent)) : { score: null, impact: 0, label: "" };
        const breakCarry = matchBreakBonus;
        const chance = clamp(
            move.base + youtubeAttack - defence.score + synergy + posture + height.home - height.away + signature.impact + breakCarry,
            12,
            92
        );
        const breakReady = synergy >= 7 && posture >= 3;
        return {
            carrier: carrier, target: target, attacker: attacker, opponent: opponent,
            actorTraits: actorTraits, targetTraits: targetTraits,
            carrierYT: carrierYT, targetYT: targetYT, defence: defence,
            posture: posture, synergy: synergy, youtubeAttack: youtubeAttack,
            height: height, signature: signature, breakCarry: breakCarry,
            chance: chance, breakReady: breakReady
        };
    }

    function opponentStyleNarrative() {
        const style = currentOpponent ? currentOpponent.style : "Balanced";
        return style + " · " + postureLabel(matchDefensivePosture);
    }

    function flashLivePanel() {
        if (!matchLivePanel) return;
        matchLivePanel.classList.remove("is-live-now");
        void matchLivePanel.offsetWidth;
        matchLivePanel.classList.add("is-live-now");
    }

    function setCurrentNarrative(title, text, badge) {
        if (!matchNarrative) return;
        matchNarrative.innerHTML = '<span class="game-match-now">' + (badge || "NOW") + '</span><strong>' + title + '</strong><p>' + text + '</p>';
        flashLivePanel();
    }

    function advanceMatchClock(minimum, maximum) {
        if (matchEnded) return;
        const add = minimum + Math.floor(Math.random() * (Math.max(minimum, maximum) - minimum + 1));
        matchMinute = Math.min(90, matchMinute + add);
        if (matchMinute >= 90) matchEnded = true;
        renderMatchScoreboard();
    }

    function renderMatchScoreboard() {
        if (matchGoals) matchGoals.textContent = String(matchGoalCount);
        if (matchOpponentGoals) matchOpponentGoals.textContent = String(matchOpponentGoalCount);
        if (matchMinuteEl) matchMinuteEl.textContent = (matchEnded ? "FT" : matchMinute + "'");
        if (matchSignatures) matchSignatures.textContent = matchEnded ? "FULL TIME" : (matchBallState || "KICK-OFF");
    }

    function renderMatchPhaseStrip() {
        if (!matchPhaseStrip) return;
        const zones = ["own-half", "midfield", "final-third", "box"];
        Array.from(matchPhaseStrip.querySelectorAll("[data-match-phase]")).forEach(function (item) {
            const index = zones.indexOf(item.dataset.matchPhase);
            item.classList.toggle("is-current", matchAttackActive && index === matchFieldZone);
            item.classList.toggle("is-complete", matchAttackActive && index >= 0 && index < matchFieldZone);
        });
    }

    function moveHint(move) {
        const bits = [];
        if (move.target) bits.push((move.target.dataset.name || "Teammate"));
        const posture = actionPostureEffect(move.type, matchDefensivePosture);
        if (posture >= 4) bits.push("MATCHUP +");
        if (posture <= -4) bits.push("MATCHUP −");
        if (move.signatureEvent) bits.push(move.signaturePower && Number.isFinite(move.signaturePower.score) ? "Short " + move.signaturePower.score : "Signature");
        return bits.join(" · ");
    }

    function renderActionChoices() {
        if (!matchAttackActive || !matchBallCarrier || !matchChoiceGrid || matchEnded) return;
        matchChoiceGrid.innerHTML = "";
        const carrierName = matchBallCarrier.dataset.name || "Your player";
        setDecisionHeading(
            carrierName + " has the ball · " + fieldLabel(matchFieldZone),
            "Choose the football action. The available moves come from this five-player team's supported traits."
        );
        setCurrentNarrative(
            carrierName + " has possession.",
            "Your teammates move around him. " + opponentStyleNarrative() + ". Choose the move that best uses this team.",
            "NOW · " + fieldLabel(matchFieldZone)
        );

        const signature = availableSignatureMove();
        const moves = generatedTeamMoves();
        if (signature) moves.unshift(signature);

        moves.slice(0, 5).forEach(function (move) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "game-match-rpg-action" + (move.signatureEvent ? " is-signature" : "");
            button.innerHTML = '<span class="game-match-action-label">' + move.title + '</span>' +
                '<strong>' + move.description + '</strong>' +
                '<small>' + (moveHint(move) || "Team move") + '</small>';
            button.addEventListener("click", function () { resolveTeamMove(move); });
            matchChoiceGrid.appendChild(button);
        });
    }

    function moveEventText(move, resolution) {
        const carrier = resolution.carrier ? resolution.carrier.dataset.name : "The ball carrier";
        const target = resolution.target ? resolution.target.dataset.name : "";
        const opp = resolution.opponent ? resolution.opponent.dataset.name : "the defender";
        if (move.signatureEvent) return move.signatureEvent.description || carrier + " tries the signature move.";
        const map = {
            through: carrier + " sees " + target + " attack the space behind. " + opp + " has to read the run and react.",
            wide: carrier + " switches the point of attack towards " + target + ". " + opp + " moves across to engage.",
            support: target + " offers underneath. " + carrier + " tries to connect the move before " + opp + " closes the lane.",
            feet: carrier + " finds " + target + " to feet. " + opp + " decides whether to step in or hold position.",
            direct: carrier + " goes long towards " + target + ". The first ball is contested against " + opp + ".",
            carry: carrier + " carries the ball straight at " + opp + ".",
            cross: carrier + " delivers into the box as " + target + " attacks the space around " + opp + ".",
            cutback: carrier + " pulls the ball back towards " + target + " as " + opp + " tries to close the lane.",
            shot: carrier + " takes aim as " + opp + " tries to get across the shot."
        };
        return map[move.type] || carrier + " tries to progress the move.";
    }

    function moveSuccessText(move, resolution) {
        const carrier = resolution.carrier ? resolution.carrier.dataset.name : "The player";
        const target = resolution.target ? resolution.target.dataset.name : carrier;
        if (move.signatureEvent) return "SIGNATURE MOVE LANDS!";
        if (move.scoresOnSuccess) return target + " SCORES!";
        return {
            through: target + " is in behind!",
            wide: target + " receives in space on the flank.",
            support: target + " keeps the move flowing.",
            feet: target + " secures the ball and links the attack.",
            direct: target + " wins the first ball.",
            carry: carrier + " beats the pressure and drives on.",
            cross: target + " wins the attacking moment in the box.",
            cutback: target + " arrives onto the cutback.",
            shot: carrier + " finds the net!"
        }[move.type] || "The move works.";
    }

    function moveFailureText(move, resolution) {
        const opp = resolution.opponent ? resolution.opponent.dataset.name : "The opponent";
        return opp + " breaks the move. TURNOVER!";
    }

    function outcomeNumbers(move, resolution) {
        const items = [];
        const ytDetails = [];
        if (Number.isFinite(resolution.carrierYT.score)) ytDetails.push((resolution.carrier.dataset.name || "Carrier") + " " + resolution.carrierYT.score);
        if (resolution.target && Number.isFinite(resolution.targetYT.score)) ytDetails.push((resolution.target.dataset.name || "Target") + " " + resolution.targetYT.score);
        items.push({ label: "YouTube", value: (resolution.youtubeAttack >= 0 ? "+" : "") + resolution.youtubeAttack, detail: ytDetails.length ? ytDetails.join(" · ") : "NO EFFECT" });
        items.push({ label: "Team synergy", value: "+" + resolution.synergy, detail: resolution.actorTraits.details.concat(resolution.targetTraits.details).join(" · ") || "NO EFFECT" });
        items.push({ label: "Tactical matchup", value: (resolution.posture >= 0 ? "+" : "") + resolution.posture, detail: postureLabel(matchDefensivePosture) });
        if (move.aerialContext) items.push({ label: "Aerial context", value: (resolution.height.home - resolution.height.away >= 0 ? "+" : "") + (resolution.height.home - resolution.height.away), detail: resolution.height.label });
        if (move.signatureEvent) items.push({ label: "Signature Short", value: "+" + resolution.signature.impact, detail: resolution.signature.label });
        items.push({ label: "Opponent", value: (resolution.defence.score >= 0 ? "−" : "+") + Math.abs(resolution.defence.score), detail: resolution.defence.details.join(" · ") || (Number.isFinite(resolution.defence.youtube.score) ? resolution.defence.youtube.label : "scouting traits: NO EFFECT") });
        items.push({ label: "Chance", value: resolution.chance + "%", emphasis: true, detail: "YouTube has substantial outcome weight" });
        return items;
    }

    function startNextPossession() {
        if (matchEnded || matchMinute >= 90) { endFullMatch(); return; }
        matchPossessionNo += 1;
        matchAttackActive = true;
        matchFieldZone = 0;
        matchBreakBonus = 0;
        initialisePlayerStates();
        matchBallCarrier = chooseNaturalStarter();
        setPlayerState(matchBallCarrier, "deep");
        matchBallState = matchHomeClubName;
        advanceMatchClock(1, 2);
        renderMatchLineupStatus(matchBallCarrier ? cardSlug(matchBallCarrier) : "");
        renderOpponentStatus();
        renderMatchPhaseStrip();
        renderMatchScoreboard();
        renderActionChoices();
    }

    function finishPossession(message) {
        matchAttackActive = false;
        matchBallCarrier = null;
        matchPendingAction = null;
        matchPendingTarget = null;
        matchBreakBonus = 0;
        if (matchEnded || matchMinute >= 90) { endFullMatch(); return; }
        matchBallState = "RESET";
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus();
        renderOpponentStatus();
        if (matchChoiceHeading) matchChoiceHeading.hidden = false;
        if (matchPhaseTitle) matchPhaseTitle.textContent = message || "The possession is over.";
        if (matchPhaseHelp) matchPhaseHelp.textContent = "The clock is running. Continue to the next possession.";
        setCurrentNarrative("Possession over.", message || "The teams reset.", "RESET");
        if (matchChoiceGrid) {
            matchChoiceGrid.innerHTML = "";
            const next = document.createElement("button");
            next.type = "button";
            next.className = "game-match-rpg-action game-match-next-possession";
            next.innerHTML = '<span class="game-match-action-label">NEXT POSSESSION</span><strong>Continue the match</strong><small>' + matchMinute + "' · " + matchGoalCount + "–" + matchOpponentGoalCount + '</small>';
            next.addEventListener("click", startNextPossession);
            matchChoiceGrid.appendChild(next);
        }
    }

    function resolveCounter(turnoverTarget) {
        const lineup = matchDemoCards();
        const attacker = opponentCounterAttacker();
        let defender = turnoverTarget || lineup.slice().sort(function (a, b) { return recoveryScore(b) - recoveryScore(a); })[0] || null;
        const attTraits = cardRpgTraits(attacker);
        const defTraits = cardRpgTraits(defender);
        const attYT = youtubeCardPower(attacker);
        const defYT = youtubeCardPower(defender);
        const caughtHigh = defender && getPlayerState(defender) === "advanced";
        const attackerScore = (attTraits.pace + attTraits.dribble + attTraits.finishing) + attYT.impact;
        const defenderKnown = defTraits.pace + defTraits.work + defTraits.positioning + defTraits.duels;
        const defenderScore = defenderKnown + defYT.impact - (caughtHigh ? 7 : 0);
        const stopChance = clamp(50 + defenderScore - attackerScore, 16, 84);
        const roll = Math.floor(Math.random() * 100) + 1;
        const stopped = roll <= stopChance;
        const attackerName = attacker ? attacker.dataset.name : "Opponent attacker";
        const defenderName = defender ? defender.dataset.name : "Your defence";
        advanceMatchClock(2, 4);
        matchBallState = matchAwayClubName;
        renderMatchLineupStatus(defender ? cardSlug(defender) : "");
        renderOpponentStatus(attacker ? cardSlug(attacker) : "");
        renderMatchScoreboard();

        showMatchDuel({
            phaseLabel: "TURNOVER · COUNTER",
            title: defenderName + " vs " + attackerName,
            homeCard: defender,
            awayCard: attacker,
            homeLabel: matchHomeClubName,
            awayLabel: matchAwayClubName,
            eventText: caughtHigh
                ? defenderName + " was committed forward and must recover as " + attackerName + " attacks the space."
                : attackerName + " attacks immediately after the turnover. " + defenderName + " is first able to engage.",
            success: stopped,
            resultText: stopped ? defenderName + " STOPS THE COUNTER!" : attackerName + " SCORES ON THE BREAK!",
            numbers: [
                { label: "Your YouTube", value: (defYT.impact >= 0 ? "+" : "") + defYT.impact, detail: defYT.label },
                { label: "Recovery traits", value: "+" + defenderKnown, detail: caughtHigh ? "Caught high −7" : "Pace · work · positioning · duels" },
                { label: "Opponent YouTube", value: (attYT.impact >= 0 ? "+" : "") + attYT.impact, detail: attYT.label },
                { label: "Stop chance", value: stopChance + "%", emphasis: true }
            ]
        }, function () {
            closeMatchDuel();
            if (!stopped) matchOpponentGoalCount += 1;
            renderMatchScoreboard();
            finishPossession(stopped ? "The counter is stopped." : matchAwayClubName + " punish the turnover.");
        });
    }

    function resolveTeamMove(move) {
        if (!matchAttackActive || !matchBallCarrier || matchEnded) return;
        const resolution = moveResolution(move);
        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= resolution.chance;
        const actor = resolution.attacker || matchBallCarrier;
        const actorName = actor ? actor.dataset.name : "Your player";
        const opponentName = resolution.opponent ? resolution.opponent.dataset.name : "Opponent";
        advanceMatchClock(move.scoresOnSuccess ? 2 : 2, move.scoresOnSuccess ? 4 : 5);
        renderMatchLineupStatus(actor ? cardSlug(actor) : "");
        renderOpponentStatus(resolution.opponent ? cardSlug(resolution.opponent) : "");

        const breakTriggered = success && !move.signatureEvent && resolution.breakReady;
        showMatchDuel({
            phaseLabel: (move.signatureEvent ? "✨ SIGNATURE MOVE" : fieldLabel(matchFieldZone) + " · TEAM MOVE"),
            title: actorName + " vs " + opponentName,
            homeCard: actor,
            awayCard: resolution.opponent,
            homeLabel: matchHomeClubName,
            awayLabel: matchAwayClubName,
            eventText: moveEventText(move, resolution),
            success: success,
            resultText: success
                ? (breakTriggered ? "💥 BREAK! · " + moveSuccessText(move, resolution) : moveSuccessText(move, resolution))
                : moveFailureText(move, resolution),
            numbers: outcomeNumbers(move, resolution)
        }, function () {
            closeMatchDuel();
            if (!success) {
                matchBallState = matchAwayClubName;
                renderMatchScoreboard();
                resolveCounter(move.target || actor || null);
                return;
            }

            if (move.scoresOnSuccess) {
                matchGoalCount += 1;
                matchBallState = "GOAL";
                renderMatchScoreboard();
                finishPossession(matchHomeClubName + " score through " + actorName + ".");
                return;
            }

            if (move.target) {
                if (move.positionState) setPlayerState(move.target, move.positionState);
                setPlayerState(matchBallCarrier, matchFieldZone === 0 ? "deep" : "normal");
                matchBallCarrier = move.target;
            } else if (move.positionState) {
                setPlayerState(matchBallCarrier, move.positionState);
            }
            matchFieldZone = clamp(matchFieldZone + move.advance + (breakTriggered ? 1 : 0), 0, 3);
            if (breakTriggered) matchBreakBonus = 8;
            else matchBreakBonus = Math.max(0, matchBreakBonus - 3);
            setPlayerState(matchBallCarrier, matchFieldZone >= 2 ? "advanced" : (matchFieldZone === 0 ? "deep" : "normal"));
            matchBallState = breakTriggered ? "BREAK!" : matchHomeClubName;
            renderMatchScoreboard();
            renderMatchPhaseStrip();
            renderMatchLineupStatus(matchBallCarrier ? cardSlug(matchBallCarrier) : "");
            renderOpponentStatus();
            renderActionChoices();
        });
    }

    function endFullMatch() {
        matchEnded = true;
        matchMinute = 90;
        matchAttackActive = false;
        matchBallState = "FULL TIME";
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus();
        renderOpponentStatus();
        const result = matchGoalCount === matchOpponentGoalCount ? "DRAW" : (matchGoalCount > matchOpponentGoalCount ? "YOU WIN" : "YOU LOSE");
        setCurrentNarrative("FULL TIME · " + result, matchHomeClubName + " " + matchGoalCount + "–" + matchOpponentGoalCount + " " + matchAwayClubName + ".", "FT");
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;
        if (matchChoiceGrid) {
            matchChoiceGrid.innerHTML = "";
            const restart = document.createElement("button");
            restart.type = "button";
            restart.className = "game-match-rpg-action";
            restart.innerHTML = '<span class="game-match-action-label">NEW MATCH</span><strong>Draw another opponent</strong><small>Keep testing the system</small>';
            restart.addEventListener("click", resetMatchLab);
            matchChoiceGrid.appendChild(restart);
        }
    }

    function startMatchAttack() {
        if (matchAttackActive || matchEnded) return;
        if (matchStartActions) matchStartActions.hidden = true;
        startNextPossession();
    }

    function resetMatchLab() {
        closeMatchDuel();
        matchAttackCount = 0;
        matchGoalCount = 0;
        matchOpponentGoalCount = 0;
        matchAttackActive = false;
        matchMinute = 0;
        matchEnded = false;
        matchPossessionNo = 0;
        matchBreakBonus = 0;
        matchBallCarrier = null;
        matchPendingAction = null;
        matchPendingTarget = null;
        matchBallState = "KICK-OFF";
        matchSignatureRolls = new Set();
        initialisePlayerStates();
        ensureHomeClubName();
        drawOpponent();
        matchDefensivePosture = defensivePostureForOpponent();
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus();
        renderOpponentStatus();
        if (matchChoiceGrid) matchChoiceGrid.innerHTML = "";
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;
        if (matchStartActions) matchStartActions.hidden = false;
        if (startMatchAttackButton) {
            startMatchAttackButton.disabled = false;
            startMatchAttackButton.textContent = "Kick off";
        }
        setCurrentNarrative("Ready for kick-off.", matchAwayClubName + " are set up to " + postureLabel(matchDefensivePosture).toLowerCase() + ". Your five cards create the moves available once the match starts.", "KICK-OFF");
    }

    async function enterMatchLabMode() {
        hideGameAreas();
        document.body.classList.add("game-match-mode");
        if (landing) landing.hidden = true;
        if (playBar) playBar.hidden = true;
        if (libraryBar) libraryBar.hidden = true;
        if (labBar) labBar.hidden = true;
        if (matchBar) matchBar.hidden = true;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = true;
        if (matchLab) matchLab.hidden = false;
        await Promise.all([loadOpponentTeams(), loadGameVideoStats(), loadSignatureEvents()]);
        resetMatchLab();
    }



    // ============================================================
    // Match Lab v0.12 — explicit turns + engine transparency
    // ============================================================

    function v012Esc(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function v012Fmt(value, digits) {
        if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
        const n = Number(value);
        if (Math.abs(n) >= 10000) return Math.round(n).toLocaleString("en-US");
        return typeof digits === "number" ? n.toFixed(digits) : String(Math.round(n * 100) / 100);
    }

    function v012HasMetricObject(obj) {
        return Object.keys(obj || {}).some(function (key) {
            const value = obj[key];
            return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
        });
    }

    function v012StatsSource(card) {
        const seed = cardSeedData(card);
        const stored = getStoredStats(card);
        const a = v012HasMetricObject(seed);
        const b = v012HasMetricObject(stored);
        if (a && b) return "profile fields + game-video-stats.json";
        if (b) return "game-video-stats.json";
        if (a) return "player profile game_* fields";
        return "MISSING → NO EFFECT";
    }

    function v012CardEngineHtml(card) {
        if (!card) return '<div class="game-engine-empty">No card.</div>';
        const seed = cardSeedData(card);
        const stored = getStoredStats(card);
        const data = Object.assign({}, seed, stored);
        const engine = calculateCardEngine(card, data);
        const yt = youtubeCardPower(card);
        const traits = cardRpgTraits(card);
        const raw = [
            ["Views", data.views], ["Watch hours", data.watch_hours], ["Likes", data.likes],
            ["48h views", data.views_48h], ["30d views", data.views_30d], ["Video age", data.video_age_days],
            ["Video minutes", data.video_minutes], ["Avg viewed %", data.average_viewed_pct]
        ];
        const metricRows = [
            ["Reach", engine.metrics.reach], ["Depth", engine.metrics.depth], ["Response", engine.metrics.response],
            ["Heat", engine.metrics.heat], ["Staying", engine.metrics.staying]
        ];
        const traitList = Object.keys(traits).filter(function (key) { return traits[key] > 0; })
            .map(function (key) { return key.replace(/_/g, " ") + " " + traits[key]; }).join(" · ") || "NO EFFECT";
        return '<article class="game-engine-card">' +
            '<div class="game-engine-card-head"><strong>' + v012Esc(card.dataset.name || "Player") + '</strong><span>' + v012Esc(v012StatsSource(card)) + '</span></div>' +
            '<table class="game-engine-table"><tbody>' +
            '<tr><th>Raw YouTube</th><td>' + raw.map(function (r) { return v012Esc(r[0]) + ': <strong>' + v012Esc(v012Fmt(r[1], r[0] === "Avg viewed %" ? 1 : undefined)) + '</strong>'; }).join(' · ') + '</td></tr>' +
            '<tr><th>Derived</th><td>' + metricRows.map(function (r) { return v012Esc(r[0]) + ': <strong>' + (r[1] && Number.isFinite(r[1].score) ? Math.round(r[1].score) : '—') + '</strong>'; }).join(' · ') + '</td></tr>' +
            '<tr><th>Card power</th><td>Base <strong>' + (Number.isFinite(engine.baseIndex) ? Math.round(engine.baseIndex) : '—') + '</strong> · Match <strong>' + (Number.isFinite(engine.matchIndex) ? Math.round(engine.matchIndex) : '—') + '</strong> · outcome impact <strong>' + (yt.impact >= 0 ? '+' : '') + yt.impact + '</strong></td></tr>' +
            '<tr><th>Scouting traits</th><td>' + v012Esc(traitList) + '</td></tr>' +
            '<tr><th>Structured</th><td>' + v012Esc((cardDisplayPosition(card) || '—') + ' · ' + (cardHeightCm(card) || '—') + ' cm · foot ' + (card.dataset.dominantFoot || '—') + ' · two-footed ' + (card.dataset.twoFootedAbility || '—')) + '</td></tr>' +
            '</tbody></table></article>';
    }

    function v012RenderEngineSnapshot() {
        if (!matchEngineCurrent) return;
        const snap = matchLastEngineSnapshot;
        if (!snap) {
            matchEngineCurrent.innerHTML = '<div class="game-engine-empty">No match event has been resolved yet.</div>';
            return;
        }
        const parts = (snap.components || []).map(function (part) {
            return '<div><span>' + v012Esc(part.label) + '</span><strong>' + v012Esc((Number(part.value) >= 0 && part.signed !== false ? '+' : '') + part.value) + '</strong><small>' + v012Esc(part.detail || '') + '</small></div>';
        }).join('');
        matchEngineCurrent.innerHTML =
            '<strong>' + v012Esc(snap.title || 'Latest event') + '</strong>' +
            '<div class="game-engine-calc">' + parts +
            '<div><span>Final chance</span><strong>' + v012Esc(snap.chance) + '%</strong><small>clamped probability used by the roll</small></div>' +
            '<div><span>Random roll</span><strong>' + v012Esc(snap.roll) + '</strong><small>' + v012Esc(snap.result || '') + '</small></div></div>' +
            '<div class="game-engine-formula">' + v012Esc(snap.formula || '') + '</div>';
    }

    function v012RenderEngineRoom() {
        if (matchEngineMeta) {
            matchEngineMeta.innerHTML =
                '<strong>Long-video source:</strong> /assets/data/game-video-stats.json · status: ' + v012Esc(gameVideoStatsMeta.status || 'unknown') +
                ' · updated: ' + v012Esc(gameVideoStatsMeta.updated || '—') + '<br>' +
                v012Esc(gameVideoStatsMeta.note || 'No metadata note.') + '<br>' +
                '<strong>Current long-video formula:</strong> BaseIndex = available Reach 45% + Depth 30% + Response 15% + Staying 10%. If Heat exists: MatchIndex = Base 80% + Heat 20%. Match outcome impact = (MatchIndex − 50) × 0.40, capped at ±20. Missing metrics are omitted, never invented.';
        }
        if (matchEngineHome) matchEngineHome.innerHTML = matchDemoCards().map(v012CardEngineHtml).join('');
        if (matchEngineAway) matchEngineAway.innerHTML = currentOpponentLineup.map(v012CardEngineHtml).join('');
        v012RenderEngineSnapshot();
        if (matchEngineSignatures) {
            const slugs = new Set(matchDemoCards().concat(currentOpponentLineup).map(cardSlug));
            const events = signatureEvents.filter(function (event) { return slugs.has(event.player_slug); });
            matchEngineSignatures.innerHTML = events.length ? events.map(function (event) {
                const p = shortPower(event);
                const trigger = clamp(12 + Math.round((p.score || 0) * 0.42), 12, 58);
                return '<div class="game-engine-short"><strong>' + v012Esc(event.title || event.id) + '</strong> · ' + v012Esc(event.player_slug) +
                    '<br>views ' + v012Esc(v012Fmt(event.views)) + ' · likes ' + v012Esc(v012Fmt(event.likes)) + ' · watch h ' + v012Esc(v012Fmt(event.watch_hours, 1)) +
                    ' · avg viewed ' + v012Esc(v012Fmt(event.average_viewed_pct, 1)) + '% · 48h ' + v012Esc(v012Fmt(event.views_48h)) +
                    '<br><strong>Short power ' + (Number.isFinite(p.score) ? p.score : '—') + '</strong> · success impact +' + p.impact + ' · availability trigger ' + trigger + '% after football-context gate.</div>';
            }).join('') : '<div class="game-engine-empty">No Signature Short is linked to the ten cards in this match.</div>';
        }
    }

    function v012SetEngineSnapshot(snapshot) {
        matchLastEngineSnapshot = snapshot;
        if (matchEngineOverlay && !matchEngineOverlay.hidden) v012RenderEngineRoom();
    }

    function youtubeCardPower(card) {
        if (!card) return { score: null, impact: 0, label: "YouTube NO EFFECT", metrics: [] };
        const data = Object.assign({}, cardSeedData(card), getStoredStats(card));
        const engine = calculateCardEngine(card, data);
        const index = Number.isFinite(engine.matchIndex) ? engine.matchIndex : engine.baseIndex;
        if (!Number.isFinite(index)) return { score: null, impact: 0, label: "YouTube NO EFFECT", metrics: [] };
        const metrics = [];
        [["Reach", engine.metrics.reach], ["Depth", engine.metrics.depth], ["Response", engine.metrics.response], ["Heat", engine.metrics.heat], ["Staying", engine.metrics.staying]].forEach(function (entry) {
            if (entry[1] && Number.isFinite(entry[1].score)) metrics.push(entry[0] + " " + Math.round(entry[1].score));
        });
        const impact = Math.round((index - 50) * 0.40);
        return { score: Math.round(index), impact: clamp(impact, -20, 20), label: "YouTube " + Math.round(index), metrics: metrics };
    }

    async function loadSignatureEvents() {
        if (signatureDataLoaded) return;
        try {
            const response = await fetch("/assets/data/game-signature-events.json", { cache: "no-store" });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const payload = await response.json();
            signatureEvents = Array.isArray(payload.events) ? payload.events : [];
            signatureEventsMeta = payload._meta || {};
        } catch (error) {
            signatureEvents = [];
            signatureEventsMeta = {};
        }
        signatureDataLoaded = true;
    }

    function v012ChooseNaturalStarterFrom(lineup) {
        const pool = (lineup || []).slice();
        if (!pool.length) return null;
        const ranked = pool.map(function (card) {
            const traits = cardRpgTraits(card);
            const category = cardDraftCategory(card);
            let score = traits.passing + traits.vision + traits.ball_playing + traits.technique * 0.5;
            if (category === "defender") score += 4;
            else if (category === "midfielder") score += 3;
            return { card: card, score: score + Math.random() * 4 };
        }).sort(function (a, b) { return b.score - a.score; });
        return randomItem(ranked.slice(0, Math.min(3, ranked.length))).card;
    }

    function v012GeneratedMovesFor(lineup, carrier, zone, postureForChoice) {
        if (!carrier) return [];
        const carrierTraits = cardRpgTraits(carrier);
        const moves = [];
        (lineup || []).forEach(function (target) {
            if (target === carrier) return;
            const name = target.dataset.name || "teammate";
            const tt = cardRpgTraits(target);
            if ((carrierTraits.vision + carrierTraits.passing >= 4) && targetMovementScore(target) >= 4 && zone >= 1) {
                moves.push(buildMove("through", target, {
                    title: (carrier.dataset.name || "The passer") + " SEES " + name.toUpperCase() + "'S RUN",
                    description: "Try the pass into the space behind the defensive line.", actorTraits: ["vision", "passing"],
                    targetTraits: ["deep_runs", "movement", "pace"], base: 48, advance: zone >= 2 ? 1 : 2, positionState: "advanced"
                }));
            }
            if (isWideCard(target) && zone <= 2) {
                moves.push(buildMove("wide", target, {
                    title: "RELEASE " + name.toUpperCase() + " WIDE", description: "Use width and let the wide player attack the next line.",
                    actorTraits: ["passing", "vision"], targetTraits: ["pace", "dribble", "crossing"], base: 50, advance: 1, positionState: "advanced"
                }));
            }
            if ((tt.passing + tt.technique + tt.ball_playing >= 3) && zone <= 2) {
                moves.push(buildMove("support", target, {
                    title: name.toUpperCase() + " IS IN SUPPORT", description: "Keep the move connected through a technical teammate.",
                    actorTraits: ["passing", "technique"], targetTraits: ["passing", "technique", "ball_playing"], base: 55, advance: 1
                }));
            }
            if (isAttackingCard(target)) {
                moves.push(buildMove("feet", target, {
                    title: "PLAY INTO " + name.toUpperCase() + "'S FEET", description: "Find the forward and play off the next action.",
                    actorTraits: ["passing", "vision"], targetTraits: ["technique", "power", "movement"], base: 53, advance: 1
                }));
                const h = cardHeightCm(target);
                if ((Number.isFinite(h) && h >= 188) || tt.aerial || tt.heading || tt.power) {
                    moves.push(buildMove("direct", target, {
                        title: "GO LONG TO " + name.toUpperCase(), description: "Bypass pressure and contest the first ball.",
                        actorTraits: ["passing", "power"], targetTraits: ["aerial", "heading", "duels", "power"],
                        base: 45, advance: 2, aerialContext: "long-ball", positionState: "advanced"
                    }));
                }
            }
            if (zone >= 2 && isAttackingCard(target)) {
                moves.push(buildMove("cross", target, {
                    title: "DELIVER FOR " + name.toUpperCase(), description: "Put a quality ball into the box for a moving target.",
                    actorTraits: ["crossing", "passing", "vision"], targetTraits: ["movement", "deep_runs", "aerial", "heading", "finishing"],
                    base: 43, advance: 1, aerialContext: "cross", positionState: "advanced", scoresOnSuccess: zone >= 3
                }));
            }
            if (zone >= 3 && (tt.finishing || tt.movement || isAttackingCard(target))) {
                moves.push(buildMove("cutback", target, {
                    title: "CUT IT BACK TO " + name.toUpperCase(), description: "Find the arriving runner instead of forcing the aerial duel.",
                    actorTraits: ["passing", "crossing", "vision"], targetTraits: ["movement", "finishing", "technique"], base: 55, advance: 0, scoresOnSuccess: true
                }));
            }
        });
        if (carrierTraits.dribble || carrierTraits.pace || carrierTraits.power) {
            moves.push(buildMove("carry", null, {
                title: (carrier.dataset.name || "PLAYER").toUpperCase() + " DRIVES FORWARD", description: "Keep the ball and attack the defender directly.",
                actorTraits: ["dribble", "pace", "power", "technique"], base: 50, advance: 1, positionState: "advanced"
            }));
        }
        if (zone >= 2 && (carrierTraits.finishing || carrierTraits.power || carrierTraits.technique)) {
            moves.push(buildMove("shot", null, {
                title: "TAKE THE SHOT", description: zone >= 3 ? "The goal is there. Back the player on the ball." : "Try to beat the defence from range.",
                actorTraits: ["finishing", "power", "technique"], base: zone >= 3 ? 54 : 34, advance: 0, scoresOnSuccess: true
            }));
        }
        moves.forEach(function (move) {
            move.choiceScore = move.base + playerMoveScore(carrier, move.actorTraits) * 0.7 +
                (move.target ? playerMoveScore(move.target, move.targetTraits) * 0.55 : 0) +
                (postureForChoice ? actionPostureEffect(move.type, postureForChoice) : 0);
        });
        const unique = [], seen = new Set();
        moves.sort(function (a, b) { return b.choiceScore - a.choiceScore; }).forEach(function (move) {
            const key = move.type + "|" + (move.target ? cardSlug(move.target) : "self");
            if (!seen.has(key)) { seen.add(key); unique.push(move); }
        });
        return unique.slice(0, 6);
    }

    function generatedTeamMoves() {
        return v012GeneratedMovesFor(matchDemoCards(), matchBallCarrier, matchFieldZone, matchDefensivePosture).slice(0, 5);
    }

    function v012TurnText() {
        if (matchTurn === "away_attack") return "YOUR DEFENCE";
        if (matchTurn === "home_counter") return "YOUR COUNTER";
        return "YOUR ATTACK";
    }

    function v012RenderTurnBanner() {
        if (matchRoundLabel) matchRoundLabel.textContent = "ROUND " + matchRound + " / " + MATCH_ROUNDS;
        if (matchTurnLabel) matchTurnLabel.textContent = matchEnded ? "FULL TIME" : v012TurnText();
        if (matchTurnBanner) {
            matchTurnBanner.classList.toggle("is-defending", matchTurn === "away_attack");
            matchTurnBanner.classList.toggle("is-counter", matchTurn === "home_counter");
        }
    }

    function renderMatchScoreboard() {
        if (matchGoals) matchGoals.textContent = String(matchGoalCount);
        if (matchOpponentGoals) matchOpponentGoals.textContent = String(matchOpponentGoalCount);
        if (matchMinuteEl) matchMinuteEl.textContent = matchEnded ? "FT" : "R" + matchRound + "/" + MATCH_ROUNDS;
        if (matchSignatures) matchSignatures.textContent = matchEnded ? "FULL TIME" : v012TurnText();
        v012RenderTurnBanner();
    }

    function renderMatchPhaseStrip() {
        if (!matchPhaseStrip) return;
        const zone = matchTurn === "away_attack" ? matchAwayFieldZone : matchFieldZone;
        const labelsHome = ["OWN HALF", "MIDFIELD", "FINAL THIRD", "BOX"];
        const labelsAway = ["THEIR HALF", "MIDFIELD", "YOUR THIRD", "YOUR BOX"];
        const labels = matchTurn === "away_attack" ? labelsAway : labelsHome;
        const zones = ["own-half", "midfield", "final-third", "box"];
        Array.from(matchPhaseStrip.querySelectorAll("[data-match-phase]")).forEach(function (item, i) {
            const index = zones.indexOf(item.dataset.matchPhase);
            item.textContent = labels[i];
            item.classList.toggle("is-current", matchAttackActive && index === zone);
            item.classList.toggle("is-complete", matchAttackActive && index >= 0 && index < zone);
        });
    }

    function advanceMatchClock(minimum, maximum) {
        const min = Number.isFinite(minimum) ? minimum : 1;
        const max = Number.isFinite(maximum) ? Math.max(min, maximum) : min;
        matchMinute += min + Math.floor(Math.random() * (max - min + 1));
    }

    function v012Transition(title, text, buttonLabel, handler) {
        matchAttackActive = false;
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        setCurrentNarrative(title, text, matchEnded ? "FT" : v012TurnText());
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;
        if (matchChoiceGrid) {
            matchChoiceGrid.innerHTML = "";
            const button = document.createElement("button");
            button.type = "button";
            button.className = "game-match-rpg-action";
            button.innerHTML = '<span class="game-match-action-label">' + v012Esc(buttonLabel) + '</span><strong>' + v012Esc(text) + '</strong><small>' + v012Esc("Score " + matchGoalCount + "–" + matchOpponentGoalCount) + '</small>';
            button.addEventListener("click", handler);
            matchChoiceGrid.appendChild(button);
        }
    }

    function v012StartHomeAttackTurn() {
        if (matchEnded) return;
        matchPossessionNo += 1;
        matchTurn = "home_attack";
        matchAttackActive = true;
        matchActionsThisTurn = 0;
        matchFieldZone = 0;
        matchBreakBonus = 0;
        matchOpponentTransitionBonus = 0;
        initialisePlayerStates();
        matchBallCarrier = v012ChooseNaturalStarterFrom(matchDemoCards());
        setPlayerState(matchBallCarrier, "deep");
        matchBallState = "YOUR ATTACK";
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus(matchBallCarrier ? cardSlug(matchBallCarrier) : "");
        renderOpponentStatus();
        renderActionChoices();
    }

    function v012FinishHomeAttack(message, transitionBonus) {
        matchOpponentTransitionBonus = clamp(transitionBonus || 0, 0, 12);
        matchBallCarrier = null;
        matchBreakBonus = 0;
        v012Transition("Your attack is over.", message, "DEFEND OPPONENT ATTACK", v012StartOpponentAttackTurn);
    }

    function v012FinishRound(message) {
        matchBallCarrier = null;
        matchAwayBallCarrier = null;
        matchBreakBonus = 0;
        matchOpponentTransitionBonus = 0;
        if (matchRound >= MATCH_ROUNDS) {
            endFullMatch();
            return;
        }
        matchRound += 1;
        matchTurn = "home_attack";
        v012Transition("Round complete.", message, "START ROUND " + matchRound, v012StartHomeAttackTurn);
    }

    function v012AttackIntent(move, carrier) {
        const c = carrier ? carrier.dataset.name : "Opponent";
        const t = move.target ? move.target.dataset.name : "";
        const map = {
            through: c + " spots " + t + " running behind your line.",
            wide: c + " looks to release " + t + " into space out wide.",
            support: c + " uses " + t + " in support to keep the attack moving.",
            feet: c + " tries to find " + t + " to feet between your lines.",
            direct: c + " goes direct towards " + t + ".",
            carry: c + " drives at your defensive shape with the ball.",
            cross: c + " shapes to deliver for " + t + " in the box.",
            cutback: c + " looks for the cutback towards " + t + ".",
            shot: c + " opens up for the shot."
        };
        return map[move.type] || c + " tries to progress the attack.";
    }

    const V012_DEFENCE_MATCHUPS = {
        press:   { through: -3, wide: -2, support: 8, feet: 7, direct: -6, carry: 4, cross: -4, cutback: 3, shot: 4 },
        track:   { through: 9, wide: 7, support: -2, feet: 1, direct: 1, carry: 1, cross: 5, cutback: 5, shot: -1 },
        drop:    { through: 8, wide: 1, support: -5, feet: -3, direct: 7, carry: -4, cross: 3, cutback: -5, shot: -6 },
        compact: { through: -2, wide: -6, support: 6, feet: 7, direct: 1, carry: 2, cross: 2, cutback: 6, shot: -4 }
    };

    function v012DefenceMatchup(type, moveType) {
        return (V012_DEFENCE_MATCHUPS[type] && Number.isFinite(V012_DEFENCE_MATCHUPS[type][moveType])) ? V012_DEFENCE_MATCHUPS[type][moveType] : 0;
    }

    function v012BestHomePlayer(keys, preferDefender) {
        const lineup = matchDemoCards();
        if (!lineup.length) return null;
        return lineup.slice().sort(function (a, b) {
            function score(card) {
                const t = cardRpgTraits(card);
                const known = (keys || []).reduce(function (sum, key) { return sum + (t[key] || 0); }, 0);
                const yt = youtubeCardPower(card).impact;
                const availability = preferDefender && isDefensiveCard(card) ? 2 : 0;
                return known + yt * 0.35 + availability;
            }
            return score(b) - score(a);
        })[0];
    }

    function v012DefensiveOptions(move) {
        const press = v012BestHomePlayer(["pressing", "work", "pace"], false);
        const track = v012BestHomePlayer(["marking", "positioning", "pace", "work"], true);
        const drop = v012BestHomePlayer(["positioning", "marking", "aerial", "heading"], true);
        const compact = v012BestHomePlayer(["positioning", "duels", "work", "power"], true);
        return [
            { type: "press", player: press, title: (press ? press.dataset.name.toUpperCase() : "TEAM") + " PRESSES THE PASSER", description: "Attack the ball early. Strong against support play, risky if the pass escapes pressure.", traits: ["pressing", "work", "pace"] },
            { type: "track", player: track, title: (track ? track.dataset.name.toUpperCase() : "TEAM") + " TRACKS THE RUN", description: "Follow the runner instead of gambling in front. Strong against movement in behind.", traits: ["marking", "positioning", "pace", "work"] },
            { type: "drop", player: drop, title: (drop ? drop.dataset.name.toUpperCase() : "TEAM") + " DROPS OFF", description: "Protect the space behind. Gives up territory and can invite combinations or shots.", traits: ["positioning", "marking", "aerial", "heading"] },
            { type: "compact", player: compact, title: "STAY COMPACT AROUND " + (compact ? compact.dataset.name.toUpperCase() : "THE CENTRE"), description: "Close central lanes. Strong against feet/support/cutbacks, but concedes width.", traits: ["positioning", "duels", "work", "power"] }
        ];
    }

    function v012OpponentAttackComponents(move) {
        const carrier = matchAwayBallCarrier;
        const target = move.target;
        const actorTraits = actionTraitBonus(carrier, move.actorTraits, 0.58);
        const targetTraits = target ? actionTraitBonus(target, move.targetTraits, 0.48) : { bonus: 0, details: [] };
        const carrierYT = youtubeCardPower(carrier);
        const targetYT = target ? youtubeCardPower(target) : { score: null, impact: 0, label: "Target YouTube NO EFFECT", metrics: [] };
        const synergy = clamp(Math.round((actorTraits.bonus + targetTraits.bonus) * 0.75), 0, 14);
        const youtubeAttack = carrierYT.impact + Math.round(targetYT.impact * 0.65);
        const transition = matchOpponentTransitionBonus;
        return { carrier: carrier, target: target, actorTraits: actorTraits, targetTraits: targetTraits, carrierYT: carrierYT, targetYT: targetYT, synergy: synergy, youtubeAttack: youtubeAttack, transition: transition };
    }

    function v012ResolveDefence(move, option) {
        if (!matchAttackActive || matchTurn !== "away_attack" || matchEnded) return;
        matchOpponentActionsThisTurn += 1;
        advanceMatchClock(1, 2);
        const attack = v012OpponentAttackComponents(move);
        const defender = option.player;
        const defTrait = defender ? actionTraitBonus(defender, option.traits, 0.62) : { bonus: 0, details: [] };
        const defYT = youtubeCardPower(defender);
        const matchup = v012DefenceMatchup(option.type, move.type);
        const attacker = ((move.type === "through" || move.type === "direct" || move.type === "cross" || move.type === "cutback") && move.target) ? move.target : matchAwayBallCarrier;
        const height = move.aerialContext && defender ? aerialHeightEffect(attacker, defender, move.aerialContext) : { home: 0, away: 0, label: "" };
        const attackPressure = Math.round((move.base - 50) * 0.50) + attack.youtubeAttack + attack.synergy + attack.transition + height.home;
        const defencePower = defYT.impact + defTrait.bonus + matchup + height.away;
        const stopChance = clamp(52 + defencePower - attackPressure, 10, 90);
        const roll = Math.floor(Math.random() * 100) + 1;
        const stopped = roll <= stopChance;
        const defenderName = defender ? defender.dataset.name : "Your shape";
        const attackerName = attacker ? attacker.dataset.name : "Opponent";
        v012SetEngineSnapshot({
            title: "DEFENCE · " + option.title,
            formula: "stop chance = 52 + defender YouTube + known defensive traits + tactical response + aerial context − opponent (base pressure + YouTube + team synergy + transition)",
            components: [
                { label: "Defender YouTube", value: defYT.impact, detail: defYT.label },
                { label: "Known defender traits", value: defTrait.bonus, detail: defTrait.details.join(" · ") || "NO EFFECT" },
                { label: "Tactical response", value: matchup, detail: option.type + " vs " + move.type },
                { label: "Opponent YouTube", value: -attack.youtubeAttack, detail: [attack.carrierYT.label, attack.targetYT.label].join(" · ") },
                { label: "Opponent synergy", value: -attack.synergy, detail: attack.actorTraits.details.concat(attack.targetTraits.details).join(" · ") || "NO EFFECT" },
                { label: "Transition pressure", value: -attack.transition, detail: attack.transition ? "Your previous attack ended with space exposed" : "No transition bonus" },
                { label: "Aerial context", value: height.away - height.home, detail: height.label || "Not aerial" }
            ], chance: stopChance, roll: roll, result: stopped ? "DEFENSIVE STOP" : "OPPONENT MOVE SUCCEEDS"
        });
        renderMatchLineupStatus(defender ? cardSlug(defender) : "");
        renderOpponentStatus(attacker ? cardSlug(attacker) : "");
        showMatchDuel({
            phaseLabel: "YOUR DEFENCE · " + option.type.toUpperCase(),
            title: defenderName + " vs " + attackerName,
            homeCard: defender, awayCard: attacker, homeLabel: matchHomeClubName, awayLabel: matchAwayClubName,
            eventText: v012AttackIntent(move, matchAwayBallCarrier) + " You choose: " + option.title + ".",
            success: stopped,
            resultText: stopped ? defenderName + " STOPS THE MOVE!" : matchAwayClubName + " BREAK THROUGH!",
            numbers: [
                { label: "Your YouTube", value: (defYT.impact >= 0 ? "+" : "") + defYT.impact, detail: defYT.label },
                { label: "Known traits", value: "+" + defTrait.bonus, detail: defTrait.details.join(" · ") || "NO EFFECT" },
                { label: "Tactical matchup", value: (matchup >= 0 ? "+" : "") + matchup, detail: option.type + " vs " + move.type },
                { label: "Opponent YouTube", value: (attack.youtubeAttack >= 0 ? "+" : "") + attack.youtubeAttack, detail: attack.carrierYT.label + (attack.target ? " · " + attack.targetYT.label : "") },
                { label: "Stop chance", value: stopChance + "%", emphasis: true, detail: "Open ENGINE to see the full calculation" }
            ]
        }, function () {
            closeMatchDuel();
            if (stopped) {
                v012OfferCounter(defender, option, "You win the ball through " + option.title.toLowerCase() + ".");
                return;
            }
            if (move.scoresOnSuccess) {
                matchOpponentGoalCount += 1;
                renderMatchScoreboard();
                v012FinishRound(matchAwayClubName + " score. Your defensive turn is over.");
                return;
            }
            matchAwayBallCarrier = move.target || matchAwayBallCarrier;
            matchAwayFieldZone = clamp(matchAwayFieldZone + (move.advance || 1), 0, 3);
            matchOpponentTransitionBonus = Math.max(0, matchOpponentTransitionBonus - 3);
            if (matchOpponentActionsThisTurn >= 6) {
                v012FinishRound("You survive the pressure. " + matchAwayClubName + " do not create a goal before the move runs out.");
                return;
            }
            v012RenderOpponentAttack();
        });
    }

    function v012RenderDefensiveChoices(move) {
        if (!matchChoiceGrid) return;
        matchChoiceGrid.innerHTML = "";
        setDecisionHeading("How do you defend this?", "The opponent has declared the move. Pick the response and the player your team uses to execute it.");
        setCurrentNarrative("OPPONENT MOVE", v012AttackIntent(move, matchAwayBallCarrier), "DEFEND");
        v012DefensiveOptions(move).forEach(function (option) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "game-match-rpg-action is-defence";
            const match = v012DefenceMatchup(option.type, move.type);
            button.innerHTML = '<span class="game-match-action-label">' + v012Esc(option.title) + '</span><strong>' + v012Esc(option.description) + '</strong><small>' + (match > 0 ? 'MATCHUP +' : match < 0 ? 'MATCHUP −' : 'NEUTRAL') + ' · missing player traits = NO EFFECT</small>';
            button.addEventListener("click", function () { v012ResolveDefence(move, option); });
            matchChoiceGrid.appendChild(button);
        });
    }

    function v012PickOpponentMove(moves) {
        if (!moves.length) return null;
        const top = moves.slice(0, Math.min(3, moves.length));
        const r = Math.random();
        if (r < .52) return top[0];
        if (r < .82) return top[1] || top[0];
        return top[2] || top[0];
    }

    function v012RenderOpponentAttack() {
        if (matchEnded || matchTurn !== "away_attack") return;
        matchAttackActive = true;
        matchOpponentPendingMove = v012PickOpponentMove(v012GeneratedMovesFor(currentOpponentLineup, matchAwayBallCarrier, matchAwayFieldZone, null));
        if (!matchOpponentPendingMove) {
            v012FinishRound(matchAwayClubName + " cannot build a supported move and the attack dies.");
            return;
        }
        matchBallState = "YOUR DEFENCE";
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderOpponentStatus(matchAwayBallCarrier ? cardSlug(matchAwayBallCarrier) : "");
        renderMatchLineupStatus();
        v012RenderDefensiveChoices(matchOpponentPendingMove);
    }

    function v012StartOpponentAttackTurn() {
        if (matchEnded) return;
        matchTurn = "away_attack";
        matchAttackActive = true;
        matchOpponentActionsThisTurn = 0;
        matchAwayFieldZone = matchOpponentTransitionBonus >= 7 ? 1 : 0;
        matchAwayBallCarrier = v012ChooseNaturalStarterFrom(currentOpponentLineup);
        matchBallState = matchOpponentTransitionBonus ? "OPPONENT TRANSITION" : "YOUR DEFENCE";
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderOpponentStatus(matchAwayBallCarrier ? cardSlug(matchAwayBallCarrier) : "");
        renderMatchLineupStatus();
        v012RenderOpponentAttack();
    }

    function v012OfferCounter(winner, option, message) {
        matchAttackActive = false;
        matchTurn = "home_counter";
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        setCurrentNarrative("BALL WON · COUNTER?", message, "COUNTER?");
        if (!matchChoiceGrid) return;
        matchChoiceGrid.innerHTML = "";
        if (matchChoiceHeading) matchChoiceHeading.hidden = false;
        if (matchPhaseTitle) matchPhaseTitle.textContent = "Do you counter or reset?";
        if (matchPhaseHelp) matchPhaseHelp.textContent = "A counter is an extra attacking opportunity inside the opponent's turn, but it starts from transition rather than a settled attack.";
        const counter = document.createElement("button");
        counter.type = "button";
        counter.className = "game-match-rpg-action is-counter";
        counter.innerHTML = '<span class="game-match-action-label">COUNTER NOW</span><strong>Use the ball winner and the runners around him</strong><small>Transition bonus depends on how the ball was won</small>';
        counter.addEventListener("click", function () {
            matchTurn = "home_counter";
            matchPossessionNo += 1;
            matchAttackActive = true;
            matchActionsThisTurn = 0;
            matchBallCarrier = winner || v012ChooseNaturalStarterFrom(matchDemoCards());
            matchFieldZone = 1;
            matchBreakBonus = option.type === "press" ? 9 : option.type === "track" ? 7 : option.type === "compact" ? 5 : 3;
            setPlayerState(matchBallCarrier, "normal");
            renderMatchScoreboard();
            renderMatchPhaseStrip();
            renderMatchLineupStatus(matchBallCarrier ? cardSlug(matchBallCarrier) : "");
            renderOpponentStatus();
            renderActionChoices();
        });
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "game-match-rpg-action";
        reset.innerHTML = '<span class="game-match-action-label">RESET SHAPE</span><strong>Keep the ball safe and end the opponent turn</strong><small>Start the next round with a normal attack</small>';
        reset.addEventListener("click", function () { v012FinishRound("You choose not to force the counter."); });
        matchChoiceGrid.appendChild(counter);
        matchChoiceGrid.appendChild(reset);
    }

    function renderActionChoices() {
        if (!matchAttackActive || !matchBallCarrier || !matchChoiceGrid || matchEnded || matchTurn === "away_attack") return;
        matchChoiceGrid.innerHTML = "";
        const carrierName = matchBallCarrier.dataset.name || "Your player";
        setDecisionHeading(carrierName + " has the ball · " + fieldLabel(matchFieldZone), matchTurn === "home_counter" ? "Counter-attack: choose the football action created by this team." : "Your attack: choose the football action created by this team.");
        setCurrentNarrative(carrierName + " has possession.", matchTurn === "home_counter" ? "The opponent is recovering their shape. Use the transition before it closes." : "Your teammates move around him. Choose how to use the five cards together.", matchTurn === "home_counter" ? "COUNTER" : "ATTACK");
        const signature = availableSignatureMove();
        const moves = generatedTeamMoves();
        if (signature) moves.unshift(signature);
        moves.slice(0, 5).forEach(function (move) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "game-match-rpg-action" + (move.signatureEvent ? " is-signature" : "");
            button.innerHTML = '<span class="game-match-action-label">' + v012Esc(move.title) + '</span><strong>' + v012Esc(move.description) + '</strong><small>' + v012Esc(moveHint(move) || "Team move") + '</small>';
            button.addEventListener("click", function () { resolveTeamMove(move); });
            matchChoiceGrid.appendChild(button);
        });
    }

    function resolveTeamMove(move) {
        if (!matchAttackActive || !matchBallCarrier || matchEnded || matchTurn === "away_attack") return;
        matchActionsThisTurn += 1;
        advanceMatchClock(1, 2);
        const resolution = moveResolution(move);
        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= resolution.chance;
        const actor = resolution.attacker || matchBallCarrier;
        const actorName = actor ? actor.dataset.name : "Your player";
        const opponentName = resolution.opponent ? resolution.opponent.dataset.name : "Opponent";
        const breakTriggered = success && !move.signatureEvent && resolution.breakReady;
        v012SetEngineSnapshot({
            title: (matchTurn === "home_counter" ? "COUNTER · " : "ATTACK · ") + move.title,
            formula: "success chance = move base + long-video YouTube attack + team synergy + tactical matchup + aerial context + Signature Short + BREAK carry − opponent (known defensive traits + long-video YouTube)",
            components: [
                { label: "Move base", value: move.base, detail: move.type, signed: false },
                { label: "YouTube attack", value: resolution.youtubeAttack, detail: [resolution.carrierYT.label, resolution.target ? resolution.targetYT.label : ""].filter(Boolean).join(" · ") },
                { label: "Team synergy", value: resolution.synergy, detail: resolution.actorTraits.details.concat(resolution.targetTraits.details).join(" · ") || "NO EFFECT" },
                { label: "Tactical matchup", value: resolution.posture, detail: postureLabel(matchDefensivePosture) },
                { label: "Opponent defence", value: -resolution.defence.score, detail: resolution.defence.details.join(" · ") || resolution.defence.youtube.label },
                { label: "Aerial context", value: resolution.height.home - resolution.height.away, detail: resolution.height.label || "Not aerial" },
                { label: "Signature Short", value: resolution.signature.impact || 0, detail: move.signatureEvent ? resolution.signature.label : "Not triggered" },
                { label: "BREAK carry", value: resolution.breakCarry || 0, detail: resolution.breakCarry ? "Previous action created BREAK" : "No BREAK carry" }
            ], chance: resolution.chance, roll: roll, result: success ? "SUCCESS" : "FAILURE"
        });
        renderMatchLineupStatus(actor ? cardSlug(actor) : "");
        renderOpponentStatus(resolution.opponent ? cardSlug(resolution.opponent) : "");
        showMatchDuel({
            phaseLabel: move.signatureEvent ? "✨ SIGNATURE MOVE" : (matchTurn === "home_counter" ? "COUNTER · TEAM MOVE" : "YOUR ATTACK · TEAM MOVE"),
            title: actorName + " vs " + opponentName,
            homeCard: actor, awayCard: resolution.opponent, homeLabel: matchHomeClubName, awayLabel: matchAwayClubName,
            eventText: moveEventText(move, resolution), success: success,
            resultText: success ? (breakTriggered ? "💥 BREAK! · " + moveSuccessText(move, resolution) : moveSuccessText(move, resolution)) : moveFailureText(move, resolution),
            numbers: outcomeNumbers(move, resolution)
        }, function () {
            closeMatchDuel();
            if (!success) {
                const exposed = clamp(matchFieldZone * 3 + Array.from(matchPlayerStates.values()).filter(function (state) { return state === "advanced"; }).length, 0, 12);
                if (matchTurn === "home_counter") v012FinishRound("The counter breaks down. " + matchAwayClubName + " survive their attacking turn.");
                else v012FinishHomeAttack("The move is stopped. " + matchAwayClubName + " take the next attacking turn.", exposed);
                return;
            }
            if (move.scoresOnSuccess) {
                matchGoalCount += 1;
                renderMatchScoreboard();
                if (matchTurn === "home_counter") v012FinishRound(matchHomeClubName + " score on the counter through " + actorName + ".");
                else v012FinishHomeAttack(matchHomeClubName + " score through " + actorName + ". " + matchAwayClubName + " now get their attack.", 0);
                return;
            }
            if (move.target) {
                if (move.positionState) setPlayerState(move.target, move.positionState);
                setPlayerState(matchBallCarrier, matchFieldZone === 0 ? "deep" : "normal");
                matchBallCarrier = move.target;
            } else if (move.positionState) setPlayerState(matchBallCarrier, move.positionState);
            matchFieldZone = clamp(matchFieldZone + move.advance + (breakTriggered ? 1 : 0), 0, 3);
            matchBreakBonus = breakTriggered ? 8 : Math.max(0, matchBreakBonus - 3);
            setPlayerState(matchBallCarrier, matchFieldZone >= 2 ? "advanced" : (matchFieldZone === 0 ? "deep" : "normal"));
            if (matchActionsThisTurn >= 6) {
                if (matchTurn === "home_counter") v012FinishRound("The counter loses its momentum before a shot is created.");
                else v012FinishHomeAttack("Your attack runs out of momentum without a goal.", 0);
                return;
            }
            renderMatchScoreboard();
            renderMatchPhaseStrip();
            renderMatchLineupStatus(matchBallCarrier ? cardSlug(matchBallCarrier) : "");
            renderOpponentStatus();
            renderActionChoices();
        });
    }

    function endFullMatch() {
        matchEnded = true;
        matchAttackActive = false;
        matchBallState = "FULL TIME";
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus();
        renderOpponentStatus();
        const result = matchGoalCount === matchOpponentGoalCount ? "DRAW" : (matchGoalCount > matchOpponentGoalCount ? "YOU WIN" : "YOU LOSE");
        setCurrentNarrative("FULL TIME · " + result, matchHomeClubName + " " + matchGoalCount + "–" + matchOpponentGoalCount + " " + matchAwayClubName + ".", "FT");
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;
        if (matchChoiceGrid) {
            matchChoiceGrid.innerHTML = "";
            const restart = document.createElement("button");
            restart.type = "button";
            restart.className = "game-match-rpg-action";
            restart.innerHTML = '<span class="game-match-action-label">NEW MATCH</span><strong>Draw another opponent</strong><small>Five rounds · attack, defend, counter</small>';
            restart.addEventListener("click", resetMatchLab);
            matchChoiceGrid.appendChild(restart);
        }
    }

    function startMatchAttack() {
        if (matchAttackActive || matchEnded) return;
        if (matchStartActions) matchStartActions.hidden = true;
        v012StartHomeAttackTurn();
    }

    function resetMatchLab() {
        closeMatchDuel();
        if (matchEngineOverlay) matchEngineOverlay.hidden = true;
        matchGoalCount = 0;
        matchOpponentGoalCount = 0;
        matchAttackActive = false;
        matchMinute = 0;
        matchEnded = false;
        matchPossessionNo = 0;
        matchRound = 1;
        matchTurn = "home_attack";
        matchActionsThisTurn = 0;
        matchOpponentActionsThisTurn = 0;
        matchOpponentTransitionBonus = 0;
        matchBreakBonus = 0;
        matchBallCarrier = null;
        matchAwayBallCarrier = null;
        matchAwayFieldZone = 0;
        matchOpponentPendingMove = null;
        matchLastEngineSnapshot = null;
        matchBallState = "KICK-OFF";
        matchSignatureRolls = new Set();
        initialisePlayerStates();
        ensureHomeClubName();
        drawOpponent();
        matchDefensivePosture = defensivePostureForOpponent();
        renderMatchScoreboard();
        renderMatchPhaseStrip();
        renderMatchLineupStatus();
        renderOpponentStatus();
        if (matchChoiceGrid) matchChoiceGrid.innerHTML = "";
        if (matchChoiceHeading) matchChoiceHeading.hidden = true;
        if (matchStartActions) matchStartActions.hidden = false;
        if (startMatchAttackButton) { startMatchAttackButton.disabled = false; startMatchAttackButton.textContent = "Start round 1"; }
        setCurrentNarrative("Ready.", "Five rounds. Each round: your attack → opponent attack where you choose the defensive response → optional counter if you win the ball.", "KICK-OFF");
        v012RenderEngineRoom();
    }

    async function enterMatchLabMode() {
        hideGameAreas();
        document.body.classList.add("game-match-mode");
        if (landing) landing.hidden = true;
        if (playBar) playBar.hidden = true;
        if (libraryBar) libraryBar.hidden = true;
        if (labBar) labBar.hidden = true;
        if (matchBar) matchBar.hidden = true;
        if (cardPool) cardPool.hidden = true;
        if (cardLab) cardLab.hidden = true;
        if (matchLab) matchLab.hidden = false;
        await Promise.all([loadOpponentTeams(), loadGameVideoStats(), loadSignatureEvents()]);
        resetMatchLab();
    }

    if (matchEngineOpenButton) {
        matchEngineOpenButton.addEventListener("click", function () {
            v012RenderEngineRoom();
            if (matchEngineOverlay) matchEngineOverlay.hidden = false;
        });
    }
    if (matchEngineCloseButton) {
        matchEngineCloseButton.addEventListener("click", function () {
            if (matchEngineOverlay) matchEngineOverlay.hidden = true;
        });
    }
    if (matchEngineOverlay) {
        matchEngineOverlay.addEventListener("click", function (event) {
            if (event.target === matchEngineOverlay) matchEngineOverlay.hidden = true;
        });
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
