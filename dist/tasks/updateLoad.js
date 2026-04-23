const { LOAD_SPEC_IDS, LOAD_SPEC_LABELS } = require("../config/specs");
const { runSpecificationUpdate } = require("../lib/runner");
const {
  formatQuarterFraction,
  transformNumericTokens,
} = require("../lib/numbers");

const KG_TO_POUNDS = Number(process.env.KG_TO_POUNDS_FACTOR || 2.2);
const US_LANGUAGE_ID = 2;

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

          if (targetLanguageId === US_LANGUAGE_ID) {
            return transformNumericTokens(value, (kgValue) =>
              formatQuarterFraction(kgValue * KG_TO_POUNDS)
            );
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
