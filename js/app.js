import { parseBibtex, normalizeEntries } from "./bibtex.js";
import { initThemeToggle } from "./theme-toggle.js";

const BIB_URL = "./papers.bib";

/** Dashboard year chart: only years >= this (inclusive). */
const YEAR_CHART_MIN = 2019;

function topN(map, n) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function uniqueAuthors(papers) {
  const set = new Set();
  for (const p of papers) {
    for (const a of p.authors) {
      set.add(a.toLowerCase().replace(/\s+/g, " "));
    }
  }
  return set.size;
}

function uniqueVenues(papers) {
  const set = new Set();
  for (const p of papers) {
    set.add(p.venue || "Unknown");
  }
  return set.size;
}

function papersByYear(papers) {
  const m = new Map();
  for (const p of papers) {
    if (p.year == null) continue;
    m.set(p.year, (m.get(p.year) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

function venueCounts(papers) {
  const m = new Map();
  for (const p of papers) {
    const v = p.venue || "Unknown";
    m.set(v, (m.get(v) || 0) + 1);
  }
  return m;
}

/** Omitted from the Top Venues dashboard chart (not from filters or paper cards). */
function isExcludedFromTopVenuesChart(venue) {
  const v = (venue || "").trim().toLowerCase();
  if (v === "arxiv") return true;
  if (v === "preprint/other" || v === "preprint") return true;
  return false;
}

function venueCountsForTopChart(papers) {
  const m = new Map();
  for (const p of papers) {
    const v = p.venue || "Unknown";
    if (isExcludedFromTopVenuesChart(v)) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return m;
}

function allTags(papers) {
  const m = new Map();
  for (const p of papers) {
    for (const t of p.tags) {
      m.set(t, (m.get(t) || 0) + 1);
    }
  }
  return topN(m, 80);
}

/** Rough count of `@type{` headers (one per entry). Leading spaces allowed (some exports indent). */
function countBibEntryHeaders(bib) {
  return (bib.match(/^\s*@\s*[A-Za-z]+\s*\{/gm) || []).length;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatYearShort(y) {
  const n = Number(y);
  return `'${String(n % 100).padStart(2, "0")}`;
}

function shortenVenueLabel(s) {
  const t = String(s).trim();
  if (t.length <= 13) return t;
  return `${t.slice(0, 11)}…`;
}

function renderDashboardYearChart(container, yearPairs) {
  const title = `Paper distribution by year (${YEAR_CHART_MIN} onwards)`;
  if (!yearPairs.length) {
    container.innerHTML = `<div class="vchart"><h3 class="vchart__title">${escapeHtml(title)}</h3><p class="vchart__empty">No papers with year ${YEAR_CHART_MIN} or later in the bibliography.</p></div>`;
    return;
  }
  const maxVal = Math.max(1, ...yearPairs.map(([, c]) => c));
  const summary = yearPairs.map(([y, c]) => `${y}: ${c}`).join(", ");
  const cols = yearPairs
    .map(([y, c]) => {
      const pct = Math.round((c / maxVal) * 100);
      return `<div class="vchart__col">
        <span class="vchart__count">${c}</span>
        <div class="vchart__track">
          <div class="vchart__bar vchart__bar--blue" style="height:${pct}%"></div>
        </div>
        <span class="vchart__tick">${escapeHtml(formatYearShort(y))}</span>
      </div>`;
    })
    .join("");
  container.innerHTML = `<div class="vchart" role="img" aria-label="${escapeHtml(title)}. ${escapeHtml(summary)}">
    <h3 class="vchart__title">${escapeHtml(title)}</h3>
    <div class="vchart__scroll"><div class="vchart__cols">${cols}</div></div>
  </div>`;
}

function renderDashboardVenueChart(container, pairs) {
  const title = "Top Venues";
  if (!pairs.length) {
    container.innerHTML = `<div class="vchart"><h3 class="vchart__title">${escapeHtml(title)}</h3><p class="vchart__empty">No venue data.</p></div>`;
    return;
  }
  const maxVal = Math.max(1, ...pairs.map(([, c]) => c));
  const summary = pairs.map(([v, c]) => `${v}: ${c}`).join(", ");
  const cols = pairs
    .map(([venue, c]) => {
      /* Sqrt scale so the tallest bar does not dominate when counts are close. */
      const pct = Math.max(8, Math.round(100 * Math.sqrt(c / maxVal)));
      const tick = shortenVenueLabel(venue);
      return `<div class="vchart__col">
        <span class="vchart__count">${c}</span>
        <div class="vchart__track">
          <div class="vchart__bar vchart__bar--orange" style="height:${pct}%"></div>
        </div>
        <span class="vchart__tick" title="${escapeHtml(venue)}">${escapeHtml(tick)}</span>
      </div>`;
    })
    .join("");
  container.innerHTML = `<div class="vchart" role="img" aria-label="${escapeHtml(title)}. ${escapeHtml(summary)}">
    <h3 class="vchart__title">${escapeHtml(title)}</h3>
    <div class="vchart__scroll"><div class="vchart__cols vchart__cols--venues">${cols}</div></div>
  </div>`;
}

function paperMatchesSearch(p, q) {
  if (!q) return true;
  const hay = `${p.title} ${p.authorDisplay} ${p.venue} ${p.tags.join(" ")}`.toLowerCase();
  return hay.includes(q);
}

function applyFilters(papers, state) {
  const q = state.search.trim().toLowerCase();
  return papers.filter((p) => {
    if (!paperMatchesSearch(p, q)) return false;
    if (state.year != null && p.year !== state.year) return false;
    if (state.venue && p.venue !== state.venue) return false;
    for (const t of state.tags) {
      if (!p.tags.includes(t)) return false;
    }
    return true;
  });
}

function renderPaperList(container, papers) {
  const countEl = document.getElementById("paper-count");
  if (countEl) {
    countEl.textContent = `Showing ${papers.length} paper${papers.length === 1 ? "" : "s"}`;
  }
  if (papers.length === 0) {
    container.innerHTML = '<p class="loading">No papers match the current filters.</p>';
    return;
  }
  const sorted = [...papers].sort((a, b) => {
    const ya = a.year ?? 0;
    const yb = b.year ?? 0;
    if (yb !== ya) return yb - ya;
    return a.title.localeCompare(b.title);
  });
  container.innerHTML = sorted
    .map(
      (p) => `
    <article class="paper-card" data-id="${escapeHtml(p.id)}">
      <h3 class="paper-card__title">${escapeHtml(p.title)}</h3>
      ${
        p.tags.length
          ? `<div class="paper-card__tags">${p.tags.map((t) => `<span class="paper-card__tag">${escapeHtml(t)}</span>`).join("")}</div>`
          : ""
      }
      <p class="paper-card__meta">By ${escapeHtml(p.authorDisplay)}</p>
      <p class="paper-card__venue">${escapeHtml(p.venue)}${p.year != null ? ` · ${p.year}` : ""}</p>
      <div class="paper-card__links">
        ${p.url ? `<a href="${escapeHtml(p.url)}" rel="noopener noreferrer" target="_blank">Link</a>` : ""}
        ${p.doi ? `<a href="https://doi.org/${escapeHtml(p.doi)}" rel="noopener noreferrer" target="_blank">DOI</a>` : ""}
      </div>
    </article>
  `
    )
    .join("");
}

async function main() {
  const root = document.getElementById("papers-root");
  const errEl = document.getElementById("load-error");
  let papers;

  try {
    const res = await fetch(BIB_URL);
    if (!res.ok) throw new Error(`Could not load ${BIB_URL} (${res.status})`);
    const bib = await res.text();
    papers = normalizeEntries(parseBibtex(bib));
    const declared = countBibEntryHeaders(bib);
    const warnEl = document.getElementById("bib-parse-warning");
    if (warnEl) {
      if (declared !== papers.length) {
        warnEl.hidden = false;
        const hint =
          declared > papers.length
            ? `Check papers.bib for missing commas after cite keys, unbalanced { }, or a bare % in a field (use \\% for percent).`
            : `Try a hard refresh. If this persists, check for stray @ inside abstracts or duplicate blocks.`;
        warnEl.textContent = `Counted ${declared} @ entry lines; parser produced ${papers.length}. ${hint}`;
      } else {
        warnEl.hidden = true;
        warnEl.textContent = "";
      }
    }
  } catch (e) {
    errEl.hidden = false;
    errEl.textContent = e.message || String(e);
    root.innerHTML = "";
    return;
  }

  const state = {
    search: "",
    year: null,
    venue: null,
    tags: new Set(),
  };

  document.getElementById("stat-papers").textContent = String(papers.length);
  document.getElementById("stat-authors").textContent = String(uniqueAuthors(papers));
  document.getElementById("stat-venues").textContent = String(uniqueVenues(papers));

  const yearPairs = papersByYear(papers).filter(([y]) => y >= YEAR_CHART_MIN);
  renderDashboardYearChart(document.getElementById("dashboard-chart-years"), yearPairs);
  renderDashboardVenueChart(
    document.getElementById("dashboard-chart-venues"),
    topN(venueCountsForTopChart(papers), 5)
  );

  const tagContainer = document.getElementById("filter-tags");
  const tagList = allTags(papers);
  tagContainer.replaceChildren();
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "chip chip--clear";
  clearBtn.id = "clear-tags";
  clearBtn.textContent = "Clear tags";
  tagContainer.appendChild(clearBtn);
  for (const [tag, c] of tagList) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.tag = tag;
    btn.setAttribute("aria-pressed", "false");
    btn.title = `${c} papers`;
    btn.append(document.createTextNode(`${tag} `));
    const span = document.createElement("span");
    span.style.opacity = "0.65";
    span.textContent = `(${c})`;
    btn.appendChild(span);
    tagContainer.appendChild(btn);
  }

  const yearFilter = document.getElementById("filter-year");
  yearFilter.replaceChildren();
  yearFilter.appendChild(new Option("All years", ""));
  const years = [...new Set(papers.map((p) => p.year).filter((y) => y != null))].sort((a, b) => b - a);
  for (const y of years) {
    yearFilter.appendChild(new Option(String(y), String(y)));
  }

  const venueFilter = document.getElementById("filter-venue");
  venueFilter.replaceChildren();
  venueFilter.appendChild(new Option("All venues", ""));
  const venues = [...new Set(papers.map((p) => p.venue))].sort((a, b) => a.localeCompare(b));
  for (const v of venues) {
    venueFilter.appendChild(new Option(v, v));
  }

  function refresh() {
    const filtered = applyFilters(papers, state);
    renderPaperList(root, filtered);
  }

  document.getElementById("search-input").addEventListener("input", (e) => {
    state.search = e.target.value;
    refresh();
  });
  yearFilter.addEventListener("change", () => {
    const v = yearFilter.value;
    state.year = v === "" ? null : Number(v);
    refresh();
  });
  venueFilter.addEventListener("change", () => {
    state.venue = venueFilter.value || null;
    refresh();
  });

  tagContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tag]");
    if (btn) {
      const tag = btn.dataset.tag;
      if (state.tags.has(tag)) {
        state.tags.delete(tag);
        btn.setAttribute("aria-pressed", "false");
      } else {
        state.tags.add(tag);
        btn.setAttribute("aria-pressed", "true");
      }
      refresh();
      return;
    }
    if (e.target.closest("#clear-tags")) {
      state.tags.clear();
      tagContainer.querySelectorAll("button[data-tag]").forEach((b) => b.setAttribute("aria-pressed", "false"));
      refresh();
    }
  });

  refresh();
}

initThemeToggle();
main();
