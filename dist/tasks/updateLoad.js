const { SPEC_IDS } = require("../config/specs");
const { runSpecificationUpdate } = require("../lib/runner");
const { parseNumber, formatNumber } = require("../lib/numbers");

const KG_TO_POUNDS = Number(process.env.KG_TO_POUNDS_FACTOR || 2.2);

async function updateLoad({ targetLanguageId = 2, sourceLanguageId = 1, dryRun = false }) {
  return runSpecificationUpdate({
    taskName: "update-load",
    sourceLanguageId,
    targetLanguageId,
    specificationId: SPEC_IDS.load,
    dryRun,
    transform: (row) => {
      const kgValue = parseNumber(row.specification);
      if (kgValue === null) {
        return null;
      }

      return formatNumber(kgValue * KG_TO_POUNDS);
    },
  });
}

module.exports = {
  updateLoad,
};
