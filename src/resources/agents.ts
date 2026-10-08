import type { HttpClient } from "../http.js";
import type {
  Agent,
  AgentDetail,
  AgentListResponse,
  AgentSchema,
  AgentStatsResponse,
  CreateSessionOptions,
  FinalizeResult,
  FinalizeSessionOptions,
  ResultsOptions,
  ResultsPage,
  SchemaField,
  SessionStatus,
} from "../types.js";

async function toBlob(file: unknown): Promise<Blob> {
  if (file instanceof Blob) return file;
  if (Buffer.isBuffer(file as Buffer)) return new Blob([(file as Buffer) as unknown as BlobPart]);
  const chunks: BlobPart[] = [];
  for await (const chunk of file as AsyncIterable<Uint8Array>) {
    chunks.push(chunk as unknown as BlobPart);
  }
  return new Blob(chunks);
}

export class AgentsResource {
  constructor(private http: HttpClient) {}

  /** List all your agents. */
  async list(): Promise<Agent[]> {
    const res = await this.http.request<AgentListResponse>("GET", "/agents");
    return res.agents;
  }

  /** Get a single agent with its full schema. */
  async get(agentId: string): Promise<AgentDetail> {
    return this.http.request("GET", `/agents/${agentId}`);
  }

  /** Get just the schema (fields) for an agent. */
  async getSchema(agentId: string): Promise<AgentSchema> {
    return this.http.request("GET", `/agents/${agentId}/schema`);
  }

  /** Update an agent's extraction schema. */
  async updateSchema(agentId: string, schema: { fields: SchemaField[] }): Promise<AgentSchema> {
    return this.http.request("PATCH", `/agents/${agentId}/schema`, { body: schema });
  }

  /** Pause or reactivate an agent. */
  async setStatus(agentId: string, action: "active" | "paused"): Promise<void> {
    return this.http.request("POST", `/agents/${agentId}/status`, {
      params: { action },
    });
  }

  /** Permanently delete an agent and all its jobs. */
  async delete(agentId: string): Promise<void> {
    return this.http.request("DELETE", `/agents/${agentId}`);
  }

  /** List extraction results for an agent. */
  async results(agentId: string, options: ResultsOptions = {}): Promise<ResultsPage> {
    return this.http.request("GET", `/agents/${agentId}/results`, {
      params: {
        period: options.period,
        from_date: options.from_date,
        to_date: options.to_date,
        page: options.page,
        limit: options.limit,
      },
    });
  }

  /** Export all results for an agent as CSV or XLSX. Returns a Buffer. */
  async exportResults(agentId: string, options: { format: "csv" | "xlsx" } = { format: "csv" }): Promise<ArrayBuffer> {
    return this.http.request("GET", `/agents/${agentId}/results/export`, {
      params: { format: options.format },
      binary: true,
    });
  }

  /** Get daily extraction stats for an agent (last 7 days). */
  async stats(agentId: string): Promise<AgentStatsResponse> {
    return this.http.request("GET", `/agents/${agentId}/stats`);
  }

  /** Get full extraction history for an agent. */
  async history(agentId: string, options: { page?: number; limit?: number; period?: string } = {}): Promise<ResultsPage> {
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
  async createSession(options: CreateSessionOptions): Promise<{ session_id: string }> {
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
  async getSession(sessionId: string): Promise<SessionStatus> {
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
  async finalizeSession(sessionId: string, options: FinalizeSessionOptions): Promise<FinalizeResult> {
    return this.http.request("POST", `/agents/session/${sessionId}/answer`, {
      body: {
        answers: options.answers,
        required_overrides: options.requiredOverrides,
      },
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
  async create(options: CreateSessionOptions): Promise<{ agent_id: string; agent_name: string }> {
    const { session_id } = await this.createSession(options);
    const session = await this.getSession(session_id);
    const answers: Record<string, string> = {};
    for (const q of session.questions) {
      answers[q.key] = q.suggested_value || "";
    }
    const result = await this.finalizeSession(session_id, { answers });
    if (result.status !== "agent_created" || !result.agent_id) {
      throw new Error(
        `Agent creation needs more info: ${result.followup_questions.map(q => q.question).join("; ")}`
      );
    }
    return { agent_id: result.agent_id, agent_name: result.agent_name ?? "" };
  }
}
