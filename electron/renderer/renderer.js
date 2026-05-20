const sourceLanguageIdEl = document.getElementById("sourceLanguageId");
const materialLanguageIdEl = document.getElementById("materialLanguageId");
const targetLanguageIdEl = document.getElementById("targetLanguageId");
const dryRunEl = document.getElementById("dryRun");
const outputEl = document.getElementById("output");
const clearOutputEl = document.getElementById("clearOutput");
const requestLoaderEl = document.getElementById("requestLoader");
const requestLoaderTextEl = document.getElementById("requestLoaderText");
const requestLoaderProgressWrapEl = document.getElementById("requestLoaderProgressWrap");
const requestLoaderProgressLabelEl = document.getElementById("requestLoaderProgressLabel");
const requestLoaderProgressCountEl = document.getElementById("requestLoaderProgressCount");
const requestLoaderProgressBarEl = document.getElementById("requestLoaderProgressBar");
const requestStatusEl = document.getElementById("requestStatus");
const requestStatusTextEl = document.getElementById("requestStatusText");
const progressWrapEl = document.getElementById("progressWrap");
const progressLabelEl = document.getElementById("progressLabel");
const progressCountEl = document.getElementById("progressCount");
const progressBarEl = document.getElementById("progressBar");
const transferSearchEl = document.getElementById("transferSearch");
const loadTransferProductsEl = document.getElementById("loadTransferProducts");
const advancedSettingsPanelEl = document.getElementById("advancedSettingsPanel");
const advancedSettingsNoticeEl = document.getElementById("advancedSettingsNotice");
const advancedTasksPanelEl = document.getElementById("advancedTasksPanel");
const advancedTasksNoticeEl = document.getElementById("advancedTasksNotice");
const transferProductsEl = document.getElementById("transferProducts");
const transferSelectedProductEl = document.getElementById("transferSelectedProduct");
const transferSpecsEl = document.getElementById("transferSpecs");
const transferSpecsSearchEl = document.getElementById("transferSpecsSearch");
const openTransferSpecsModalEl = document.getElementById("openTransferSpecsModal");
const transferSpecsModalEl = document.getElementById("transferSpecsModal");
const closeTransferSpecsModalEl = document.getElementById("closeTransferSpecsModal");
const selectAllTransferSpecsEl = document.getElementById("selectAllTransferSpecs");
const clearTransferSpecsSelectionEl = document.getElementById("clearTransferSpecsSelection");
const transferSelectionSummaryEl = document.getElementById("transferSelectionSummary");
const transferSelectionSummaryModalEl = document.getElementById("transferSelectionSummaryModal");
const submitTransferEl = document.getElementById("submitTransfer");
const submitTransferModalEl = document.getElementById("submitTransferModal");
const productActionModalEl = document.getElementById("productActionModal");
const closeProductActionModalEl = document.getElementById("closeProductActionModal");
const productActionMetaEl = document.getElementById("productActionMeta");
const chooseTransferModeEl = document.getElementById("chooseTransferMode");
const chooseEditModeEl = document.getElementById("chooseEditMode");
const transferSelectionToolsEl = document.getElementById("transferSelectionTools");
const transferActionsEl = document.getElementById("transferActions");
const editorModalEl = document.getElementById("editorModal");
const closeEditorModalEl = document.getElementById("closeEditorModal");
const editorLanguageIdEl = document.getElementById("editorLanguageId");
const editorSpecsSearchEl = document.getElementById("editorSpecsSearch");
const editorSpecsEl = document.getElementById("editorSpecs");
const editorProductMetaEl = document.getElementById("editorProductMeta");
const editorDirtySummaryEl = document.getElementById("editorDirtySummary");
const saveEditorSpecsEl = document.getElementById("saveEditorSpecs");
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
let selectedTransferProductData = null;
let transferSpecEntries = [];
let selectedTransferSpecIds = new Set();
let transferSpecsSearchQuery = "";
let transferProductsCache = [];
let transferSearchDebounceTimer = null;
let selectedProductActionMode = null;
let editorEntries = [];
let editorInitialEntries = [];
let editorSpecsSearchQuery = "";
let editorLanguageOptions = [];
let activeEditorLanguageId = null;
let editorDraftsByLanguage = new Map();
let plannedTaskStageTotal = 0;
let authState = {
  required: true,
  authenticated: false,
  user: null,
};
const ADVANCED_ROLES = new Set(["advanced", "admin"]);
const TASK_NAME_LABELS = {
  material: "Материал",
  color: "Цвет",
  height: "Высота",
  load: "Нагрузка",
  autofill: "Автозаполнение",
  "vesa-repair": "VESA Repair",
  all: "Все задачи",
  "update-material": "Обновление материала",
  "update-color": "Обновление цвета",
  "update-vesa-repair": "Восстановление VESA",
  "update-vesa": "Обновление VESA",
  "update-diagonal-max": "Обновление диагонали (max)",
  "update-diagonal-min": "Обновление диагонали (min)",
  "update-turn-angle-a": "Обновление угла наклона вверх",
  "update-turn-angle-b": "Обновление угла наклона вниз",
  "update-rotation-angle-a": "Обновление угла поворота",
  "update-rotation-angle-b": "Обновление угла вращения",
  "update-warranty": "Обновление гарантии",
  "update-group-quantity": "Обновление количества в групповой",
  "transfer-selected-specifications": "Перенос выбранных спецификаций",
};

function getTaskLabel(taskName) {
  const key = String(taskName || "").trim();
  return TASK_NAME_LABELS[key] || key || "-";
}

function getCurrentUserRole() {
  return String(authState.user?.role || "user").trim().toLowerCase();
}

function hasAdvancedAccess() {
  if (!authState.required) {
    return true;
  }

  return authState.authenticated && ADVANCED_ROLES.has(getCurrentUserRole());
}

function applyAccessControls() {
  const canUseAdvanced = hasAdvancedAccess();
  advancedSettingsPanelEl.classList.toggle("is-access-locked", !canUseAdvanced);
  advancedTasksPanelEl.classList.toggle("is-access-locked", !canUseAdvanced);
  advancedSettingsNoticeEl.classList.toggle("hidden", canUseAdvanced);
  advancedTasksNoticeEl.classList.toggle("hidden", canUseAdvanced);
}

function getProductSummaryText(product) {
  if (!product) {
    return "Продукт не выбран.";
  }

  const productId = Number(product.id || product.productId || selectedTransferProductId || 0);
  const name = product.name || product.productName || product.label || "";
  const model = product.model || product.productModel || "";
  const parts = [`#${productId}`];
  if (model) {
    parts.push(model);
  }
  if (name) {
    parts.push(name);
  }
  return `Выбран продукт: ${parts.join(" · ")}`;
}

function normalizeEntryValue(entry) {
  return String(entry?.value || "").trim();
}

function normalizeEntryValues(entry) {
  const values = Array.isArray(entry?.values) ? entry.values : [];
  const unique = [];
  for (const rawValue of values) {
    const value = String(rawValue || "").trim();
    if (!value || unique.includes(value)) {
      continue;
    }
    unique.push(value);
  }
  return unique;
}

function areArraysEqual(leftValues, rightValues) {
  const left = [...leftValues].sort();
  const right = [...rightValues].sort();
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

function isEditorEntryChanged(entry) {
  const initialEntry = editorInitialEntries.find(
    (candidate) => Number(candidate.specificationId) === Number(entry.specificationId)
  );
  if (!initialEntry) {
    return false;
  }

  if (entry.fieldType === "multi") {
    return !areArraysEqual(
      normalizeEntryValues(entry),
      normalizeEntryValues(initialEntry)
    );
  }

  return normalizeEntryValue(entry) !== normalizeEntryValue(initialEntry);
}

function getChangedEditorEntries() {
  return editorEntries.filter((entry) => isEditorEntryChanged(entry));
}

function cloneEditorEntry(entry) {
  return {
    ...entry,
    values: Array.isArray(entry?.values) ? [...entry.values] : [],
    sourceValues: Array.isArray(entry?.sourceValues) ? [...entry.sourceValues] : [],
    options: Array.isArray(entry?.options) ? [...entry.options] : [],
  };
}

function cloneEditorEntries(entries) {
  return Array.isArray(entries) ? entries.map((entry) => cloneEditorEntry(entry)) : [];
}

function getChangedEntriesForDraft(draft) {
  const entries = Array.isArray(draft?.entries) ? draft.entries : [];
  const initialEntries = Array.isArray(draft?.initialEntries) ? draft.initialEntries : [];

  return entries.filter((entry) => {
    const initialEntry = initialEntries.find(
      (candidate) => Number(candidate.specificationId) === Number(entry.specificationId)
    );
    if (!initialEntry) {
      return false;
    }

    if (entry.fieldType === "multi") {
      return !areArraysEqual(
        normalizeEntryValues(entry),
        normalizeEntryValues(initialEntry)
      );
    }

    return normalizeEntryValue(entry) !== normalizeEntryValue(initialEntry);
  });
}

function countEditorDraftChanges() {
  let languageCount = 0;
  let itemCount = 0;

  for (const draft of editorDraftsByLanguage.values()) {
    const changedEntries = getChangedEntriesForDraft(draft);
    if (changedEntries.length === 0) {
      continue;
    }
    languageCount += 1;
    itemCount += changedEntries.length;
  }

  return { languageCount, itemCount };
}

function storeCurrentEditorDraft() {
  if (!activeEditorLanguageId) {
    return;
  }

  if (editorEntries.length === 0 && editorInitialEntries.length === 0) {
    return;
  }

  editorDraftsByLanguage.set(Number(activeEditorLanguageId), {
    entries: cloneEditorEntries(editorEntries),
    initialEntries: cloneEditorEntries(editorInitialEntries),
  });
}

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

function resetProgress() {
  plannedTaskStageTotal = 0;
  progressWrapEl.classList.add("hidden");
  progressLabelEl.textContent = "Подготовка...";
  progressCountEl.textContent = "0 / 0";
  progressBarEl.style.width = "0%";
  requestLoaderProgressWrapEl.classList.add("hidden");
  requestLoaderProgressLabelEl.textContent = "Подготовка...";
  requestLoaderProgressCountEl.textContent = "0 / 0";
  requestLoaderProgressBarEl.style.width = "0%";
}

function updateProgress(payload) {
  const total = Math.max(Number(payload?.total) || 0, 0);
  const done = Math.min(Math.max(Number(payload?.done) || 0, 0), total || 0);
  const remaining = Math.max(total - done, 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const stageTotalRaw = Number(payload?.stageTotal) || plannedTaskStageTotal || 0;
  const stageTotal = Math.max(stageTotalRaw, 0);
  const stageIndex = Math.max(Number(payload?.stageIndex) || 0, 0);
  const stagePercent = total > 0 ? Math.round((done / total) * 100) : 0;

  let label = "Выполнение...";
  if (payload?.type === "task") {
    const taskLabel = getTaskLabel(payload.taskName);
    const specPart = Number.isInteger(Number(payload.specificationId))
      ? ` · spec ${payload.specificationId}`
      : "";
    label = `${taskLabel}${specPart}`;
  } else if (payload?.type === "transfer") {
    label = `Перенос товара #${payload.productId || "-"}`;
  }

  let overallPercent = percent;
  let countText = `${done} / ${total} (${percent}%)`;
  let overlayCountText = `${done} / ${total} (${percent}%)`;

  if (payload?.type === "task" && stageTotal > 0 && stageIndex > 0) {
    const ratioWithinStage = total > 0 ? done / total : 0;
    overallPercent = Math.round((((stageIndex - 1) + ratioWithinStage) / stageTotal) * 100);
    countText =
      `Этап ${stageIndex} / ${stageTotal} · ${done} / ${total} (${stagePercent}%) · ` +
      `общий ${overallPercent}% · осталось ${remaining}`;
    overlayCountText = `Этап ${stageIndex}/${stageTotal} · общий ${overallPercent}%`;
  } else {
    countText = `${done} / ${total} (${percent}%) · осталось ${remaining}`;
    overlayCountText = `${done} / ${total} (${percent}%)`;
  }

  progressWrapEl.classList.remove("hidden");
  progressLabelEl.textContent = label;
  progressCountEl.textContent = countText;
  progressBarEl.style.width = `${overallPercent}%`;

  requestLoaderProgressWrapEl.classList.remove("hidden");
  requestLoaderProgressLabelEl.textContent = label;
  requestLoaderProgressCountEl.textContent = overlayCountText;
  requestLoaderProgressBarEl.style.width = `${overallPercent}%`;
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
  if (outputEl.textContent.trim() === "Готово.") {
    outputEl.textContent = "";
  }

  outputEl.classList.toggle("error", isError);
  outputEl.textContent += `${text}\n`;
  outputEl.scrollTop = outputEl.scrollHeight;
}

function getSelectedTransferSpecIds() {
  return [...selectedTransferSpecIds];
}

function updateTransferSelectionSummary() {
  const selectedCount = selectedTransferSpecIds.size;
  const totalCount = transferSpecEntries.length;
  const text = `Выбрано пунктов: ${selectedCount} из ${totalCount}`;
  transferSelectionSummaryEl.textContent = text;
  transferSelectionSummaryModalEl.textContent = text;
}

function updateEditorDirtySummary() {
  storeCurrentEditorDraft();
  const changedCount = getChangedEditorEntries().length;
  const draftCounts = countEditorDraftChanges();
  editorDirtySummaryEl.textContent =
    `Текущий язык: ${changedCount} · Всего: ${draftCounts.itemCount} ` +
    `в ${draftCounts.languageCount} языках`;
}

function setSelectedProductActionMode(nextMode) {
  selectedProductActionMode = nextMode || null;
  transferSelectionToolsEl.classList.toggle("hidden", selectedProductActionMode !== "transfer");
  transferActionsEl.classList.toggle("hidden", selectedProductActionMode !== "transfer");
}

function openTransferSpecsModal() {
  if (!selectedTransferProductId || transferSpecEntries.length === 0) {
    return;
  }

  transferSpecsModalEl.classList.remove("hidden");
}

function closeTransferSpecsModal() {
  transferSpecsModalEl.classList.add("hidden");
}

function openProductActionModal() {
  productActionModalEl.classList.remove("hidden");
}

function closeProductActionModal() {
  productActionModalEl.classList.add("hidden");
}

function openEditorModal() {
  editorModalEl.classList.remove("hidden");
}

function closeEditorModal() {
  editorModalEl.classList.add("hidden");
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function getFilteredTransferSpecEntries() {
  const query = normalizeSearchText(transferSpecsSearchQuery);
  if (!query) {
    return transferSpecEntries;
  }

  return transferSpecEntries.filter((spec) => {
    const idText = String(spec?.specificationId || "");
    const labelText = normalizeSearchText(spec?.label);
    const valueText = normalizeSearchText(spec?.value);
    const groupText = normalizeSearchText(spec?.groupLabel);
    return (
      idText.includes(query) ||
      labelText.includes(query) ||
      valueText.includes(query) ||
      groupText.includes(query)
    );
  });
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
    const imageUrl =
      product && product.imageUrl !== null && product.imageUrl !== undefined
        ? String(product.imageUrl).trim()
        : "";
    const numericStatus = Number(product?.status);
    const statusValue =
      numericStatus === 1 ? 1 : numericStatus === 0 ? 0 : null;
    const statusLabel =
      statusValue === 1
        ? "Активен"
        : statusValue === 0
          ? "Неактивен"
          : "Статус ?";
    const statusClass =
      statusValue === 1
        ? "is-active"
        : statusValue === 0
          ? "is-inactive"
          : "is-unknown";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-button";
    button.dataset.productId = String(productId);

    const thumb = document.createElement("span");
    thumb.className = "product-button-thumb";

    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "product-button-image";
      image.src = imageUrl;
      image.alt = productName || `Товар #${productId}`;
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        thumb.classList.add("empty");
        image.remove();
      });
      thumb.appendChild(image);
    } else {
      thumb.classList.add("empty");
    }

    const topLine = document.createElement("div");
    topLine.className = "product-button-top";

    const idLine = document.createElement("span");
    idLine.className = "product-button-id";
    idLine.textContent = productModel
      ? `#${productId} | ${productModel}`
      : `#${productId}`;

    const statusBadge = document.createElement("span");
    statusBadge.className = `product-status ${statusClass}`;
    statusBadge.textContent = statusLabel;

    const metaLine = document.createElement("span");
    metaLine.className = "product-button-meta";
    if (productName) {
      metaLine.textContent = productName;
    } else if (productModel) {
      metaLine.textContent = productModel;
    } else if (fallbackLabel) {
      metaLine.textContent = fallbackLabel;
    } else {
      metaLine.textContent = `Товар #${productId}`;
    }

    button.title = metaLine.textContent;
    button.appendChild(thumb);
    topLine.appendChild(idLine);
    topLine.appendChild(statusBadge);
    button.appendChild(topLine);
    button.appendChild(metaLine);

    if (productId === selectedTransferProductId) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      selectTransferProduct(productId).catch((error) => {
        outputEl.classList.add("error");
        appendOutput(`ОШИБКА: ${error.message}`, true);
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
  const specId = Number(spec.specificationId);
  checkbox.value = String(specId);
  checkbox.checked = selectedTransferSpecIds.has(specId);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedTransferSpecIds.add(specId);
    } else {
      selectedTransferSpecIds.delete(specId);
    }
    updateTransferSelectionSummary();
    refreshActionButtons();
  });

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
  if (Array.isArray(specs)) {
    transferSpecEntries = specs;
  }

  if (transferSpecEntries.length === 0) {
    selectedTransferSpecIds.clear();
    updateTransferSelectionSummary();
    transferSpecsEl.textContent = "Для выбранного продукта нет значений по доступным пунктам.";
    return;
  }

  const filteredSpecs = getFilteredTransferSpecEntries();
  if (filteredSpecs.length === 0) {
    updateTransferSelectionSummary();
    transferSpecsEl.textContent = "По этому фильтру пункты не найдены.";
    return;
  }

  const groups = new Map();
  for (const spec of filteredSpecs) {
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

  updateTransferSelectionSummary();
}

function getFilteredEditorEntries() {
  const query = normalizeSearchText(editorSpecsSearchQuery);
  if (!query) {
    return editorEntries;
  }

  return editorEntries.filter((entry) => {
    const idText = String(entry?.specificationId || "");
    const labelText = normalizeSearchText(entry?.label);
    const valueText = normalizeSearchText(
      entry?.fieldType === "multi"
        ? normalizeEntryValues(entry).join(", ")
        : normalizeEntryValue(entry)
    );
    const sourceText = normalizeSearchText(
      entry?.fieldType === "multi"
        ? normalizeEntryValues({ values: entry?.sourceValues || [] }).join(", ")
        : String(entry?.sourceValue || "")
    );
    const groupText = normalizeSearchText(entry?.groupLabel);
    return (
      idText.includes(query) ||
      labelText.includes(query) ||
      valueText.includes(query) ||
      sourceText.includes(query) ||
      groupText.includes(query)
    );
  });
}

function createEditorSpecItem(entry) {
  const item = document.createElement("section");
  item.className = "transfer-spec-item";
  if (isEditorEntryChanged(entry)) {
    item.classList.add("editor-field-changed");
  }

  const title = document.createElement("div");
  title.className = "transfer-spec-head";
  title.textContent = `${entry.specificationId} - ${entry.label}`;
  item.appendChild(title);

  if (entry.fieldType === "multi") {
    const optionsWrap = document.createElement("div");
    optionsWrap.className = "editor-spec-options";

    for (const option of Array.isArray(entry.options) ? entry.options : []) {
      const label = document.createElement("label");
      label.className = "editor-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = normalizeEntryValues(entry).includes(option.value);
      checkbox.addEventListener("change", () => {
        const nextValues = new Set(normalizeEntryValues(entry));
        if (checkbox.checked) {
          nextValues.add(option.value);
        } else {
          nextValues.delete(option.value);
        }
        entry.values = [...nextValues];
        storeCurrentEditorDraft();
        renderEditorSpecs();
        refreshActionButtons();
      });

      const text = document.createElement("span");
      text.textContent = option.label;

      label.appendChild(checkbox);
      label.appendChild(text);
      optionsWrap.appendChild(label);
    }

    item.appendChild(optionsWrap);
  } else if (entry.fieldType === "choice") {
    const optionsWrap = document.createElement("div");
    optionsWrap.className = "editor-spec-options";

    for (const option of Array.isArray(entry.options) ? entry.options : []) {
      const label = document.createElement("label");
      label.className = "editor-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `editor-spec-${entry.specificationId}`;
      radio.checked = String(entry.value || "") === String(option.value || "");
      radio.addEventListener("change", () => {
        if (!radio.checked) {
          return;
        }
        entry.value = String(option.value || "");
        storeCurrentEditorDraft();
        renderEditorSpecs();
        refreshActionButtons();
      });

      const text = document.createElement("span");
      text.textContent = option.label;

      label.appendChild(radio);
      label.appendChild(text);
      optionsWrap.appendChild(label);
    }

    item.appendChild(optionsWrap);
  } else {
    const referenceValue = String(entry?.sourceValue || "");
    const useTextarea =
      normalizeEntryValue(entry).length > 72 || referenceValue.length > 72;
    const input = useTextarea
      ? document.createElement("textarea")
      : document.createElement("input");
    input.className = useTextarea ? "editor-spec-textarea" : "editor-spec-input";
    if (!useTextarea) {
      input.type = "text";
    }
    input.value = entry.value || "";
    input.addEventListener("input", () => {
      entry.value = input.value;
      storeCurrentEditorDraft();
      updateEditorDirtySummary();
      item.classList.toggle("editor-field-changed", isEditorEntryChanged(entry));
      refreshActionButtons();
    });
    item.appendChild(input);
  }

  const reference = document.createElement("p");
  reference.className = "editor-spec-reference";
  if (entry.fieldType === "multi") {
    const sourceText = normalizeEntryValues({ values: entry.sourceValues }).join(", ");
    reference.innerHTML = `<strong>Источник (1):</strong> ${sourceText || "пусто"}`;
  } else {
    reference.innerHTML = `<strong>Источник (1):</strong> ${String(entry.sourceValue || "пусто")}`;
  }
  item.appendChild(reference);

  return item;
}

function renderEditorSpecs(entries = editorEntries) {
  if (Array.isArray(entries) && entries !== editorEntries) {
    editorEntries = entries;
  }

  editorSpecsEl.innerHTML = "";

  if (editorEntries.length === 0) {
    editorSpecsEl.textContent = "Для выбранного языка нет доступных пунктов.";
    updateEditorDirtySummary();
    return;
  }

  const filteredEntries = getFilteredEditorEntries();
  if (filteredEntries.length === 0) {
    editorSpecsEl.textContent = "По этому фильтру пункты не найдены.";
    updateEditorDirtySummary();
    return;
  }

  const groups = new Map();
  for (const entry of filteredEntries) {
    const groupKey = String(entry.groupKey || "other");
    const groupLabel = String(entry.groupLabel || "Прочее");
    const groupOrder = Number(entry.groupOrder) || 999;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        label: groupLabel,
        order: groupOrder,
        items: [],
      });
    }

    groups.get(groupKey).items.push(entry);
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

    for (const entry of group.items) {
      list.appendChild(createEditorSpecItem(entry));
    }

    section.appendChild(header);
    section.appendChild(list);
    editorSpecsEl.appendChild(section);
  }

  updateEditorDirtySummary();
}

function refreshActionButtons() {
  const requiresAuth = authState.required && !authState.authenticated;
  const shouldDisable = isBusy || requiresAuth;
  const canUseAdvanced = hasAdvancedAccess();
  for (const button of taskButtons) {
    button.disabled = shouldDisable || !canUseAdvanced;
    button.style.opacity = button.disabled ? "0.65" : "1";
  }

  sourceLanguageIdEl.disabled = shouldDisable || !canUseAdvanced;
  materialLanguageIdEl.disabled = shouldDisable || !canUseAdvanced;
  targetLanguageIdEl.disabled = shouldDisable || !canUseAdvanced;
  dryRunEl.disabled = shouldDisable || !canUseAdvanced;

  loadTransferProductsEl.disabled = shouldDisable;
  transferSearchEl.disabled = shouldDisable;
  chooseTransferModeEl.disabled =
    shouldDisable || !selectedTransferProductId;
  chooseEditModeEl.disabled =
    shouldDisable || !selectedTransferProductId;
  openTransferSpecsModalEl.disabled =
    shouldDisable ||
    selectedProductActionMode !== "transfer" ||
    !selectedTransferProductId ||
    transferSpecEntries.length === 0;
  selectAllTransferSpecsEl.disabled =
    shouldDisable || transferSpecEntries.length === 0;
  clearTransferSpecsSelectionEl.disabled =
    shouldDisable || transferSpecEntries.length === 0;
  editorLanguageIdEl.disabled = shouldDisable || !selectedTransferProductId;
  editorSpecsSearchEl.disabled =
    shouldDisable || editorEntries.length === 0;
  saveEditorSpecsEl.disabled =
    shouldDisable ||
    !selectedTransferProductId ||
    !activeEditorLanguageId ||
    countEditorDraftChanges().itemCount === 0;
  saveEditorSpecsEl.style.opacity = saveEditorSpecsEl.disabled ? "0.65" : "1";

  const selectedSpecIds = getSelectedTransferSpecIds();
  submitTransferEl.disabled =
    shouldDisable ||
    selectedProductActionMode !== "transfer" ||
    !selectedTransferProductId ||
    selectedSpecIds.length === 0;
  submitTransferEl.style.opacity = submitTransferEl.disabled ? "0.65" : "1";
  submitTransferModalEl.disabled = submitTransferEl.disabled;
  submitTransferModalEl.style.opacity = submitTransferModalEl.disabled ? "0.65" : "1";

  for (const button of transferProductsEl.querySelectorAll(".product-button")) {
    button.disabled = shouldDisable;
  }

  for (const checkbox of transferSpecsEl.querySelectorAll('input[type="checkbox"]')) {
    checkbox.disabled = shouldDisable;
  }

  applyAccessControls();
}

function setBusy(nextValue) {
  isBusy = Boolean(nextValue);
  if (!isBusy) {
    resetProgress();
  }
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
    `Задача: ${getTaskLabel(taskStats.taskName)}`,
    `Исходный язык: ${taskStats.sourceLanguageId}`,
    `Язык назначения: ${taskStats.targetLanguageId}`,
    `ID спецификации: ${taskStats.specificationId}`,
    `Всего: ${taskStats.total}`,
    `Обновлено: ${taskStats.updated}`,
    `Пропущено: ${taskStats.skipped}`,
    `Ошибок: ${taskStats.failed}`,
    `Режим: ${taskStats.dryRun ? "тестовый (dry-run)" : "запись"}`,
  ].join("\n");
}

async function runTask(task) {
  if (authState.required && !authState.authenticated) {
    appendOutput("ОШИБКА: Сначала выполните вход.", true);
    return;
  }
  if (!hasAdvancedAccess()) {
    appendOutput("ОШИБКА: Недостаточно прав. Нужна роль advanced или admin.", true);
    return;
  }

  setBusy(true);
  outputEl.classList.remove("error");

  try {
    const payload = buildPayload(task);
    appendOutput(`>>> Запуск: ${getTaskLabel(task)}`);

    const response = await withRequestLoader(
      `Выполняем задачу "${task}"...`,
      () => window.specApi.runTask(payload)
    );

    for (const taskStats of response.tasks) {
      appendOutput("------------------------------");
      appendOutput(formatTaskStats(taskStats));
    }

    appendOutput(`Завершено: ${new Date(response.finishedAt).toLocaleString()}`);
  } catch (error) {
    outputEl.classList.add("error");
    appendOutput(`ОШИБКА: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

function fillLanguageSelect(selectEl, countries) {
  selectEl.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = ALL_TARGETS;
  allOption.textContent = `${ALL_TARGETS} - Все доступные языки`;
  selectEl.appendChild(allOption);

  for (const [languageId, countryCode] of Object.entries(countries)) {
    const option = document.createElement("option");
    option.value = languageId;
    option.textContent = `${languageId} - ${countryCode}`;
    selectEl.appendChild(option);
  }
}

function fillEditorLanguageSelect(selectEl, countries) {
  selectEl.innerHTML = "";
  const sourceLanguageId = Number(sourceLanguageIdEl.value || 1) || 1;
  const sourceCountryCode =
    countries && countries[sourceLanguageId]
      ? countries[sourceLanguageId]
      : sourceLanguageId === 1
        ? "RU"
        : "Источник";
  editorLanguageOptions = [
    { id: sourceLanguageId, label: `${sourceLanguageId} - ${sourceCountryCode}` },
  ];

  for (const [languageId, countryCode] of Object.entries(countries)) {
    if (Number(languageId) === sourceLanguageId) {
      continue;
    }
    editorLanguageOptions.push({
      id: Number(languageId),
      label: `${languageId} - ${countryCode}`,
    });
  }

  for (const optionData of editorLanguageOptions) {
    const option = document.createElement("option");
    option.value = String(optionData.id);
    option.textContent = optionData.label;
    selectEl.appendChild(option);
  }
}

function formatTransferStats(stats) {
  return [
    `Задача: ${getTaskLabel(stats.taskName)}`,
    `ID товара: ${stats.productId}`,
    `Название товара: ${stats.productName || "-"}`,
    `Исходный язык: ${stats.sourceLanguageId}`,
    `Языки назначения: ${Array.isArray(stats.targetLanguageIds) ? stats.targetLanguageIds.join(", ") : stats.targetLanguageId}`,
    `ID спецификаций: ${Array.isArray(stats.specIds) ? stats.specIds.join(", ") : "-"}`,
    `Всего операций: ${stats.total}`,
    `Обновлено: ${stats.updated}`,
    `Пропущено: ${stats.skipped}`,
    `Ошибок: ${stats.failed}`,
    `Режим: ${stats.dryRun ? "тестовый (dry-run)" : "запись"}`,
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
  selectedTransferProductData = null;
  transferSpecEntries = [];
  selectedTransferSpecIds.clear();
  transferSpecsSearchQuery = "";
  transferSpecsSearchEl.value = "";
  editorEntries = [];
  editorInitialEntries = [];
  editorSpecsSearchQuery = "";
  editorSpecsSearchEl.value = "";
  activeEditorLanguageId = null;
  editorDraftsByLanguage = new Map();
  setSelectedProductActionMode(null);
  transferSelectedProductEl.textContent = "Продукт не выбран.";
  productActionMetaEl.textContent = "Продукт не выбран.";
  renderTransferProducts(transferProductsCache);
  renderTransferSpecs([]);
  renderEditorSpecs([]);
  closeProductActionModal();
  closeTransferSpecsModal();
  closeEditorModal();
  updateTransferSelectionSummary();
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
      appendOutput(`ОШИБКА: ${error.message}`, true);
    });
  }, 320);
}

async function selectTransferProduct(productId) {
  if (!Number.isInteger(productId) || productId < 1) {
    return;
  }

  selectedTransferProductId = productId;
  selectedTransferProductData =
    transferProductsCache.find((product) => Number(product?.id) === productId) || null;
  transferSelectedProductEl.textContent = getProductSummaryText(selectedTransferProductData);
  selectedTransferSpecIds.clear();
  transferSpecEntries = [];
  transferSpecsSearchQuery = "";
  transferSpecsSearchEl.value = "";
  editorEntries = [];
  editorInitialEntries = [];
  editorSpecsSearchQuery = "";
  editorSpecsSearchEl.value = "";
  activeEditorLanguageId = null;
  editorDraftsByLanguage = new Map();
  editorProductMetaEl.textContent = getProductSummaryText(selectedTransferProductData);
  productActionMetaEl.textContent = getProductSummaryText(selectedTransferProductData);
  setSelectedProductActionMode(null);
  renderTransferProducts(transferProductsCache);
  renderTransferSpecs([]);
  renderEditorSpecs([]);
  refreshActionButtons();
  openProductActionModal();
}

async function loadTransferSpecsForSelectedProduct() {
  if (!selectedTransferProductId) {
    appendOutput("ОШИБКА: Сначала выберите продукт.", true);
    return;
  }

  const specs = await withRequestLoader("Загружаем пункты спецификации...", () =>
    window.specApi.getTransferProductSpecs({
      productId: selectedTransferProductId,
      sourceLanguageId: Number(sourceLanguageIdEl.value || 1),
    })
  );

  selectedTransferSpecIds.clear();
  transferSpecsSearchQuery = "";
  transferSpecsSearchEl.value = "";
  transferSpecEntries = Array.isArray(specs) ? specs : [];
  setSelectedProductActionMode("transfer");
  renderTransferSpecs(transferSpecEntries);
  refreshActionButtons();
  closeProductActionModal();
  openTransferSpecsModal();
}

async function loadEditorSpecsForSelectedProduct({
  languageId,
  preserveDraft = false,
  skipStoreDraft = false,
} = {}) {
  if (!selectedTransferProductId) {
    appendOutput("ОШИБКА: Сначала выберите продукт.", true);
    return;
  }

  const nextLanguageId =
    Number(languageId || editorLanguageIdEl.value || targetLanguageIdEl.value || 2) || 2;
  if (!skipStoreDraft) {
    storeCurrentEditorDraft();
  }

  const existingDraft = editorDraftsByLanguage.get(nextLanguageId);
  if (existingDraft) {
    activeEditorLanguageId = nextLanguageId;
    editorLanguageIdEl.value = String(nextLanguageId);
    editorEntries = cloneEditorEntries(existingDraft.entries);
    editorInitialEntries = cloneEditorEntries(existingDraft.initialEntries);
    setSelectedProductActionMode("edit");
    renderEditorSpecs();
    refreshActionButtons();

    if (!preserveDraft) {
      openEditorModal();
    }
    return;
  }

  const response = await withRequestLoader("Загружаем значения для редактирования...", () =>
    window.specApi.getEditableProductSpecs({
      productId: selectedTransferProductId,
      languageId: nextLanguageId,
      sourceLanguageId: Number(sourceLanguageIdEl.value || 1),
    })
  );

  const nextEntries = cloneEditorEntries(response?.specifications || []);

  activeEditorLanguageId = nextLanguageId;
  editorLanguageIdEl.value = String(nextLanguageId);
  editorEntries = nextEntries;
  editorInitialEntries = cloneEditorEntries(nextEntries);
  editorDraftsByLanguage.set(nextLanguageId, {
    entries: cloneEditorEntries(editorEntries),
    initialEntries: cloneEditorEntries(editorInitialEntries),
  });
  editorProductMetaEl.textContent = getProductSummaryText({
    id: response?.productId || selectedTransferProductId,
    productId: response?.productId || selectedTransferProductId,
    name: response?.productName || selectedTransferProductData?.name,
    productName: response?.productName || selectedTransferProductData?.name,
    model: response?.productModel || selectedTransferProductData?.model,
    productModel: response?.productModel || selectedTransferProductData?.model,
  });
  setSelectedProductActionMode("edit");
  renderEditorSpecs();
  refreshActionButtons();
  closeProductActionModal();

  if (!preserveDraft) {
    openEditorModal();
  }
}

async function submitTransferSelection() {
  if (!selectedTransferProductId) {
    appendOutput("ОШИБКА: Сначала выберите продукт.", true);
    return;
  }

  const specIds = getSelectedTransferSpecIds();
  if (specIds.length === 0) {
    appendOutput("ОШИБКА: Отметьте минимум один пункт для переноса.", true);
    return;
  }

  setBusy(true);
  outputEl.classList.remove("error");

  try {
    appendOutput(`>>> Перенос товара #${selectedTransferProductId}`);
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
          `Язык ${detail.targetLanguageId}: обновлено=${detail.updated}, пропущено=${detail.skipped}, ошибок=${detail.failed}`
        );
      }
    }

    appendOutput(`Завершено: ${new Date().toLocaleString()}`);
    closeTransferSpecsModal();
  } catch (error) {
    outputEl.classList.add("error");
    appendOutput(`ОШИБКА: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function saveEditorSpecifications() {
  if (!selectedTransferProductId) {
    appendOutput("ОШИБКА: Сначала выберите продукт и язык.", true);
    return;
  }

  storeCurrentEditorDraft();
  const draftsToSave = [...editorDraftsByLanguage.entries()]
    .map(([languageId, draft]) => ({
      languageId: Number(languageId),
      changedEntries: getChangedEntriesForDraft(draft),
    }))
    .filter((draft) => draft.changedEntries.length > 0);

  if (draftsToSave.length === 0) {
    appendOutput("ОШИБКА: Нет измененных пунктов для сохранения.", true);
    return;
  }

  setBusy(true);
  outputEl.classList.remove("error");

  try {
    appendOutput(
      `>>> Редактирование товара #${selectedTransferProductId} · языков: ${draftsToSave.length}`
    );

    for (const draft of draftsToSave) {
      const specs = draft.changedEntries.map((entry) => ({
        specificationId: Number(entry.specificationId),
        value: normalizeEntryValue(entry),
        values: normalizeEntryValues(entry),
      }));

      const result = await withRequestLoader(
        `Сохраняем изменения для языка ${draft.languageId}...`,
        () =>
          window.specApi.saveEditableProductSpecs({
            productId: selectedTransferProductId,
            languageId: draft.languageId,
            specs,
          })
      );

      appendOutput("------------------------------");
      appendOutput(
        [
          `Задача: Редактирование спецификаций`,
          `ID товара: ${result.productId}`,
          `Язык: ${result.languageId}`,
          `Изменено пунктов: ${result.updated}`,
        ].join("\n")
      );
    }

    editorDraftsByLanguage = new Map();

    await loadEditorSpecsForSelectedProduct({
      languageId: activeEditorLanguageId,
      preserveDraft: true,
      skipStoreDraft: true,
    });
    appendOutput(`Завершено: ${new Date().toLocaleString()}`);
    closeEditorModal();
  } catch (error) {
    outputEl.classList.add("error");
    appendOutput(`ОШИБКА: ${error.message}`, true);
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
  fillEditorLanguageSelect(editorLanguageIdEl, countries);

  materialLanguageIdEl.value = ALL_TARGETS;
  targetLanguageIdEl.value = ALL_TARGETS;
  editorLanguageIdEl.value = String(Number(sourceLanguageIdEl.value || 1) || 1);
  activeEditorLanguageId = Number(editorLanguageIdEl.value || 1) || 1;
  isInitialized = true;
  appendOutput("GUI инициализирован.");
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
    const username = authState.user?.username || "пользователь";
    const role = getCurrentUserRole();
    sessionStateEl.textContent = `Выполнен вход: ${username} · роль: ${role}`;
  } else if (authState.required) {
    sessionStateEl.textContent = "Вход не выполнен";
  } else {
    sessionStateEl.textContent = "Авторизация отключена (локальный режим)";
  }

  refreshActionButtons();
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const username = loginUsernameEl.value.trim();
  const password = loginPasswordEl.value;
  if (!username || !password) {
    setLoginMessage("Введите логин и пароль.");
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
    appendOutput(`Авторизация успешна: ${session.user?.username || username}.`);
  } catch (error) {
    setLoginMessage(error.message || "Ошибка авторизации");
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
    setLoginMessage("Вы вышли из системы.");
    loginPasswordEl.value = "";
    loginUsernameEl.focus();
    appendOutput("Сессия завершена.");
  } catch (error) {
    setLoginMessage(error.message || "Не удалось выйти из системы");
  }
}

function bindEvents() {
  window.specApi.onProgressPlan((payload) => {
    plannedTaskStageTotal = Math.max(Number(payload?.stageTotal) || 0, 0);
  });

  window.specApi.onProgress((payload) => {
    updateProgress(payload);
  });

  loginFormEl.addEventListener("submit", handleLoginSubmit);
  logoutButtonEl.addEventListener("click", handleLogout);

  loadTransferProductsEl.addEventListener("click", () => {
    loadTransferProducts().catch((error) => {
      outputEl.classList.add("error");
      appendOutput(`ОШИБКА: ${error.message}`, true);
    });
  });

  transferSearchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    loadTransferProducts().catch((error) => {
      outputEl.classList.add("error");
      appendOutput(`ОШИБКА: ${error.message}`, true);
    });
  });

  transferSearchEl.addEventListener("input", () => {
    const query = transferSearchEl.value.trim();
    if (query.length === 1 && Number.isNaN(Number(query))) {
      return;
    }
    scheduleTransferSearch();
  });

  transferSpecsSearchEl.addEventListener("input", () => {
    transferSpecsSearchQuery = transferSpecsSearchEl.value.trim();
    renderTransferSpecs();
    refreshActionButtons();
  });

  transferSpecsEl.addEventListener("change", () => {
    refreshActionButtons();
  });

  openTransferSpecsModalEl.addEventListener("click", () => {
    openTransferSpecsModal();
  });

  chooseTransferModeEl.addEventListener("click", () => {
    loadTransferSpecsForSelectedProduct().catch((error) => {
      outputEl.classList.add("error");
      appendOutput(`ОШИБКА: ${error.message}`, true);
    });
  });

  chooseEditModeEl.addEventListener("click", () => {
    loadEditorSpecsForSelectedProduct({
      languageId: Number(editorLanguageIdEl.value || targetLanguageIdEl.value || 2) || 2,
    }).catch((error) => {
      outputEl.classList.add("error");
      appendOutput(`ОШИБКА: ${error.message}`, true);
    });
  });

  closeProductActionModalEl.addEventListener("click", () => {
    closeProductActionModal();
  });

  closeTransferSpecsModalEl.addEventListener("click", () => {
    closeTransferSpecsModal();
  });

  closeEditorModalEl.addEventListener("click", () => {
    storeCurrentEditorDraft();
    closeEditorModal();
  });

  transferSpecsModalEl.addEventListener("click", (event) => {
    if (event.target === transferSpecsModalEl) {
      closeTransferSpecsModal();
    }
  });

  productActionModalEl.addEventListener("click", (event) => {
    if (event.target === productActionModalEl) {
      closeProductActionModal();
    }
  });

  editorModalEl.addEventListener("click", (event) => {
    if (event.target === editorModalEl) {
      storeCurrentEditorDraft();
      closeEditorModal();
    }
  });

  selectAllTransferSpecsEl.addEventListener("click", () => {
    selectedTransferSpecIds = new Set(
      transferSpecEntries
        .map((spec) => Number(spec.specificationId))
        .filter((id) => Number.isInteger(id) && id > 0)
    );
    renderTransferSpecs(transferSpecEntries);
    refreshActionButtons();
  });

  clearTransferSpecsSelectionEl.addEventListener("click", () => {
    selectedTransferSpecIds.clear();
    renderTransferSpecs(transferSpecEntries);
    refreshActionButtons();
  });

  submitTransferEl.addEventListener("click", () => {
    submitTransferSelection();
  });

  submitTransferModalEl.addEventListener("click", () => {
    submitTransferSelection();
  });

  editorLanguageIdEl.addEventListener("change", () => {
    const nextLanguageId = Number(editorLanguageIdEl.value || 0);
    if (!selectedTransferProductId || !nextLanguageId) {
      return;
    }

    loadEditorSpecsForSelectedProduct({
      languageId: nextLanguageId,
      preserveDraft: true,
    }).catch((error) => {
      outputEl.classList.add("error");
      appendOutput(`ОШИБКА: ${error.message}`, true);
    });
  });

  editorSpecsSearchEl.addEventListener("input", () => {
    editorSpecsSearchQuery = editorSpecsSearchEl.value.trim();
    renderEditorSpecs();
    refreshActionButtons();
  });

  saveEditorSpecsEl.addEventListener("click", () => {
    saveEditorSpecifications();
  });

  taskButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const task = button.dataset.task;
      runTask(task);
    });
  });

  clearOutputEl.addEventListener("click", () => {
    outputEl.classList.remove("error");
    outputEl.textContent = "Готово.";
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !transferSpecsModalEl.classList.contains("hidden")) {
      closeTransferSpecsModal();
      return;
    }

    if (event.key === "Escape" && !productActionModalEl.classList.contains("hidden")) {
      closeProductActionModal();
      return;
    }

    if (event.key === "Escape" && !editorModalEl.classList.contains("hidden")) {
      storeCurrentEditorDraft();
      closeEditorModal();
    }
  });
}

async function bootstrap() {
  bindEvents();
  syncRequestIndicators();
  updateTransferSelectionSummary();
  resetProgress();

  const authConfig = await withRequestLoader("Проверяем режим доступа...", () =>
    window.specApi.getAuthConfig()
  );
  if (!authConfig.required) {
    setSessionState({
      required: false,
      authenticated: true,
      user: { id: 0, username: "локально" },
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

  setLoginMessage("Войдите, чтобы продолжить.");
  appendOutput("Требуется авторизация.");
  loginUsernameEl.focus();
}

bootstrap().catch((error) => {
  outputEl.classList.add("error");
  outputEl.textContent = `Ошибка запуска интерфейса: ${error.message}`;
});
