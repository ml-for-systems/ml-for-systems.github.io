/**
 * Map raw journal / booktitle strings to short display names.
 * Each rule is [RegExp, canonical label]. First match wins — put more specific patterns first.
 * Edit VENUE_ALIAS_PATTERNS to add or change aliases.
 */
export const VENUE_ALIAS_PATTERNS = [
  [/ieee\s+computer\s+architecture\s+letters/i, "CAL"],
  [/(?:annual\s+)?international\s+symposium\s+on\s+computer\s+architecture/i, "ISCA"],
  [/\bisca\b/i, "ISCA"],
  [
    /(?:proceedings\s+of\s+the\s+\d+(?:st|nd|rd|th)\s+)?usenix\s+symposium\s+on\s+networked\s+systems\s+design\s+and\s+implementation|networked\s+systems\s+design\s+and\s+implementation/i,
    "NSDI",
  ],
  [/\bnsdi\b/i, "NSDI"],
  [/annual\s+technical\s+conference/i, "ATC"],
  [/\batc\b/i, "ATC"],
  [/usenix\s+security\s+symposium/i, "Security"],
  [
    /conference\s+on\s+file\s+and\s+storage\s+technologies/i,
    "FAST",
  ],
  [
    /special\s+interest\s+group\s+on\s+data\s+communication/i,
    "SIGCOMM",
  ],
  [/sigcomm/i, "SIGCOMM"],
  [
    /operating\s+systems\s+design\s+and\s+implementation/i,
    "OSDI",
  ],
  [/\bosdi\b/i, "OSDI"],
  [
    /symposium\s+on\s+operating\s+systems\s+principles/i,
    "SOSP",
  ],
  [/\bsosp\b/i, "SOSP"],
  [
    /architectural\s+support\s+for\s+programming\s+languages\s+and\s+operating\s+systems/i,
    "ASPLOS",
  ],
  [/asplos/i, "ASPLOS"],
  [/\bhpca\b|high[\s-]performance\s+computer\s+architecture/i, "HPCA"],
  [
    /conference on machine learning and systems|proceedings of machine learning and systems/i,
    "MLSys",
  ],
  [
    /international\s+conference\s+on\s+learning\s+representations/i,
    "ICLR",
  ],
  [/\biclr\b/i, "ICLR"],
  [
    /neural\s+information\s+processing\s+systems/i,
    "NeurIPS",
  ],
  [/\bneurips\b/i, "NeurIPS"],
  [
    /international\s+conference\s+on\s+machine\s+learning/i,
    "ICML",
  ],
  [/\bicml\b/i, "ICML"],
  [
    /european\s+conference\s+on\s+computer\s+systems/i,
    "EuroSys",
  ],
  [/\beurosys\b/i, "EuroSys"],
  [/symposium\s+on\s+cloud\s+computing/i, "SoCC"],
  [/\bsocc\b/i, "SoCC"],
  [
    /symposium\s+on\s+code\s+generation\s+and\s+optimization/i,
    "CGO",
  ],
  [/\bcgo\b/i, "CGO"],
  [
    /design,?\s+automation\s*&\s*test\s+in\s+europe\s+conference\s*&\s*exhibition/i,
    "DATE",
  ],
  [/international\s+symposium\s+on\s+memory\s+management/i, "ISMM"],
  [
    /international\s+symposium\s+on\s+workload\s+characterization/i,
    "IISWC",
  ],
  [/\biiswc\b/i, "IISWC"],
  [/(?:annual\s+)?international\s+symposium\s+on\s+microarchitecture/i, "MICRO"],
  [/\bmicro\b/i, "MICRO"],
  [
    /international\s+conference\s+on\s+very\s+large\s+data\s+bases/i,
    "VLDB",
  ],
  [/vldb/i, "VLDB"],
  [
    /international\s+conference\s+on\s+management\s+of\s+data/i,
    "SIGMOD",
  ],
  [/\bsigmod\b/i, "SIGMOD"],
  [/communications\s+of\s+the\s+acm/i, "CACM"],
  [/\bcacm\b/i, "CACM"],
  [
    /conference\s+on\s+computer\s+and\s+communications\s+security/i,
    "CCS",
  ],
  [/\bccs\b/i, "CCS"],
  [
    /conference\s+on\s+mobile\s+computing\s+and\s+networking/i,
    "MobiCom",
  ],
  [/\bmobicom\b/i, "MobiCom"],
  [/foundations\s+of\s+software\s+engineering/i, "FSE"],
  [/\bfse\b/i, "FSE"],
];

/**
 * @param {string} rawVenue
 * @returns {string}
 */
function normalizeForVenueMatch(s) {
  return String(s)
    .replace(/[\u00a0\u2000-\u200b\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalVenue(rawVenue) {
  const t = normalizeForVenueMatch(rawVenue == null ? "" : rawVenue);
  if (!t) return t;
  /* Magazine / column title: not MICRO; keep raw so `\bmicro\b` does not map to MICRO. */
  if (/ieee\s+micro/i.test(t) && !/international\s+symposium\s+on\s+microarchitecture/i.test(t)) {
    return t;
  }
  for (const [re, name] of VENUE_ALIAS_PATTERNS) {
    if (re.test(t)) return name;
  }
  return t;
}
