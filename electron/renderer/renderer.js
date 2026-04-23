const sourceLanguageIdEl = document.getElementById("sourceLanguageId");
const materialLanguageIdEl = document.getElementById("materialLanguageId");
const targetLanguageIdEl = document.getElementById("targetLanguageId");
const dryRunEl = document.getElementById("dryRun");
const outputEl = document.getElementById("output");
const clearOutputEl = document.getElementById("clearOutput");
const requestLoaderEl = document.getElementById("requestLoader");
const requestLoaderTextEl = document.getElementById("requestLoaderText");
const requestStatusEl = document.getElementById("requestStatus");
const requestStatusTextEl = document.getElementById("requestStatusText");
const transferSearchEl = document.getElementById("transferSearch");
const loadTransferProductsEl = document.getElementById("loadTransferProducts");
const transferProductsEl = document.getElementById("transferProducts");
const transferSelectedProductEl = document.getElementById("transferSelectedProduct");
const transferSpecsEl = document.getElementById("transferSpecs");
const submitTransferEl = document.getElementById("submitTransfer");
const taskButtons = [...document.querySelectorAll(".task-card[data-task]")];
const authGateEl = document.getElementById("authGate");
const loginFormEl = document.getElementById("loginForm");
const loginUsernameEl = document.getElementById("loginUsername");
const loginPasswordEl = document.getElementById("loginPassword");
const loginButtonEl = document.getElementById("loginButton");
const loginMessageEl = document.getElementById("loginMessage");
const sessionStateEl = document.getElementById("sessionState");
const logoutButtonEl = document.getElementById("logoutButton");
const ALL_TARGETS = "all";
let isBusy = false;
let isInitialized = false;
let requestDepth = 0;
let requestMessage = "Выполняется запрос...";
let selectedTransferProductId = null;
let transferSpecEntries = [];
let transferProductsCache = [];
let transferSearchDebounceTimer = null;
let authState = {
  required: true,
  authenticated: false,
  user: null,
};

function syncRequestIndicators() {
  const isLoading = requestDepth > 0;
  requestLoaderEl.classList.toggle("hidden", !isLoading);
  requestStatusEl.classList.toggle("hidden", !isLoading);

  if (!isLoading) {
    requestLoaderTextEl.textContent = "Выполняется запрос...";
    requestStatusTextEl.textContent = "Запрос выполняется...";
    return;
  }

  requestLoaderTextEl.textContent = requestMessage;
  requestStatusTextEl.textContent = requestMessage;
}

function beginRequest(message) {
  requestDepth += 1;
  if (message) {
    requestMessage = message;
  }
  syncRequestIndicators();
}

function endRequest() {
  requestDepth = Math.max(0, requestDepth - 1);
  if (requestDepth === 0) {
    requestMessage = "Выполняется запрос...";
  }
  syncRequestIndicators();
}

async function withRequestLoader(message, fn) {
  beginRequest(message);
  try {
    return await fn();
  } finally {
    endRequest();
  }
}

function appendOutput(text, isError = false) {
  if (outputEl.textContent.trim() === "Ready.") {
    outputEl.textContent = "";
  }

  outputEl.classList.toggle("error", isError);
  outputEl.textContent += `${text}\n`;
  outputEl.scrollTop = outputEl.scrollHeight;
}

function getSelectedTransferSpecIds() {
  return [...transferSpecsEl.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => Number(input.value))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function renderTransferProducts(products) {
  transferProductsEl.innerHTML = "";

  if (!Array.isArray(products) || products.length === 0) {
    transferProductsEl.textContent = "Ничего не найдено.";
    return;
  }

  for (const product of products) {
    const productId = Number(product.id);
    const productName =
      product && product.name !== null && product.name !== undefined
        ? String(product.name).trim()
        : "";
    const productModel =
      product && product.model !== null && product.model !== undefined
        ? String(product.model).trim()
        : "";
    const fallbackLabel =
      product && product.label !== null && product.label !== undefined
        ? String(product.label).trim()
        : "";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-button";
    button.dataset.productId = String(productId);

    const idLine = document.createElement("span");
    idLine.className = "product-button-id";
    idLine.textContent = `#${productId}`;

    const metaLine = document.createElement("span");
    metaLine.className = "product-button-meta";
    if (productName && productModel) {
      metaLine.textContent = `${productName} (${productModel})`;
    } else if (productName) {
      metaLine.textContent = productName;
    } else if (productModel) {
      metaLine.textContent = productModel;
    } else if (fallbackLabel) {
      metaLine.textContent = fallbackLabel;
    } else {
      metaLine.textContent = `Product #${productId}`;
    }

    button.title = metaLine.textContent;
    button.appendChild(idLine);
    button.appendChild(metaLine);

    if (productId === selectedTransferProductId) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      selectTransferProduct(productId).catch((error) => {
        outputEl.classList.add("error");
        appendOutput(`ERROR: ${error.message}`, true);
      });
    });
    transferProductsEl.appendChild(button);
  }
}

function createTransferSpecItem(spec) {
  const item = document.createElement("label");
  item.className = "transfer-spec-item";

  const head = document.createElement("span");
  head.className = "transfer-spec-head";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = String(spec.specificationId);
  checkbox.checked = true;

  const title = document.createElement("span");
  title.textContent = `${spec.specificationId} - ${spec.label}`;

  head.appendChild(checkbox);
  head.appendChild(title);

  const value = document.createElement("p");
  value.className = "transfer-spec-value";
  value.textContent =
    spec.value === null || spec.value === undefined || String(spec.value).trim() === ""
      ? "Пустое значение"
      : String(spec.value);

  item.appendChild(head);
  item.appendChild(value);

  return item;
}

function renderTransferSpecs(specs) {
  transferSpecsEl.innerHTML = "";
  transferSpecEntries = Array.isArray(specs) ? specs : [];

  if (transferSpecEntries.length === 0) {
    transferSpecsEl.textContent = "Для выбранного продукта нет значений по доступным пунктам.";
    return;
  }

  const groups = new Map();
  for (const spec of transferSpecEntries) {
    const groupKey = String(spec.groupKey || "other");
    const groupLabel = String(spec.groupLabel || "Прочее");
    const numericOrder = Number(spec.groupOrder);
    const groupOrder = Number.isFinite(numericOrder) ? numericOrder : 999;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        label: groupLabel,
        order: groupOrder,
        items: [],
      });
    }

    groups.get(groupKey).items.push(spec);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    return a.label.localeCompare(b.label, "ru");
  });

  for (const group of sortedGroups) {
    group.items.sort(
      (a, b) => Number(a.specificationId || 0) - Number(b.specificationId || 0)
    );

    const section = document.createElement("section");
    section.className = "transfer-spec-group";

    const header = document.createElement("h4");
    header.className = "transfer-spec-group-title";
    header.textContent = `${group.label} (${group.items.length})`;

    const list = document.createElement("div");
    list.className = "transfer-spec-group-list";

    for (const spec of group.items) {
      list.appendChild(createTransferSpecItem(spec));
    }

    section.appendChild(header);
    section.appendChild(list);
    transferSpecsEl.appendChild(section);
  }
}

function refreshActionButtons() {
  const requiresAuth = authState.required && !authState.authenticated;
  const shouldDisable = isBusy || requiresAuth;
  for (const button of taskButtons) {
    button.disabled = shouldDisable;
    button.style.opacity = shouldDisable ? "0.65" : "1";
  }

  loadTransferProductsEl.disabled = shouldDisable;
  transferSearchEl.disabled = shouldDisable;

  const selectedSpecIds = getSelectedTransferSpecIds();
  submitTransferEl.disabled =
    shouldDisable || !selectedTransferProductId || selectedSpecIds.length === 0;
  submitTransferEl.style.opacity = submitTransferEl.disabled ? "0.65" : "1";

  for (const button of transferProductsEl.querySelectorAll(".product-button")) {
    button.disabled = shouldDisable;
  }

  for (const checkbox of transferSpecsEl.querySelectorAll('input[type="checkbox"]')) {
    checkbox.disabled = shouldDisable;
  }
}

function setBusy(nextValue) {
  isBusy = Boolean(nextValue);
  refreshActionButtons();
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
  if (authState.required && !authState.authenticated) {
    appendOutput("ERROR: Sign in first.", true);
    return;
  }

  setBusy(true);
  outputEl.classList.remove("error");

  try {
    const payload = buildPayload(task);
    appendOutput(`>>> Running: ${task}`);

    const response = await withRequestLoader(
      `Выполняем задачу "${task}"...`,
      () => window.specApi.runTask(payload)
    );

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

function formatTransferStats(stats) {
  return [
    `Task: ${stats.taskName}`,
    `Product ID: ${stats.productId}`,
    `Source language: ${stats.sourceLanguageId}`,
    `Targets: ${Array.isArray(stats.targetLanguageIds) ? stats.targetLanguageIds.join(", ") : stats.targetLanguageId}`,
    `Spec IDs: ${Array.isArray(stats.specIds) ? stats.specIds.join(", ") : "-"}`,
    `Total operations: ${stats.total}`,
    `Updated: ${stats.updated}`,
    `Skipped: ${stats.skipped}`,
    `Failed: ${stats.failed}`,
    `Mode: ${stats.dryRun ? "dry-run" : "write"}`,
  ].join("\n");
}

async function loadTransferProducts() {
  if (transferSearchDebounceTimer !== null) {
    clearTimeout(transferSearchDebounceTimer);
    transferSearchDebounceTimer = null;
  }

  const payload = {
    sourceLanguageId: Number(sourceLanguageIdEl.value || 1),
    search: transferSearchEl.value.trim(),
    limit: 120,
  };

  const products = await withRequestLoader("Загружаем список продуктов...", () =>
    window.specApi.listTransferProducts(payload)
  );

  transferProductsCache = Array.isArray(products) ? products : [];
  selectedTransferProductId = null;
  transferSpecEntries = [];
  transferSelectedProductEl.textContent = "Продукт не выбран.";
  renderTransferProducts(transferProductsCache);
  renderTransferSpecs([]);
  refreshActionButtons();
}

function scheduleTransferSearch() {
  if (transferSearchDebounceTimer !== null) {
    clearTimeout(transferSearchDebounceTimer);
    transferSearchDebounceTimer = null;
  }

  transferSearchDebounceTimer = setTimeout(() => {
    transferSearchDebounceTimer = null;
    loadTransferProducts().catch((error) => {
      outputEl.classList.add("error");
      appendOutput(`ERROR: ${error.message}`, true);
    });
  }, 320);
}

async function selectTransferProduct(productId) {
  if (!Number.isInteger(productId) || productId < 1) {
    return;
  }

  selectedTransferProductId = productId;
  transferSelectedProductEl.textContent = `Выбран продукт: #${productId}`;

  const specs = await withRequestLoader("Загружаем пункты спецификации...", () =>
    window.specApi.getTransferProductSpecs({
      productId,
      sourceLanguageId: Number(sourceLanguageIdEl.value || 1),
    })
  );

  renderTransferProducts(transferProductsCache);
  renderTransferSpecs(specs);
  refreshActionButtons();
}

async function submitTransferSelection() {
  if (!selectedTransferProductId) {
    appendOutput("ERROR: Сначала выберите продукт.", true);
    return;
  }

  const specIds = getSelectedTransferSpecIds();
  if (specIds.length === 0) {
    appendOutput("ERROR: Отметьте минимум один пункт для переноса.", true);
    return;
  }

  setBusy(true);
  outputEl.classList.remove("error");

  try {
    appendOutput(`>>> Transfer product #${selectedTransferProductId}`);
    const result = await withRequestLoader("Переносим выбранные пункты...", () =>
      window.specApi.submitTransfer({
        productId: selectedTransferProductId,
        sourceLanguageId: Number(sourceLanguageIdEl.value || 1),
        targetLanguageId: targetLanguageIdEl.value || ALL_TARGETS,
        specIds,
        dryRun: dryRunEl.checked,
      })
    );

    appendOutput("------------------------------");
    appendOutput(formatTransferStats(result));

    if (Array.isArray(result.details)) {
      for (const detail of result.details) {
        appendOutput(
          `Target ${detail.targetLanguageId}: updated=${detail.updated}, skipped=${detail.skipped}, failed=${detail.failed}`
        );
      }
    }

    appendOutput(`Finished at: ${new Date().toLocaleString()}`);
  } catch (error) {
    outputEl.classList.add("error");
    appendOutput(`ERROR: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function ensureInitialized() {
  if (isInitialized) {
    return;
  }

  const countries = await withRequestLoader(
    "Загружаем настройки языков...",
    () => window.specApi.getCountries()
  );
  fillLanguageSelect(materialLanguageIdEl, countries);
  fillLanguageSelect(targetLanguageIdEl, countries);

  materialLanguageIdEl.value = ALL_TARGETS;
  targetLanguageIdEl.value = ALL_TARGETS;
  isInitialized = true;
  appendOutput("GUI initialized.");
}

function setLoginMessage(message) {
  loginMessageEl.textContent = message || "";
}

function setSessionState(nextState) {
  authState = {
    ...authState,
    ...nextState,
  };

  const isLocked = authState.required && !authState.authenticated;
  authGateEl.classList.toggle("hidden", !isLocked);
  logoutButtonEl.hidden = !(authState.required && authState.authenticated);

  if (authState.authenticated) {
    const username = authState.user?.username || "user";
    sessionStateEl.textContent = `Signed in as: ${username}`;
  } else if (authState.required) {
    sessionStateEl.textContent = "Not signed in";
  } else {
    sessionStateEl.textContent = "Auth disabled (local mode)";
  }

  refreshActionButtons();
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const username = loginUsernameEl.value.trim();
  const password = loginPasswordEl.value;
  if (!username || !password) {
    setLoginMessage("Enter username and password.");
    return;
  }

  loginButtonEl.disabled = true;
  setLoginMessage("");

  try {
    const session = await withRequestLoader("Проверяем учетные данные...", () =>
      window.specApi.login({ username, password })
    );
    setSessionState(session);
    loginPasswordEl.value = "";
    await ensureInitialized();
    appendOutput(`Authenticated as ${session.user?.username || username}.`);
  } catch (error) {
    setLoginMessage(error.message || "Authentication failed");
  } finally {
    loginButtonEl.disabled = false;
  }
}

async function handleLogout() {
  try {
    const session = await withRequestLoader("Завершаем сессию...", () =>
      window.specApi.logout()
    );
    setSessionState(session);
    setLoginMessage("Signed out.");
    loginPasswordEl.value = "";
    loginUsernameEl.focus();
    appendOutput("Session closed.");
  } catch (error) {
    setLoginMessage(error.message || "Logout failed");
  }
}

function bindEvents() {
  loginFormEl.addEventListener("submit", handleLoginSubmit);
  logoutButtonEl.addEventListener("click", handleLogout);

  loadTransferProductsEl.addEventListener("click", () => {
    loadTransferProducts().catch((error) => {
      outputEl.classList.add("error");
      appendOutput(`ERROR: ${error.message}`, true);
    });
  });

  transferSearchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    loadTransferProducts().catch((error) => {
      outputEl.classList.add("error");
      appendOutput(`ERROR: ${error.message}`, true);
    });
  });

  transferSearchEl.addEventListener("input", () => {
    const query = transferSearchEl.value.trim();
    if (query.length === 1 && Number.isNaN(Number(query))) {
      return;
    }
    scheduleTransferSearch();
  });

  transferSpecsEl.addEventListener("change", () => {
    refreshActionButtons();
  });

  submitTransferEl.addEventListener("click", () => {
    submitTransferSelection();
  });

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
}

async function bootstrap() {
  bindEvents();
  syncRequestIndicators();

  const authConfig = await withRequestLoader("Проверяем режим доступа...", () =>
    window.specApi.getAuthConfig()
  );
  if (!authConfig.required) {
    setSessionState({
      required: false,
      authenticated: true,
      user: { id: 0, username: "local" },
    });
    authGateEl.classList.add("hidden");
    await ensureInitialized();
    return;
  }

  const session = await withRequestLoader("Проверяем текущую сессию...", () =>
    window.specApi.getAuthSession()
  );
  setSessionState(session);

  if (session.authenticated) {
    await ensureInitialized();
    return;
  }

  setLoginMessage("Sign in to continue.");
  appendOutput("Authentication required.");
  loginUsernameEl.focus();
}

bootstrap().catch((error) => {
  outputEl.classList.add("error");
  outputEl.textContent = `Bootstrap failed: ${error.message}`;
});
