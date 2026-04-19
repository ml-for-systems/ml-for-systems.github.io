import { canonicalVenue } from "./venue-aliases.js";

/**
 * Lightweight BibTeX parser for browser use.
 * Handles @article, @inproceedings, @misc, @book, @phdthesis, etc.
 */

function stripComments(text) {
  return text.replace(/%[^\n]*/g, "");
}

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

/** Extract braced or quoted value after = */
function parseFieldValue(raw, startIdx) {
  let i = startIdx;
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (raw[i] === "{") {
    let depth = 0;
    const start = i;
    for (; i < raw.length; i++) {
      if (raw[i] === "{") depth++;
      else if (raw[i] === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    const inner = raw.slice(start + 1, i - 1);
    return { value: inner, end: i };
  }
  if (raw[i] === '"') {
    i++;
    let out = "";
    for (; i < raw.length; i++) {
      if (raw[i] === "\\" && i + 1 < raw.length) {
        out += raw[i + 1];
        i++;
        continue;
      }
      if (raw[i] === '"') {
        i++;
        break;
      }
      out += raw[i];
    }
    return { value: out, end: i };
  }
  let j = i;
  while (j < raw.length && raw[j] !== "," && raw[j] !== "}") j++;
  return { value: raw.slice(i, j).trim(), end: j };
}

function parseEntryBody(body) {
  const fields = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && (/\s/.test(body[i]) || body[i] === ",")) i++;
    if (i >= body.length || body[i] === "}") break;
    const eq = body.indexOf("=", i);
    if (eq === -1) break;
    const name = normalizeWhitespace(body.slice(i, eq)).toLowerCase();
    const { value, end } = parseFieldValue(body, eq + 1);
    fields[name] = normalizeWhitespace(value);
    i = end;
  }
  return fields;
}

function splitAuthors(authorStr) {
  if (!authorStr) return [];
  return authorStr
    .split(/\s+and\s+/i)
    .map((a) => normalizeWhitespace(a))
    .filter(Boolean);
}

/** BibTeX often uses "Last, First" — display as "First Last". */
function formatAuthorFirstLast(name) {
  let s = normalizeWhitespace(name);
  s = s.replace(/\{([^}]*)\}/g, "$1");
  if (!s) return s;

  const fc = s.indexOf(",");
  if (fc === -1) {
    return s;
  }

  const last = normalizeWhitespace(s.slice(0, fc));
  const rest = normalizeWhitespace(s.slice(fc + 1));
  if (!rest) return last;

  if (!rest.includes(",")) {
    return `${rest} ${last}`.trim();
  }

  const restParts = rest.split(",").map((p) => normalizeWhitespace(p)).filter(Boolean);

  if (restParts.length === 2 && /^(Jr\.?|Sr\.?|III|II|IV)$/i.test(restParts[1])) {
    return `${restParts[0]} ${last} ${restParts[1]}`.trim();
  }

  if (restParts.length >= 2) {
    const given = restParts[restParts.length - 1];
    const between = restParts.slice(0, -1).join(" ");
    return `${given} ${last} ${between}`.trim().replace(/\s+/g, " ");
  }

  return `${rest} ${last}`.trim();
}

function parseYear(entry) {
  const y = entry.year || (entry.date && entry.date.slice(0, 4)) || "";
  const n = parseInt(y, 10);
  return Number.isFinite(n) ? n : null;
}

function venueLabel(entry) {
  const t = (entry.entryType || "").toLowerCase();
  if (entry.journal) return entry.journal;
  if (entry.booktitle) return entry.booktitle;
  if (entry.howpublished) return entry.howpublished;
  if (entry.publisher && t === "book") return entry.publisher;
  if (entry.school && t.includes("thesis")) return entry.school;
  if (entry.eprint && String(entry.eprint).includes("/")) {
    return "arXiv";
  }
  return entry.note || "Preprint/other";
}

function labelTags(entry) {
  const raw = entry.labels || "";
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((k) => normalizeWhitespace(k))
    .filter(Boolean);
}

/**
 * @param {string} bibtex
 * @returns {Array<Record<string, string>>}
 */
export function parseBibtex(bibtex) {
  const text = stripComments(bibtex);
  const entries = [];
  let pos = 0;
  while (pos < text.length) {
    const at = text.indexOf("@", pos);
    if (at === -1) break;
    const brace = text.indexOf("{", at);
    if (brace === -1) break;
    const entryType = normalizeWhitespace(text.slice(at + 1, brace));
    if (!/^\w+$/.test(entryType)) {
      pos = at + 1;
      continue;
    }
    let i = brace + 1;
    let depth = 1;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    const inner = text.slice(brace + 1, i - 1);
    const comma = inner.indexOf(",");
    if (comma === -1) {
      pos = i;
      continue;
    }
    const citeKey = normalizeWhitespace(inner.slice(0, comma));
    const body = inner.slice(comma + 1);
    const t = entryType.toLowerCase();
    if (t === "comment" || t === "string" || t === "preamble") {
      pos = i;
      continue;
    }
    const fields = parseEntryBody(body);
    entries.push({
      entryType,
      citeKey,
      ...fields,
    });
    pos = i;
  }
  return entries;
}

/**
 * @param {ReturnType<parseBibtex>} rawEntries
 */
export function normalizeEntries(rawEntries) {
  return rawEntries.map((e) => {
    const authors = splitAuthors(e.author || "").map(formatAuthorFirstLast);
    const year = parseYear(e);
    const venue = canonicalVenue(venueLabel(e));
    const tags = labelTags(e);
    const title = (e.title || "Untitled").replace(/\{|\}/g, "");
    let url = e.url || "";
    const doi = e.doi || "";
    if (!url && doi) url = `https://doi.org/${doi}`;
    const arxivId = e.eprint ? String(e.eprint).replace(/^arxiv:/i, "") : null;
    if (!url && arxivId) {
      url = `https://arxiv.org/abs/${arxivId}`;
    }
    return {
      id: e.citeKey,
      title,
      authors,
      authorDisplay: authors.join(", "),
      year,
      venue,
      tags,
      url,
      doi: doi || null,
      entryType: e.entryType,
    };
  });
}
