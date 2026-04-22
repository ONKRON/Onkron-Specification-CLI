#!/usr/bin/env node

const readline = require("readline");
const { COUNTRY_BY_LANGUAGE_ID } = require("./config/specs");
const { printStats } = require("./lib/runner");
const {
  updateMaterial,
  updateColor,
  updateHeight,
  updateLoad,
} = require("./tasks");
const ALL_TARGETS = "all";

const HELP = `
VamShop Specification CLI

Usage:
  node dist/cli.js                     Start interactive menu
  node dist/cli.js run <task> [flags] Run a task directly

Tasks:
  material
  color
  height
  load
  all

Flags:
  --lang <id|all>       Target language for material (2..8) or all targets
  --material-lang <id|all> Alias for --lang in task=all
  --target-lang <id|all> Target language for color/height/load (default: all)
  --source-lang <id>    Source language (default: 1)
  --dry-run             Validate + report without DB writes
  --help                Show this help

Examples:
  node dist/cli.js run material --lang 3
  node dist/cli.js run material --lang all
  node dist/cli.js run load --target-lang 2 --dry-run
  node dist/cli.js run all --material-lang all --target-lang all
`;

function parseLanguageSelection(value, { allowAll = false } = {}) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (allowAll && normalized === ALL_TARGETS) {
    return ALL_TARGETS;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid language value: ${value}`);
  }

  return parsed;
}

function resolveTargetLanguages(sourceLanguageId, targetSelection) {
  if (targetSelection !== ALL_TARGETS && targetSelection !== null && targetSelection !== undefined) {
    return [Number(targetSelection)];
  }

  const allTargets = Object.keys(COUNTRY_BY_LANGUAGE_ID)
    .map((languageId) => Number(languageId))
    .filter((languageId) => Number.isInteger(languageId))
    .filter((languageId) => languageId !== sourceLanguageId)
    .sort((a, b) => a - b);

  if (allTargets.length === 0) {
    throw new Error("No target languages available for selected source language");
  }

  return allTargets;
}

function collapseStats(stats) {
  return stats.length === 1 ? stats[0] : stats;
}

async function runAcrossTargets(taskRunner, {
  sourceLanguageId,
  targetSelection,
  dryRun,
}) {
  const targetLanguages = resolveTargetLanguages(sourceLanguageId, targetSelection);
  const stats = [];

  for (const targetLanguageId of targetLanguages) {
    stats.push(
      await taskRunner({
        sourceLanguageId,
        targetLanguageId,
        dryRun,
      })
    );
  }

  return collapseStats(stats);
}

function parseArgs(argv) {
  const args = [...argv];
  const flags = {
    dryRun: false,
    sourceLanguageId: 1,
    targetLanguageId: ALL_TARGETS,
    materialLanguageId: ALL_TARGETS,
  };

  let command = null;
  let task = null;

  while (args.length > 0) {
    const token = args.shift();

    if (token === "run") {
      command = "run";
      task = args.shift() || null;
      continue;
    }

    if (token === "--help" || token === "-h") {
      command = "help";
      continue;
    }

    if (token === "--dry-run") {
      flags.dryRun = true;
      continue;
    }

    if (token === "--lang" || token === "--material-lang") {
      const parsedMaterial = parseLanguageSelection(args.shift(), { allowAll: true });
      if (parsedMaterial === null) {
        throw new Error(`Missing value for ${token}`);
      }
      flags.materialLanguageId = parsedMaterial;
      continue;
    }

    if (token === "--target-lang") {
      const parsedTarget = parseLanguageSelection(args.shift(), { allowAll: true });
      if (parsedTarget === null) {
        throw new Error("Missing value for --target-lang");
      }
      flags.targetLanguageId = parsedTarget;
      continue;
    }

    if (token === "--source-lang") {
      const parsedSource = parseLanguageSelection(args.shift());
      if (parsedSource === null) {
        throw new Error("Missing value for --source-lang");
      }
      flags.sourceLanguageId = parsedSource;
      continue;
    }

    if (!command && ["material", "color", "height", "load", "all"].includes(token)) {
      command = "run";
      task = token;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return { command, task, flags };
}

async function runTask(task, flags) {
  switch (task) {
    case "material": {
      return runAcrossTargets(updateMaterial, {
        sourceLanguageId: flags.sourceLanguageId,
        targetSelection: flags.materialLanguageId,
        dryRun: flags.dryRun,
      });
    }
    case "color": {
      return runAcrossTargets(updateColor, {
        sourceLanguageId: flags.sourceLanguageId,
        targetSelection: flags.targetLanguageId,
        dryRun: flags.dryRun,
      });
    }
    case "height": {
      return runAcrossTargets(updateHeight, {
        sourceLanguageId: flags.sourceLanguageId,
        targetSelection: flags.targetLanguageId,
        dryRun: flags.dryRun,
      });
    }
    case "load": {
      return runAcrossTargets(updateLoad, {
        sourceLanguageId: flags.sourceLanguageId,
        targetSelection: flags.targetLanguageId,
        dryRun: flags.dryRun,
      });
    }
    case "all": {
      const stats = [];
      const materialStats = await runAcrossTargets(updateMaterial, {
        sourceLanguageId: flags.sourceLanguageId,
        targetSelection: flags.materialLanguageId,
        dryRun: flags.dryRun,
      });
      stats.push(
        ...(Array.isArray(materialStats) ? materialStats : [materialStats])
      );
      const colorStats = await runAcrossTargets(updateColor, {
        sourceLanguageId: flags.sourceLanguageId,
        targetSelection: flags.targetLanguageId,
        dryRun: flags.dryRun,
      });
      stats.push(
        ...(Array.isArray(colorStats) ? colorStats : [colorStats])
      );
      const heightStats = await runAcrossTargets(updateHeight, {
        sourceLanguageId: flags.sourceLanguageId,
        targetSelection: flags.targetLanguageId,
        dryRun: flags.dryRun,
      });
      stats.push(
        ...(Array.isArray(heightStats) ? heightStats : [heightStats])
      );
      const loadStats = await runAcrossTargets(updateLoad, {
        sourceLanguageId: flags.sourceLanguageId,
        targetSelection: flags.targetLanguageId,
        dryRun: flags.dryRun,
      });
      stats.push(
        ...(Array.isArray(loadStats) ? loadStats : [loadStats])
      );

      return stats;
    }
    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

function printCountries() {
  console.log("\nAvailable countries/languages:");
  for (const [languageId, countryCode] of Object.entries(COUNTRY_BY_LANGUAGE_ID)) {
    console.log(`  ${languageId}: ${countryCode}`);
  }
}

function ask(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("VamShop Specification CLI\n");
    console.log("1) Update material");
    console.log("2) Update color");
    console.log("3) Update height");
    console.log("4) Update load");
    console.log("5) Run all tasks");
    console.log("0) Exit\n");

    const selection = await ask(rl, "Select action: ");

    if (selection === "0") {
      console.log("Exit");
      return;
    }

    const flags = {
      dryRun: false,
      sourceLanguageId: 1,
      targetLanguageId: ALL_TARGETS,
      materialLanguageId: ALL_TARGETS,
    };

    const dryRunAnswer = (await ask(rl, "Dry run? (y/N): ")).toLowerCase();
    flags.dryRun = dryRunAnswer === "y" || dryRunAnswer === "yes";

    const sourceLanguage = await ask(rl, "Source language id [1]: ");
    if (sourceLanguage) {
      const parsedSource = parseLanguageSelection(sourceLanguage);
      if (parsedSource === null) {
        throw new Error("Source language id is required");
      }
      flags.sourceLanguageId = parsedSource;
    }

    let task;
    if (selection === "1") {
      task = "material";
      printCountries();
      const materialLang = await ask(rl, "Material target language id [all]: ");
      if (materialLang) {
        flags.materialLanguageId = parseLanguageSelection(materialLang, {
          allowAll: true,
        });
      }
    } else if (selection === "2") {
      task = "color";
      const target = await ask(rl, "Target language id [all]: ");
      if (target) {
        flags.targetLanguageId = parseLanguageSelection(target, {
          allowAll: true,
        });
      }
    } else if (selection === "3") {
      task = "height";
      const target = await ask(rl, "Target language id [all]: ");
      if (target) {
        flags.targetLanguageId = parseLanguageSelection(target, {
          allowAll: true,
        });
      }
    } else if (selection === "4") {
      task = "load";
      const target = await ask(rl, "Target language id [all]: ");
      if (target) {
        flags.targetLanguageId = parseLanguageSelection(target, {
          allowAll: true,
        });
      }
    } else if (selection === "5") {
      task = "all";
      printCountries();
      const materialLang = await ask(rl, "Material target language id [all]: ");
      if (materialLang) {
        flags.materialLanguageId = parseLanguageSelection(materialLang, {
          allowAll: true,
        });
      }
      const target = await ask(rl, "Target language for color/height/load [all]: ");
      if (target) {
        flags.targetLanguageId = parseLanguageSelection(target, {
          allowAll: true,
        });
      }
    } else {
      throw new Error("Invalid action selected");
    }

    const result = await runTask(task, flags);
    if (Array.isArray(result)) {
      result.forEach((item) => printStats(item));
    } else {
      printStats(result);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  try {
    const { command, task, flags } = parseArgs(process.argv.slice(2));

    if (command === "help") {
      console.log(HELP);
      return;
    }

    if (command === "run") {
      if (!task) {
        throw new Error("Task is required. Use: node dist/cli.js run <task>");
      }

      const result = await runTask(task, flags);
      if (Array.isArray(result)) {
        result.forEach((item) => printStats(item));
      } else {
        printStats(result);
      }
      return;
    }

    await runInteractive();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log("Use --help for usage examples.");
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  parseArgs,
  runTask,
};
