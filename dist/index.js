"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AgentPausedError: () => AgentPausedError,
  AuthError: () => AuthError,
  ForbiddenError: () => ForbiddenError,
  NotFoundError: () => NotFoundError,
  OcrAgent: () => OcrAgent,
  OcrAgentError: () => OcrAgentError,
  PlanLimitError: () => PlanLimitError,
  RateLimitError: () => RateLimitError,
  ValidationError: () => ValidationError,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var OcrAgentError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "OcrAgentError";
    this.status = status;
    this.code = code;
  }
};
var AuthError = class extends OcrAgentError {
  constructor(message = "Invalid or expired API key.") {
    super(401, "UNAUTHORIZED", message);
    this.name = "AuthError";
  }
};
var ForbiddenError = class extends OcrAgentError {
  constructor(message) {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
};
var NotFoundError = class extends OcrAgentError {
  constructor(message = "Resource not found.") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
};
var RateLimitError = class extends OcrAgentError {
  constructor(retryAfter = 60) {
    super(429, "RATE_LIMITED", `Rate limit exceeded. Retry after ${retryAfter}s.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
};
var ValidationError = class extends OcrAgentError {
  constructor(message) {
    super(422, "VALIDATION_ERROR", message);
    this.name = "ValidationError";
  }
};
var PlanLimitError = class extends OcrAgentError {
  constructor(message) {
    super(402, "plan_limit_exceeded", message);
    this.name = "PlanLimitError";
  }
};
var AgentPausedError = class extends OcrAgentError {
  constructor(message = "This agent is paused. Resume it before submitting jobs.") {
    super(422, "agent_paused", message);
    this.name = "AgentPausedError";
  }
};

// src/http.ts
var DEFAULT_BASE_URL = "https://apiocr.nxtwaveai.com/v1";
var DEFAULT_MAX_RETRIES = 3;
var DEFAULT_TIMEOUT = 3e4;
var HttpClient = class {
  constructor(options) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }
  async request(method, path, options) {
    const url = new URL(this.baseUrl + path);
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== void 0) url.searchParams.set(k, String(v));
      }
    }
    const headers = { "X-API-Key": this.apiKey };
    let bodyInit;
    if (options?.form) {
      bodyInit = options.form;
    } else if (options?.body) {
      headers["Content-Type"] = "application/json";
      bodyInit = JSON.stringify(options.body);
    }
    let attempt = 0;
    while (true) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      let res;
      try {
        res = await fetch(url.toString(), {
          method,
          headers,
          body: bodyInit,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
      if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
        const waitMs = res.status === 429 ? Math.min(Number(res.headers.get("Retry-After") ?? 60) * 1e3, 6e4) : Math.min(2 ** (attempt - 1) * 1e3, 3e4);
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({
          detail: res.statusText,
          code: "UNKNOWN"
        }));
        const msg = err.detail ?? "Unknown error";
        const code = err.code ?? "UNKNOWN";
        if (res.status === 401) throw new AuthError(msg);
        if (res.status === 402) throw new PlanLimitError(msg);
        if (res.status === 403) throw new ForbiddenError(msg);
        if (res.status === 404) throw new NotFoundError(msg);
        if (res.status === 422) {
          if (code === "agent_paused") throw new AgentPausedError(msg);
          if (code === "agent_slot_limit" || code === "insufficient_credits" || code === "api_key_credit_limit")
            throw new PlanLimitError(msg);
          throw new ValidationError(msg);
        }
        if (res.status === 429)
          throw new RateLimitError(Number(res.headers.get("Retry-After") ?? 60));
        throw new OcrAgentError(res.status, code, msg);
      }
      if (res.status === 204) return void 0;
      if (options?.binary) return res.arrayBuffer();
      return res.json();
    }
  }
};
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// src/resources/agents.ts
async function toBlob(file) {
  if (file instanceof Blob) return file;
  if (Buffer.isBuffer(file)) return new Blob([file]);
  const chunks = [];
  for await (const chunk of file) {
    chunks.push(chunk);
  }
  return new Blob(chunks);
}
var AgentsResource = class {
  constructor(http) {
    this.http = http;
  }
  /** List all your agents. */
  async list() {
    const res = await this.http.request("GET", "/agents");
    return res.agents;
  }
  /** Get a single agent with its full schema. */
  async get(agentId) {
    return this.http.request("GET", `/agents/${agentId}`);
  }
  /** Get just the schema (fields) for an agent. */
  async getSchema(agentId) {
    return this.http.request("GET", `/agents/${agentId}/schema`);
  }
  /** Update an agent's extraction schema. */
  async updateSchema(agentId, schema) {
    return this.http.request("PATCH", `/agents/${agentId}/schema`, { body: schema });
  }
  /** Pause or reactivate an agent. */
  async setStatus(agentId, action) {
    return this.http.request("POST", `/agents/${agentId}/status`, {
      params: { action }
    });
  }
  /** Permanently delete an agent and all its jobs. */
  async delete(agentId) {
    return this.http.request("DELETE", `/agents/${agentId}`);
  }
  /** List extraction results for an agent. */
  async results(agentId, options = {}) {
    return this.http.request("GET", `/agents/${agentId}/results`, {
      params: {
        period: options.period,
        from_date: options.from_date,
        to_date: options.to_date,
        page: options.page,
        limit: options.limit
      }
    });
  }
  /** Export all results for an agent as CSV or XLSX. Returns a Buffer. */
  async exportResults(agentId, options = { format: "csv" }) {
    return this.http.request("GET", `/agents/${agentId}/results/export`, {
      params: { format: options.format },
      binary: true
    });
  }
  /** Get daily extraction stats for an agent (last 7 days). */
  async stats(agentId) {
    return this.http.request("GET", `/agents/${agentId}/stats`);
  }
  /** Get full extraction history for an agent. */
  async history(agentId, options = {}) {
    return this.http.request("GET", `/agents/${agentId}/history`, { params: options });
  }
  // ── Agent creation wizard ─────────────────────────────────────
  /**
   * Step 1 — Upload a sample document to start a new agent build session.
   * Returns a `session_id` for subsequent wizard calls.
   *
   * @example
   * const { session_id } = await client.agents.createSession({
   *   file: fs.createReadStream("invoice.pdf"),
   *   docTypeHint: "invoice",
   * });
   */
  async createSession(options) {
    const form = new FormData();
    form.append("file_front", await toBlob(options.file));
    if (options.fileBack) form.append("file_back", await toBlob(options.fileBack));
    if (options.pageLayout) form.append("page_layout", options.pageLayout);
    if (options.docTypeHint) form.append("doc_type_hint", options.docTypeHint);
    return this.http.request("POST", "/agents/session", { form });
  }
  /**
   * Step 2 — Get AI-generated questions and suggested field names for the session.
   * The first call is slow (runs OCR + LLM analysis). Subsequent calls are instant.
   *
   * @example
   * const session = await client.agents.getSession(session_id);
   * console.log(session.doc_type_guess); // "invoice"
   * console.log(session.questions);      // [{key, question, suggested_value, ...}]
   */
  async getSession(sessionId) {
    return this.http.request("GET", `/agents/session/${sessionId}`);
  }
  /**
   * Step 3 — Submit answers and finalize the agent.
   * If the AI needs more info, `status` will be `"needs_more_info"` and
   * `followup_questions` will contain the additional questions — call again with those answers.
   *
   * @example
   * // Accept all AI suggestions:
   * const session = await client.agents.getSession(session_id);
   * const answers = Object.fromEntries(
   *   session.questions.map(q => [q.key, q.suggested_value])
   * );
   * const result = await client.agents.finalizeSession(session_id, { answers });
   * console.log(result.agent_id); // created!
   */
  async finalizeSession(sessionId, options) {
    return this.http.request("POST", `/agents/session/${sessionId}/answer`, {
      body: {
        answers: options.answers,
        required_overrides: options.requiredOverrides
      }
    });
  }
  /**
   * Convenience method — create an agent in one call by auto-confirming all AI suggestions.
   * Internally runs the 3-step wizard and returns the agent_id on success.
   *
   * @example
   * const { agent_id } = await client.agents.create({
   *   file: fs.createReadStream("invoice.pdf"),
   *   docTypeHint: "invoice",
   * });
   */
  async create(options) {
    const { session_id } = await this.createSession(options);
    const session = await this.getSession(session_id);
    const answers = {};
    for (const q of session.questions) {
      answers[q.key] = q.suggested_value || "";
    }
    const result = await this.finalizeSession(session_id, { answers });
    if (result.status !== "agent_created" || !result.agent_id) {
      throw new Error(
        `Agent creation needs more info: ${result.followup_questions.map((q) => q.question).join("; ")}`
      );
    }
    return { agent_id: result.agent_id, agent_name: result.agent_name ?? "" };
  }
};

// src/resources/extract.ts
async function toBlob2(file) {
  if (file instanceof Blob) return file;
  if (Buffer.isBuffer(file)) return new Blob([file]);
  const chunks = [];
  for await (const chunk of file) {
    chunks.push(chunk);
  }
  return new Blob(chunks);
}
var ExtractResource = class {
  constructor(http) {
    this.http = http;
  }
  /** Extract structured data from a single document. Returns the result synchronously. */
  async single(options) {
    const form = new FormData();
    form.append("agent_id", options.agentId);
    form.append("file_front", await toBlob2(options.file));
    if (options.fileBack) form.append("file_back", await toBlob2(options.fileBack));
    if (options.callbackUrl) form.append("callback_url", options.callbackUrl);
    const raw = await this.http.request("POST", "/extract", { form });
    return { ...raw, data: raw.result ?? {} };
  }
  /** Extract from multiple documents at once using the same agent. */
  async batch(options) {
    const form = new FormData();
    form.append("agent_id", options.agentId);
    for (const file of options.files) {
      form.append("files", await toBlob2(file));
    }
    if (options.callbackUrl) form.append("callback_url", options.callbackUrl);
    return this.http.request("POST", "/extract/batch", { form });
  }
  /**
   * Pre-upload an image and get a URL you can pass to extract() later.
   * Useful for camera captures or async pipelines.
   */
  async uploadImage(file) {
    const form = new FormData();
    form.append("file", await toBlob2(file));
    return this.http.request("POST", "/upload/image", { form });
  }
};

// src/resources/jobs.ts
var JobsResource = class {
  constructor(http) {
    this.http = http;
  }
  /** List all jobs across all agents. */
  async list(options = {}) {
    return this.http.request("GET", "/jobs", {
      params: { status: options.status, page: options.page, limit: options.limit }
    });
  }
  /** Get the status and result of a specific job. */
  async get(jobId) {
    return this.http.request("GET", `/jobs/${jobId}`);
  }
  /** Get the full extracted result for a completed job. */
  async result(jobId) {
    return this.http.request("GET", `/jobs/${jobId}/result`);
  }
  /** Download the result as JSON or CSV. Returns an ArrayBuffer. */
  async download(jobId, format = "json") {
    return this.http.request("GET", `/jobs/${jobId}/download`, {
      params: { format },
      binary: true
    });
  }
  /** Permanently delete a job and its result. */
  async delete(jobId) {
    return this.http.request("DELETE", `/jobs/${jobId}`);
  }
};

// src/index.ts
var OcrAgent = class {
  constructor(options) {
    if (!options.apiKey) throw new Error("OcrAgent: apiKey is required.");
    this._http = new HttpClient(options);
    this.extract = new ExtractResource(this._http);
    this.agents = new AgentsResource(this._http);
    this.jobs = new JobsResource(this._http);
  }
};
var index_default = OcrAgent;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentPausedError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  OcrAgent,
  OcrAgentError,
  PlanLimitError,
  RateLimitError,
  ValidationError
});
//# sourceMappingURL=index.js.map