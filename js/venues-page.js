import { parseBibtex, normalizeEntries } from "./bibtex.js";
import { initThemeToggle } from "./theme-toggle.js";

const BIB_URL = "./papers.bib";

const EXCLUDED_VENUES = new Set(["CAL", "Preprint/other"]);

/** Years shown for ISCA, MICRO, EuroSys, and NSDI on this page (inclusive). */
const EDITORIAL_VENUE_YEARS = { from: 2019, to: 2025 };

/** Years shown for OSDI on this page (inclusive). */
const OSDI_VENUE_YEARS = { from: 2020, to: 2025 };

/** SOSP is biennial; years shown on this page (not every calendar year). */
const SOSP_EDITORIAL_YEARS = [2019, 2021, 2023, 2024, 2025];

/** Years shown for MLSys on this page (inclusive). */
const MLSYS_VENUE_YEARS = { from: 2018, to: 2025 };

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rangeInclusive(from, to) {
  const out = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

/**
 * @param {string} venue
 * @param {number[]} yearsFromData sorted unique years from bib
 * @returns {number[]} years to display for this venue
 */
function displayYearsForVenue(venue, yearsFromData) {
  if (venue === "ISCA" || venue === "MICRO" || venue === "EuroSys" || venue === "NSDI") {
    return rangeInclusive(EDITORIAL_VENUE_YEARS.from, EDITORIAL_VENUE_YEARS.to);
  }
  if (venue === "OSDI") {
    return rangeInclusive(OSDI_VENUE_YEARS.from, OSDI_VENUE_YEARS.to);
  }
  if (venue === "SOSP") {
    return [...SOSP_EDITORIAL_YEARS];
  }
  if (venue === "MLSys") {
    return rangeInclusive(MLSYS_VENUE_YEARS.from, MLSYS_VENUE_YEARS.to);
  }
  if (venue === "HPCA") {
    const s = new Set(yearsFromData);
    s.add(2019);
    s.add(2026);
    return [...s].sort((a, b) => a - b);
  }
  return [...yearsFromData].sort((a, b) => a - b);
}

function main() {
  const errEl = document.getElementById("venues-load-error");
  const loadingEl = document.getElementById("venues-loading");
  const dynamicEl = document.getElementById("venues-dynamic");
  const venuesUl = document.getElementById("venues-list");

  initThemeToggle();

  fetch(BIB_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load ${BIB_URL} (${res.status})`);
      return res.text();
    })
    .then((bib) => {
      const papers = normalizeEntries(parseBibtex(bib));

      /** @type {Map<string, { total: number, byYear: Map<number, number> }>} */
      const byVenue = new Map();
      let undated = 0;

      for (const p of papers) {
        const venue = p.venue || "Unknown";
        if (!byVenue.has(venue)) {
          byVenue.set(venue, { total: 0, byYear: new Map() });
        }
        const g = byVenue.get(venue);
        g.total += 1;
        if (p.year != null) {
          g.byYear.set(p.year, (g.byYear.get(p.year) || 0) + 1);
        } else {
          undated += 1;
        }
      }

      const venueRows = [...byVenue.entries()]
        .filter(([v]) => !EXCLUDED_VENUES.has(v))
        .sort((a, b) => a[0].localeCompare(b[0]));

      venuesUl.replaceChildren();
      for (const [venue, { total, byYear: ymap }] of venueRows) {
        const li = document.createElement("li");
        const yearsFromData = [...ymap.keys()];
        const years = displayYearsForVenue(venue, yearsFromData);
        const datedCount = [...ymap.values()].reduce((a, b) => a + b, 0);
        const undatedHere = total - datedCount;
        const parts = [];
        if (years.length) parts.push(years.join(", "));
        if (undatedHere > 0) parts.push(undatedHere === 1 ? "1 undated" : `${undatedHere} undated`);
        const yearPart = parts.length ? ` — ${parts.join(" · ")}` : "";
        li.innerHTML = `<strong>${escapeHtml(venue)}</strong>${escapeHtml(yearPart)} <span class="venues-page__meta">(${total} ${total === 1 ? "paper" : "papers"})</span>`;
        venuesUl.appendChild(li);
      }

      const note = document.getElementById("venues-undated-note");
      if (note) {
        if (undated > 0) {
          note.hidden = false;
          note.textContent =
            undated === 1
              ? "One entry has no year in the list above."
              : `${undated} entries have no year in the list above.`;
        } else {
          note.hidden = true;
        }
      }

      loadingEl.hidden = true;
      dynamicEl.hidden = false;
    })
    .catch((e) => {
      loadingEl.hidden = true;
      errEl.hidden = false;
      errEl.textContent = e.message || String(e);
    });
}

main();
