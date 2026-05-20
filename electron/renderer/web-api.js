(function initWebSpecApi() {
  if (window.specApi) {
    return;
  }

  const TOKEN_STORAGE_KEY = "vamshop_spec_api_token";
  const progressPlanHandlers = new Set();
  const progressHandlers = new Set();
  let token = window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";

  function setToken(nextToken) {
    token = String(nextToken || "").trim();
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      return;
    }
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  function getHeaders(extra = {}) {
    return {
      ...extra,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function readError(response) {
    try {
      const payload = await response.json();
      return payload?.error || `API вернул HTTP ${response.status}`;
    } catch (_error) {
      return `API вернул HTTP ${response.status}`;
    }
  }

  async function requestJson(pathname, { method = "GET", body = null } = {}) {
    const response = await fetch(pathname, {
      method,
      headers: getHeaders({
        ...(body !== null ? { "Content-Type": "application/json" } : {}),
      }),
      body: body !== null ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    return response.json();
  }

  async function requestNdjson(pathname, body) {
    const response = await fetch(pathname, {
      method: "POST",
      headers: getHeaders({
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      }),
      body: JSON.stringify(body || {}),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    if (!response.body) {
      throw new Error("API не вернул поток данных");
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";
    let result = null;

    function handleMessage(message) {
      if (message.type === "progress-plan") {
        progressPlanHandlers.forEach((handler) => handler(message.payload));
        return;
      }
      if (message.type === "progress") {
        progressHandlers.forEach((handler) => handler(message.payload));
        return;
      }
      if (message.type === "result") {
        result = message.payload;
        return;
      }
      if (message.type === "error") {
        throw new Error(message.payload?.message || "API вернул ошибку");
      }
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          handleMessage(JSON.parse(trimmed));
        }
      }
    }

    if (buffer.trim()) {
      handleMessage(JSON.parse(buffer.trim()));
    }

    if (result === null) {
      throw new Error("API не вернул результат операции");
    }

    return result;
  }

  window.specApi = {
    getAuthConfig: () => requestJson("/auth/config"),
    getAuthSession: async () => {
      if (!token) {
        return { required: true, authenticated: false, user: null };
      }

      try {
        return await requestJson("/auth/session");
      } catch (error) {
        setToken("");
        return { required: true, authenticated: false, user: null };
      }
    },
    login: async (payload) => {
      const session = await requestJson("/auth/login", {
        method: "POST",
        body: payload || {},
      });
      setToken(session?.token || "");
      return session;
    },
    logout: async () => {
      setToken("");
      try {
        return await requestJson("/auth/logout", {
          method: "POST",
          body: {},
        });
      } catch (_error) {
        return { required: true, authenticated: false, user: null };
      }
    },
    getCountries: () => requestJson("/countries"),
    runTask: (payload) => requestNdjson("/tasks/run", payload),
    listTransferProducts: (payload) =>
      requestJson("/transfer/products", { method: "POST", body: payload || {} }),
    getTransferProductSpecs: (payload) =>
      requestJson("/transfer/product-specs", { method: "POST", body: payload || {} }),
    getEditableProductSpecs: (payload) =>
      requestJson("/editor/product-specs", { method: "POST", body: payload || {} }),
    saveEditableProductSpecs: (payload) =>
      requestJson("/editor/save-product-specs", { method: "POST", body: payload || {} }),
    submitTransfer: (payload) => requestNdjson("/transfer/submit", payload),
    onProgressPlan: (handler) => {
      if (typeof handler !== "function") {
        return () => {};
      }
      progressPlanHandlers.add(handler);
      return () => progressPlanHandlers.delete(handler);
    },
    onProgress: (handler) => {
      if (typeof handler !== "function") {
        return () => {};
      }
      progressHandlers.add(handler);
      return () => progressHandlers.delete(handler);
    },
  };
})();
