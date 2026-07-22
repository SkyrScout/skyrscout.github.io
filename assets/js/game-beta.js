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
 * CURRENT BETA:
 * Choose Scout -> Draw 3 -> Choose 1 -> Build a five-player test team.
 * Scout choice has no bonus yet. Match play is not implemented yet.
 */

document.addEventListener("DOMContentLoaded", function () {
    const cardGrid = document.getElementById("game-card-grid");
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
    const count = document.getElementById("game-card-count");
    const filters = Array.from(document.querySelectorAll(".game-filter"));
    const scoutButtons = Array.from(document.querySelectorAll("[data-scout]"));

    if (!cardGrid) {
        return;
    }

    const cards = Array.from(cardGrid.querySelectorAll("[data-card]"));
    const TEAM_SIZE = 5;

    let selectedScout = "";
    let team = [];
    let availableCards = [];
    let currentDraw = [];


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
        startButton.addEventListener("click", resetDraft);
    }

    if (restartButton) {
        restartButton.addEventListener("click", resetDraft);
    }

    if (showAllButton) {
        showAllButton.addEventListener("click", function () {
            setFilter("all");
            cardGrid.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    }
});
