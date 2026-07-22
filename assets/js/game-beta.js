document.addEventListener("DOMContentLoaded", function () {
    const cardGrid = document.getElementById("game-card-grid");
    const drawZone = document.getElementById("draw-zone");
    const drawGrid = document.getElementById("draw-grid");
    const drawButton = document.getElementById("draw-three");
    const showAllButton = document.getElementById("show-all");
    const count = document.getElementById("game-card-count");
    const filters = Array.from(document.querySelectorAll(".game-filter"));

    if (!cardGrid) {
        return;
    }

    const cards = Array.from(cardGrid.querySelectorAll("[data-card]"));

    if (count) {
        count.textContent =
            cards.length + (cards.length === 1 ? " card" : " cards") + " in the current pool";
    }

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

    function randomUniqueCards(source, amount) {
        const copy = source.slice();

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
        }

        return copy.slice(0, Math.min(amount, copy.length));
    }

    if (drawButton && drawGrid && drawZone) {
        drawButton.addEventListener("click", function () {
            const drawnCards = randomUniqueCards(cards, 3);

            drawGrid.innerHTML = "";

            drawnCards.forEach(function (card) {
                const clone = card.cloneNode(true);
                clone.hidden = false;
                drawGrid.appendChild(clone);
            });

            drawZone.hidden = false;
            drawZone.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    }

    if (showAllButton) {
        showAllButton.addEventListener("click", function () {
            setFilter("all");

            if (drawZone) {
                drawZone.hidden = true;
            }

            cardGrid.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });
    }
});
