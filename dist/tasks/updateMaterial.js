const { MATERIAL_TRANSLATIONS, SPEC_IDS } = require("../config/specs");
const { runSpecificationUpdate } = require("../lib/runner");

async function updateMaterial({ targetLanguageId, sourceLanguageId = 1, dryRun = false }) {
  const dictionary = MATERIAL_TRANSLATIONS[targetLanguageId];
  if (!dictionary) {
    throw new Error(`No material dictionary for language_id=${targetLanguageId}`);
  }

  return runSpecificationUpdate({
    taskName: "update-material",
    sourceLanguageId,
    targetLanguageId,
    specificationId: SPEC_IDS.material,
    dryRun,
    transform: (row) => dictionary[row.specification] || null,
  });
}

module.exports = {
  updateMaterial,
};
