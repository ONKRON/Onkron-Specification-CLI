const { HEIGHT_SPEC_IDS, HEIGHT_SPEC_LABELS } = require("../config/specs");
const { runSpecificationUpdate } = require("../lib/runner");
const {
  formatQuarterFraction,
  transformNumericTokens,
  stripMillimeterUnits,
  normalizeDimensionSeparators,
} = require("../lib/numbers");

const MM_TO_INCH = Number(process.env.MM_TO_INCH_FACTOR || 0.04);
const US_LANGUAGE_ID = 2;
const DIMENSION_SPEC_IDS = new Set([68, 760, 762]);

function normalizeSpecIds(specIds) {
  const source = Array.isArray(specIds) ? specIds : HEIGHT_SPEC_IDS;
  const normalized = source
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (normalized.length === 0) {
    throw new Error("No valid spec ids provided for height update");
  }

  return [...new Set(normalized)];
}

async function updateHeight({
  targetLanguageId = 2,
  sourceLanguageId = 1,
  dryRun = false,
  specIds = HEIGHT_SPEC_IDS,
}) {
  const ids = normalizeSpecIds(specIds);
  const stats = [];

  for (const specificationId of ids) {
    const label = HEIGHT_SPEC_LABELS[specificationId] || `height-${specificationId}`;
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

          if (targetLanguageId === US_LANGUAGE_ID) {
            const converted = transformNumericTokens(value, (mmValue) =>
              formatQuarterFraction(mmValue * MM_TO_INCH)
            );
            const withoutUnits = stripMillimeterUnits(converted);
            if (!withoutUnits) {
              return null;
            }

            if (DIMENSION_SPEC_IDS.has(specificationId)) {
              return normalizeDimensionSeparators(withoutUnits);
            }

            return withoutUnits;
          }

          if (DIMENSION_SPEC_IDS.has(specificationId)) {
            return normalizeDimensionSeparators(value);
          }

          return value;
        },
      })
    );
  }

  return stats.length === 1 ? stats[0] : stats;
}

module.exports = {
  updateHeight,
};
