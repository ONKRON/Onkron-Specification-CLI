const { runTask } = require("./cli");
const { printStats } = require("./lib/runner");

const sourceLanguageId = Number(process.env.SOURCE_LANGUAGE_ID || 1);
const targetRaw = String(process.env.TARGET_LANGUAGE_ID || "all").trim().toLowerCase();
const targetLanguageId = targetRaw === "all" ? "all" : Number(targetRaw);
const dryRun = process.env.DRY_RUN === "1";

runTask("height", {
  sourceLanguageId,
  materialLanguageId: "all",
  targetLanguageId,
  dryRun,
})
  .then((result) => {
    const stats = Array.isArray(result) ? result : [result];
    stats.forEach(printStats);
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
