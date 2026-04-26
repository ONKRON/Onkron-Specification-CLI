const { LOAD_SPEC_IDS, LOAD_SPEC_LABELS } = require("../config/specs");
const { runSpecificationUpdate } = require("../lib/runner");
const {
  parseNumber,
  formatQuarterFraction,
  transformNumericTokens,
  normalizeVolumeToM3,
} = require("../lib/numbers");

const KG_TO_POUNDS = Number(process.env.KG_TO_POUNDS_FACTOR || 2.2);
const M3_TO_FT3 = Number(process.env.M3_TO_FT3_FACTOR || 35.31);
const VOLUME_RAW_TO_M3_THRESHOLD = Number(
  process.env.VOLUME_RAW_TO_M3_THRESHOLD || 1000
);
const VOLUME_RAW_TO_M3_DIVISOR = Number(
  process.env.VOLUME_RAW_TO_M3_DIVISOR || 1000000
);
const VOLUME_FT3_DECIMALS = Math.max(
  0,
  Math.min(10, Number(process.env.VOLUME_FT3_DECIMALS || 6))
);
const US_LANGUAGE_ID = 2;
const KG_TO_LBS_SPEC_IDS = new Set([23, 786, 766, 767]);
const M3_TO_FT3_SPEC_IDS = new Set([763]);

function stripCubicMeterUnits(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const normalized = String(rawValue)
    .replace(/\s*(?:м3|м\^3|m3|m\^3|куб\.?\s*м(?:етр(?:а|ов)?)?)/giu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized || null;
}

function stripCubicFootUnits(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const normalized = String(rawValue)
    .replace(/\s*(?:ft3|ft\^3|cu\.?\s*ft|cft)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized || null;
}

function normalizeSpecIds(specIds) {
  const source = Array.isArray(specIds) ? specIds : LOAD_SPEC_IDS;
  const normalized = source
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (normalized.length === 0) {
    throw new Error("No valid spec ids provided for load update");
  }

  return [...new Set(normalized)];
}

function formatVolumeValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (VOLUME_FT3_DECIMALS === 0) {
    return String(Math.round(value));
  }

  return value
    .toFixed(VOLUME_FT3_DECIMALS)
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "");
}

async function updateLoad({
  targetLanguageId = 2,
  sourceLanguageId = 1,
  dryRun = false,
  specIds = LOAD_SPEC_IDS,
}) {
  const ids = normalizeSpecIds(specIds);
  const stats = [];

  for (const specificationId of ids) {
    const label = LOAD_SPEC_LABELS[specificationId] || `load-${specificationId}`;
    stats.push(
      await runSpecificationUpdate({
        taskName: `update-${label}`,
        sourceLanguageId,
        targetLanguageId,
        specificationId,
        dryRun,
        transform: (row) => {
          const value =
            row.specification === null || row.specification === undefined
              ? ""
              : String(row.specification).trim();
          if (!value) {
            return null;
          }

          if (KG_TO_LBS_SPEC_IDS.has(specificationId)) {
            if (sourceLanguageId === US_LANGUAGE_ID && targetLanguageId !== US_LANGUAGE_ID) {
              return transformNumericTokens(value, (lbsValue) => lbsValue / KG_TO_POUNDS);
            }

            if (targetLanguageId === US_LANGUAGE_ID) {
              return transformNumericTokens(value, (kgValue) =>
                formatQuarterFraction(kgValue * KG_TO_POUNDS)
              );
            }

            return value;
          }

          if (M3_TO_FT3_SPEC_IDS.has(specificationId)) {
            if (sourceLanguageId === US_LANGUAGE_ID && targetLanguageId !== US_LANGUAGE_ID) {
              const normalizedUs = stripCubicFootUnits(value) || value;
              const usVolume = parseNumber(normalizedUs);
              if (usVolume === null) {
                return null;
              }

              return formatVolumeValue(usVolume / M3_TO_FT3);
            }

            if (targetLanguageId === US_LANGUAGE_ID) {
              const numericVolume = parseNumber(value);
              if (numericVolume === null) {
                return null;
              }

              const normalizedM3 = normalizeVolumeToM3(numericVolume, {
                largeValueThreshold: VOLUME_RAW_TO_M3_THRESHOLD,
                largeValueDivisor: VOLUME_RAW_TO_M3_DIVISOR,
              });
              if (normalizedM3 === null) {
                return null;
              }

              const ft3Value = formatVolumeValue(normalizedM3 * M3_TO_FT3);
              if (!ft3Value) {
                return null;
              }

              return `${ft3Value} ft³`;
            }

            return value;
          }

          return value;
        },
      })
    );
  }

  return stats.length === 1 ? stats[0] : stats;
}

module.exports = {
  updateLoad,
};
