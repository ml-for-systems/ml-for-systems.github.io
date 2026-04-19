const THEME_KEY = "bib-theme";

export function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function syncAria() {
    const t = document.documentElement.getAttribute("data-theme") || "dark";
    btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode or quota */
    }
    syncAria();
  });

  syncAria();
}
