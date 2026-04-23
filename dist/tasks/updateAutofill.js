const { AUTOFILL_SPEC_IDS, AUTOFILL_SPEC_LABELS } = require("../config/specs");
const { runSpecificationUpdate } = require("../lib/runner");

function normalizeSpecIds(specIds) {
  const source = Array.isArray(specIds) ? specIds : AUTOFILL_SPEC_IDS;
  const normalized = source
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (normalized.length === 0) {
    throw new Error("No valid spec ids provided for autofill");
  }

  return [...new Set(normalized)];
}

async function updateAutofill({
  targetLanguageId = 2,
  sourceLanguageId = 1,
  dryRun = false,
  specIds = AUTOFILL_SPEC_IDS,
}) {
  const ids = normalizeSpecIds(specIds);
  const stats = [];

  for (const specificationId of ids) {
    const label = AUTOFILL_SPEC_LABELS[specificationId] || `spec-${specificationId}`;
    stats.push(
      await runSpecificationUpdate({
        taskName: `update-${label}`,
        sourceLanguageId,
        targetLanguageId,
        specificationId,
        dryRun,
        transform: (row) => row.specification,
      })
    );
  }

  return stats.length === 1 ? stats[0] : stats;
}

module.exports = {
  updateAutofill,
};
