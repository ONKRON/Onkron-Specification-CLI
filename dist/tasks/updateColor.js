const { COLOR_TRANSLATIONS_EN, SPEC_IDS } = require("../config/specs");
const { runSpecificationUpdate } = require("../lib/runner");

async function updateColor({ targetLanguageId = 2, sourceLanguageId = 1, dryRun = false }) {
  return runSpecificationUpdate({
    taskName: "update-color",
    sourceLanguageId,
    targetLanguageId,
    specificationId: SPEC_IDS.color,
    dryRun,
    transform: (row) => COLOR_TRANSLATIONS_EN[row.specification] || null,
  });
}

module.exports = {
  updateColor,
};
