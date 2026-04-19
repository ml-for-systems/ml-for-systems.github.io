/**
 * Map raw journal / booktitle strings to short display names.
 * Each rule is [RegExp, canonical label]. First match wins — put more specific patterns first.
 * Edit VENUE_ALIAS_PATTERNS to add or change aliases.
 */
export const VENUE_ALIAS_PATTERNS = [
  [/ieee\s+computer\s+architecture\s+letters/i, "CAL"],
  [/asplos/i, "ASPLOS"],
  [/\bhpca\b|high[\s-]performance\s+computer\s+architecture/i, "HPCA"],
  [
    /conference on machine learning and systems|proceedings of machine learning and systems/i,
    "MLSys",
  ],
  [/ieee\s+micro/i, "IEEE Micro"],
];

/**
 * @param {string} rawVenue
 * @returns {string}
 */
export function canonicalVenue(rawVenue) {
  const t = rawVenue == null ? "" : String(rawVenue).trim();
  if (!t) return t;
  for (const [re, name] of VENUE_ALIAS_PATTERNS) {
    if (re.test(t)) return name;
  }
  return t;
}
