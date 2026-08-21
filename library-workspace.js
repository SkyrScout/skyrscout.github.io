(() => {
  const tabs = Array.from(document.querySelectorAll("[data-library-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-library-panel]"));
  const openers = Array.from(document.querySelectorAll("[data-library-open-tab]"));

  if (!tabs.length || !panels.length) return;

  const validTabs = new Set(tabs.map((tab) => tab.dataset.libraryTab));

  function activate(name, focus = false) {
    if (!validTabs.has(name)) name = "overview";

    tabs.forEach((tab) => {
      const active = tab.dataset.libraryTab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });

    panels.forEach((panel) => {
      const active = panel.dataset.libraryPanel === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    const hash = name === "overview" ? "" : `#${name}`;
    const targetUrl = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, "", targetUrl);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.libraryTab));

    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();

      const currentIndex = tabs.indexOf(tab);
      let nextIndex = currentIndex;

      if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;

      activate(tabs[nextIndex].dataset.libraryTab, true);
    });
  });

  openers.forEach((opener) => {
    opener.addEventListener("click", () => activate(opener.dataset.libraryOpenTab));
  });

  const requested = window.location.hash.replace(/^#/, "");
  activate(validTabs.has(requested) ? requested : "overview");
})();
