const { SPEC_IDS } = require("../config/specs");
const { runSpecificationUpdate } = require("../lib/runner");
const { parseNumber, formatNumber } = require("../lib/numbers");

const MM_TO_INCH = Number(process.env.MM_TO_INCH_FACTOR || 0.04);

async function updateHeight({ targetLanguageId = 2, sourceLanguageId = 1, dryRun = false }) {
  return runSpecificationUpdate({
    taskName: "update-height",
    sourceLanguageId,
    targetLanguageId,
    specificationId: SPEC_IDS.height,
    dryRun,
    transform: (row) => {
      const mmValue = parseNumber(row.specification);
      if (mmValue === null) {
        return null;
      }

      return formatNumber(mmValue * MM_TO_INCH);
    },
  });
}

module.exports = {
  updateHeight,
};
