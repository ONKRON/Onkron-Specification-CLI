const { URL } = require("url");

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function createApiClient({ baseUrl }) {
  const root = normalizeBaseUrl(baseUrl);
  let token = "";

  function setToken(nextToken) {
    token = String(nextToken || "").trim();
  }

  function getHeaders(extra = {}) {
    return {
      ...extra,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  function endpoint(pathname) {
    return new URL(pathname, `${root}/`).toString();
  }

  async function readError(response) {
    try {
      const payload = await response.json();
      return payload?.error || `API вернул HTTP ${response.status}`;
    } catch (_error) {
      return `API вернул HTTP ${response.status}`;
    }
  }

  async function requestJson(pathname, { method = "GET", body = null, auth = true } = {}) {
    const response = await fetch(endpoint(pathname), {
      method,
      headers: getHeaders({
        ...(body !== null ? { "Content-Type": "application/json" } : {}),
      }),
      body: body !== null ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const payload = await response.json();
    if (!auth) {
      return payload;
    }
    return payload;
  }

  async function requestNdjson(pathname, body, handlers = {}) {
    const response = await fetch(endpoint(pathname), {
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
        if (!trimmed) {
          continue;
        }
        const message = JSON.parse(trimmed);
        if (message.type === "progress-plan") {
          handlers.onProgressPlan?.(message.payload);
        } else if (message.type === "progress") {
          handlers.onProgress?.(message.payload);
        } else if (message.type === "result") {
          result = message.payload;
        } else if (message.type === "error") {
          throw new Error(message.payload?.message || "API вернул ошибку");
        }
      }
    }

    if (buffer.trim()) {
      const message = JSON.parse(buffer.trim());
      if (message.type === "result") {
        result = message.payload;
      } else if (message.type === "error") {
        throw new Error(message.payload?.message || "API вернул ошибку");
      }
    }

    if (result === null) {
      throw new Error("API не вернул результат операции");
    }

    return result;
  }

  return {
    baseUrl: root,
    setToken,
    getAuthConfig: () => requestJson("/auth/config", { auth: false }),
    getAuthSession: () => requestJson("/auth/session"),
    login: async (credentials) => {
      const session = await requestJson("/auth/login", {
        method: "POST",
        body: credentials || {},
        auth: false,
      });
      setToken(session?.token || "");
      return session;
    },
    logout: async () => {
      const session = await requestJson("/auth/logout", {
        method: "POST",
        body: {},
        auth: false,
      });
      setToken("");
      return session;
    },
    getCountries: () => requestJson("/countries", { auth: false }),
    runTask: (payload, handlers) => requestNdjson("/tasks/run", payload, handlers),
    listTransferProducts: (payload) => requestJson("/transfer/products", { method: "POST", body: payload || {} }),
    getTransferProductSpecs: (payload) => requestJson("/transfer/product-specs", { method: "POST", body: payload || {} }),
    getEditableProductSpecs: (payload) => requestJson("/editor/product-specs", { method: "POST", body: payload || {} }),
    saveEditableProductSpecs: (payload) => requestJson("/editor/save-product-specs", { method: "POST", body: payload || {} }),
    submitTransfer: (payload, handlers) => requestNdjson("/transfer/submit", payload, handlers),
  };
}

module.exports = {
  createApiClient,
};
