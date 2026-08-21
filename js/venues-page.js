import { parseBibtex, normalizeEntries } from "./bibtex.js";
import { initThemeToggle } from "./theme-toggle.js";

const BIB_URL = "./papers.bib";

const EXCLUDED_VENUES = new Set(["Preprint/other"]);

/** Venues listed as bullets, in display order (canonical names after `canonicalVenue`). */
const FEATURED_VENUE_ORDER = [
  "ASPLOS",
  "EuroSys",
  "HPCA",
  "MICRO",
  "ISCA",
  "OSDI",
  "SOSP",
  "NSDI",
  "SIGCOMM",
  "MLSys",
];

const FEATURED_VENUE_SET = new Set(FEATURED_VENUE_ORDER);

/** Coverage start year for ISCA, MICRO, EuroSys, and NSDI (end = max year in bib for that venue). */
const EDITORIAL_VENUE_FROM = 2019;

/** Coverage start year for OSDI (end = max year in bib for OSDI). */
const OSDI_VENUE_FROM = 2020;

/** SOSP conference years to list through the latest SOSP year in the bib (not every calendar year). */
const SOSP_EDITORIAL_YEARS = [2019, 2021, 2023, 2024, 2025];

/** Coverage start year for MLSys (end = max year in bib for MLSys). */
const MLSYS_VENUE_FROM = 2018;

/** Subarea charts: ISCA, MICRO, HPCA, ASPLOS */
const SUBAREA_ARCH_VENUES = ["ISCA", "MICRO", "HPCA", "ASPLOS"];

/** Subarea charts: OSDI, SOSP, EuroSys */
const SUBAREA_SYSTEMS_VENUES = ["OSDI", "SOSP", "EuroSys"];

/** Networking venues */
const SUBAREA_NETWORKS_VENUES = ["NSDI", "SIGCOMM"];

/** MLSys — counted only on the combined chart, not a separate bar chart */
const SUBAREA_MLSYS_VENUES = ["MLSys"];

/** Combined chart: architecture + systems + networking + MLSys */
const SUBAREA_ARCH_AND_SYSTEMS_VENUES = [
  ...SUBAREA_ARCH_VENUES,
  ...SUBAREA_SYSTEMS_VENUES,
  ...SUBAREA_NETWORKS_VENUES,
  ...SUBAREA_MLSYS_VENUES,
];

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

function formatYearShort(y) {
  const n = Number(y);
  return `'${String(n % 100).padStart(2, "0")}`;
}

/**
 * Total papers per year across the given venues (one bar per year).
 * @param {HTMLElement} container
 * @param {{ venue?: string, year?: number | null }[]} papers
 * @param {string[]} venues
 * @param {string} title
 * @param {string} barClass e.g. `vchart__bar--blue`
 */
function renderSubareaTotalsByYear(container, papers, venues, title, barClass) {
  const venueSet = new Set(venues);
  const filtered = papers.filter((p) => {
    const v = p.venue || "";
    if (!venueSet.has(v)) return false;
    if (EXCLUDED_VENUES.has(v)) return false;
    return p.year != null;
  });

  /** @type {Map<number, number>} */
  const byYear = new Map();
  for (const p of filtered) {
    const y = /** @type {number} */ (p.year);
    byYear.set(y, (byYear.get(y) || 0) + 1);
  }

  if (byYear.size === 0) {
    container.innerHTML = `<div class="vchart"><h3 class="vchart__title">${escapeHtml(title)}</h3><p class="vchart__empty">No dated papers from these venues in the bibliography.</p></div>`;
    return;
  }

  const yearNums = [...byYear.keys()].sort((a, b) => a - b);
  const years = rangeInclusive(yearNums[0], yearNums[yearNums.length - 1]);

  const yearPairs = years.map((y) => [y, byYear.get(y) || 0]);
  const maxVal = Math.max(1, ...yearPairs.map(([, c]) => c));

  const cols = yearPairs
    .map(([y, c]) => {
      const pct = Math.round((c / maxVal) * 100);
      const barPct = c === 0 ? 0 : Math.max(8, pct);
      return `<div class="vchart__col">
        <span class="vchart__count">${c}</span>
        <div class="vchart__track">
          <div class="vchart__bar ${barClass}" style="height:${barPct}%"></div>
        </div>
        <span class="vchart__tick">${escapeHtml(formatYearShort(y))}</span>
      </div>`;
    })
    .join("");

  const summary = yearPairs.map(([y, c]) => `${y}: ${c}`).join(", ");

  container.innerHTML = `<div class="vchart" role="img" aria-label="${escapeHtml(title)}. ${escapeHtml(summary)}">
    <h3 class="vchart__title">${escapeHtml(title)}</h3>
    <div class="vchart__scroll"><div class="vchart__cols">${cols}</div></div>
  </div>`;
}

/**
 * @param {string[]} names sorted venue labels
 */
function sentenceOtherVenues(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return `Other venues represented in the bibliography include ${names[0]}.`;
  if (names.length === 2) {
    return `Other venues represented in the bibliography include ${names[0]} and ${names[1]}.`;
  }
  const allButLast = names.slice(0, -1).join(", ");
  const last = names[names.length - 1];
  return `Other venues represented in the bibliography include ${allButLast}, and ${last}.`;
}

/**
 * Continuous year list from an editorial start through the latest year in the bib for that venue.
 * @param {number} from
 * @param {number[]} yearsFromData
 * @returns {number[]}
 */
function editorialRangeThroughData(from, yearsFromData) {
  if (!yearsFromData.length) return [];
  const to = Math.max(...yearsFromData);
  if (to < from) return [...yearsFromData].sort((a, b) => a - b);
  return rangeInclusive(from, to);
}

/**
 * @param {string} venue
 * @param {number[]} yearsFromData unique years from bib for this venue
 * @returns {number[]} years to display for this venue
 */
function displayYearsForVenue(venue, yearsFromData) {
  if (venue === "ISCA" || venue === "MICRO" || venue === "EuroSys" || venue === "NSDI") {
    return editorialRangeThroughData(EDITORIAL_VENUE_FROM, yearsFromData);
  }
  if (venue === "OSDI") {
    return editorialRangeThroughData(OSDI_VENUE_FROM, yearsFromData);
  }
  if (venue === "SOSP") {
    if (!yearsFromData.length) return [];
    const to = Math.max(...yearsFromData);
    const years = new Set(SOSP_EDITORIAL_YEARS.filter((y) => y <= to));
    for (const y of yearsFromData) years.add(y);
    return [...years].sort((a, b) => a - b);
  }
  if (venue === "MLSys") {
    return editorialRangeThroughData(MLSYS_VENUE_FROM, yearsFromData);
  }
  if (venue === "HPCA") {
    return editorialRangeThroughData(EDITORIAL_VENUE_FROM, yearsFromData);
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

      const byVenueName = new Map(venueRows);
      const otherVenueNames = venueRows
        .filter(([v]) => !FEATURED_VENUE_SET.has(v))
        .map(([v]) => v)
        .sort((a, b) => a.localeCompare(b));

      venuesUl.replaceChildren();
      for (const venue of FEATURED_VENUE_ORDER) {
        const row = byVenueName.get(venue);
        if (!row) continue;
        const { total, byYear: ymap } = row;
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

      const otherNote = document.getElementById("venues-other-note");
      if (otherNote) {
        if (otherVenueNames.length > 0) {
          otherNote.hidden = false;
          otherNote.textContent = sentenceOtherVenues(otherVenueNames);
        } else {
          otherNote.hidden = true;
        }
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

      const combinedEl = document.getElementById("venues-chart-combined");
      const archEl = document.getElementById("venues-chart-arch");
      const sysEl = document.getElementById("venues-chart-systems");
      if (combinedEl) {
        renderSubareaTotalsByYear(
          combinedEl,
          papers,
          SUBAREA_ARCH_AND_SYSTEMS_VENUES,
          "Architecture, systems, networking, and MLSys (ISCA, MICRO, HPCA, ASPLOS, OSDI, SOSP, EuroSys, NSDI, SIGCOMM, MLSys)",
          "vchart__bar--combined"
        );
      }
      if (archEl) {
        renderSubareaTotalsByYear(
          archEl,
          papers,
          SUBAREA_ARCH_VENUES,
          "Computer architecture (ISCA, MICRO, HPCA, ASPLOS)",
          "vchart__bar--blue"
        );
      }
      if (sysEl) {
        renderSubareaTotalsByYear(
          sysEl,
          papers,
          SUBAREA_SYSTEMS_VENUES,
          "Systems (OSDI, SOSP, EuroSys)",
          "vchart__bar--orange"
        );
      }

      const netEl = document.getElementById("venues-chart-networks");
      if (netEl) {
        renderSubareaTotalsByYear(
          netEl,
          papers,
          SUBAREA_NETWORKS_VENUES,
          "Networking (NSDI, SIGCOMM)",
          "vchart__bar--networks"
        );
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
