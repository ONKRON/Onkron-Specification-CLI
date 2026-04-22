const sourceLanguageIdEl = document.getElementById("sourceLanguageId");
const materialLanguageIdEl = document.getElementById("materialLanguageId");
const targetLanguageIdEl = document.getElementById("targetLanguageId");
const dryRunEl = document.getElementById("dryRun");
const outputEl = document.getElementById("output");
const clearOutputEl = document.getElementById("clearOutput");
const taskButtons = [...document.querySelectorAll(".task-card")];
const ALL_TARGETS = "all";

function appendOutput(text, isError = false) {
  if (outputEl.textContent.trim() === "Ready.") {
    outputEl.textContent = "";
  }

  outputEl.classList.toggle("error", isError);
  outputEl.textContent += `${text}\n`;
  outputEl.scrollTop = outputEl.scrollHeight;
}

function setBusy(isBusy) {
  for (const button of taskButtons) {
    button.disabled = isBusy;
    button.style.opacity = isBusy ? "0.65" : "1";
  }
}

function buildPayload(task) {
  return {
    task,
    sourceLanguageId: Number(sourceLanguageIdEl.value || 1),
    materialLanguageId: materialLanguageIdEl.value || ALL_TARGETS,
    targetLanguageId: targetLanguageIdEl.value || ALL_TARGETS,
    dryRun: dryRunEl.checked,
  };
}

function formatTaskStats(taskStats) {
  return [
    `Task: ${taskStats.taskName}`,
    `Source language: ${taskStats.sourceLanguageId}`,
    `Target language: ${taskStats.targetLanguageId}`,
    `Specification ID: ${taskStats.specificationId}`,
    `Total: ${taskStats.total}`,
    `Updated: ${taskStats.updated}`,
    `Skipped: ${taskStats.skipped}`,
    `Failed: ${taskStats.failed}`,
    `Mode: ${taskStats.dryRun ? "dry-run" : "write"}`,
  ].join("\n");
}

async function runTask(task) {
  setBusy(true);
  outputEl.classList.remove("error");

  try {
    const payload = buildPayload(task);
    appendOutput(`>>> Running: ${task}`);

    const response = await window.specApi.runTask(payload);

    for (const taskStats of response.tasks) {
      appendOutput("------------------------------");
      appendOutput(formatTaskStats(taskStats));
    }

    appendOutput(`Finished at: ${new Date(response.finishedAt).toLocaleString()}`);
  } catch (error) {
    outputEl.classList.add("error");
    appendOutput(`ERROR: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

function fillLanguageSelect(selectEl, countries) {
  selectEl.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = ALL_TARGETS;
  allOption.textContent = `${ALL_TARGETS} - All available targets`;
  selectEl.appendChild(allOption);

  for (const [languageId, countryCode] of Object.entries(countries)) {
    const option = document.createElement("option");
    option.value = languageId;
    option.textContent = `${languageId} - ${countryCode}`;
    selectEl.appendChild(option);
  }
}

async function bootstrap() {
  const countries = await window.specApi.getCountries();
  fillLanguageSelect(materialLanguageIdEl, countries);
  fillLanguageSelect(targetLanguageIdEl, countries);

  materialLanguageIdEl.value = ALL_TARGETS;
  targetLanguageIdEl.value = ALL_TARGETS;

  taskButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const task = button.dataset.task;
      runTask(task);
    });
  });

  clearOutputEl.addEventListener("click", () => {
    outputEl.classList.remove("error");
    outputEl.textContent = "Ready.";
  });

  appendOutput("GUI initialized.");
}

bootstrap().catch((error) => {
  outputEl.classList.add("error");
  outputEl.textContent = `Bootstrap failed: ${error.message}`;
});
