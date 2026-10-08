declare class HttpClient {
    private apiKey;
    private baseUrl;
    private maxRetries;
    private timeout;
    constructor(options: {
        apiKey: string;
        baseUrl?: string;
        maxRetries?: number;
        timeout?: number;
    });
    request<T>(method: string, path: string, options?: {
        body?: Record<string, unknown>;
        form?: FormData;
        params?: Record<string, string | number | undefined>;
        binary?: boolean;
    }): Promise<T>;
}

interface OcrAgentOptions {
    apiKey: string;
    baseUrl?: string;
    maxRetries?: number;
    timeout?: number;
}
interface Agent {
    id: string;
    name: string;
    status: "active" | "paused";
    expected_pages: number;
    fields_count: number;
    total_extractions: number;
    created_at: string;
}
interface SchemaField {
    key: string;
    label: string;
    type: "string" | "number" | "date" | "boolean" | "array";
    description?: string;
}
interface AgentSchema {
    fields: SchemaField[];
}
interface AgentDetail extends Agent {
    schema: AgentSchema;
}
interface AgentListResponse {
    agents: Agent[];
    total: number;
}
interface CreateSessionOptions {
    /** Sample document image (front page). JPEG, PNG, or WEBP. */
    file: Blob | Buffer | NodeJS.ReadableStream | File;
    /** Back-page image when page_layout is "two_sided". */
    fileBack?: Blob | Buffer | NodeJS.ReadableStream | File;
    /** "single" (default) or "two_sided". */
    pageLayout?: "single" | "two_sided";
    /** Optional hint, e.g. "invoice", "passport". */
    docTypeHint?: string;
}
interface SessionQuestion {
    key: string;
    question: string;
    kind: string;
    suggested_value: string;
    hint: string;
    confirmed_value: string;
    required?: boolean;
}
interface SessionStatus {
    session_id: string;
    status: string;
    doc_type_guess: string;
    questions: SessionQuestion[];
    suggested_answers: Record<string, {
        value: string;
        hint: string;
    }>;
    answers: Record<string, string>;
    created_agent_id: string | null;
}
interface FinalizeSessionOptions {
    /** Map of question key → answer string. */
    answers: Record<string, string>;
    /** Override whether fields are required: key → true|false. */
    requiredOverrides?: Record<string, boolean>;
}
interface FinalizeResult {
    session_id: string;
    status: "agent_created" | "needs_more_info";
    agent_id?: string;
    agent_name?: string;
    followup_questions: SessionQuestion[];
}
interface ExtractOptions {
    agentId: string;
    file: Blob | Buffer | NodeJS.ReadableStream | File;
    fileBack?: Blob | Buffer | NodeJS.ReadableStream | File;
    callbackUrl?: string;
}
interface BatchExtractOptions {
    agentId: string;
    files: Array<Blob | Buffer | NodeJS.ReadableStream | File>;
    callbackUrl?: string;
}
interface ExtractionResult {
    job_id: string;
    status: "completed" | "failed" | "processing";
    agent_id: string;
    agent_name: string;
    pages: number;
    data: Record<string, unknown>;
    accuracy: number;
    notes: string | null;
    credits_used: number;
}
interface BatchExtractionResult {
    batch_id: string;
    submitted: number;
    results: ExtractionResult[];
}
interface ResultsOptions {
    period?: "7d" | "30d" | "90d";
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
}
interface ResultItem {
    job_id: string;
    status: string;
    filename: string;
    data: Record<string, unknown>;
    accuracy: number;
    created_at: string;
}
interface ResultsPage {
    results: ResultItem[];
    total: number;
    page: number;
    pages: number;
}
interface DailyStatEntry {
    date: string;
    count: number;
    credits_used: number;
}
interface AgentStatsResponse {
    agent_id: string;
    stats: DailyStatEntry[];
}
interface Job {
    job_id: string;
    status: "completed" | "failed" | "processing";
    agent_id: string;
    agent_name: string;
    filename: string;
    result?: Record<string, unknown>;
    accuracy?: number;
    created_at: string;
    completed_at?: string;
}
interface JobsListOptions {
    status?: "completed" | "failed" | "processing";
    page?: number;
    limit?: number;
}

declare class AgentsResource {
    private http;
    constructor(http: HttpClient);
    /** List all your agents. */
    list(): Promise<Agent[]>;
    /** Get a single agent with its full schema. */
    get(agentId: string): Promise<AgentDetail>;
    /** Get just the schema (fields) for an agent. */
    getSchema(agentId: string): Promise<AgentSchema>;
    /** Update an agent's extraction schema. */
    updateSchema(agentId: string, schema: {
        fields: SchemaField[];
    }): Promise<AgentSchema>;
    /** Pause or reactivate an agent. */
    setStatus(agentId: string, action: "active" | "paused"): Promise<void>;
    /** Permanently delete an agent and all its jobs. */
    delete(agentId: string): Promise<void>;
    /** List extraction results for an agent. */
    results(agentId: string, options?: ResultsOptions): Promise<ResultsPage>;
    /** Export all results for an agent as CSV or XLSX. Returns a Buffer. */
    exportResults(agentId: string, options?: {
        format: "csv" | "xlsx";
    }): Promise<ArrayBuffer>;
    /** Get daily extraction stats for an agent (last 7 days). */
    stats(agentId: string): Promise<AgentStatsResponse>;
    /** Get full extraction history for an agent. */
    history(agentId: string, options?: {
        page?: number;
        limit?: number;
        period?: string;
    }): Promise<ResultsPage>;
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
    createSession(options: CreateSessionOptions): Promise<{
        session_id: string;
    }>;
    /**
     * Step 2 — Get AI-generated questions and suggested field names for the session.
     * The first call is slow (runs OCR + LLM analysis). Subsequent calls are instant.
     *
     * @example
     * const session = await client.agents.getSession(session_id);
     * console.log(session.doc_type_guess); // "invoice"
     * console.log(session.questions);      // [{key, question, suggested_value, ...}]
     */
    getSession(sessionId: string): Promise<SessionStatus>;
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
    finalizeSession(sessionId: string, options: FinalizeSessionOptions): Promise<FinalizeResult>;
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
    create(options: CreateSessionOptions): Promise<{
        agent_id: string;
        agent_name: string;
    }>;
}

declare class ExtractResource {
    private http;
    constructor(http: HttpClient);
    /** Extract structured data from a single document. Returns the result synchronously. */
    single(options: ExtractOptions): Promise<ExtractionResult>;
    /** Extract from multiple documents at once using the same agent. */
    batch(options: BatchExtractOptions): Promise<BatchExtractionResult>;
    /**
     * Pre-upload an image and get a URL you can pass to extract() later.
     * Useful for camera captures or async pipelines.
     */
    uploadImage(file: Blob | Buffer | NodeJS.ReadableStream): Promise<{
        url: string;
        expires_in: number;
    }>;
}

declare class JobsResource {
    private http;
    constructor(http: HttpClient);
    /** List all jobs across all agents. */
    list(options?: JobsListOptions): Promise<{
        jobs: Job[];
        total: number;
    }>;
    /** Get the status and result of a specific job. */
    get(jobId: string): Promise<Job>;
    /** Get the full extracted result for a completed job. */
    result(jobId: string): Promise<{
        job_id: string;
        result: Record<string, unknown>;
    }>;
    /** Download the result as JSON or CSV. Returns an ArrayBuffer. */
    download(jobId: string, format?: "json" | "csv"): Promise<ArrayBuffer>;
    /** Permanently delete a job and its result. */
    delete(jobId: string): Promise<void>;
}

declare class OcrAgentError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message: string);
}
declare class AuthError extends OcrAgentError {
    constructor(message?: string);
}
declare class ForbiddenError extends OcrAgentError {
    constructor(message: string);
}
declare class NotFoundError extends OcrAgentError {
    constructor(message?: string);
}
declare class RateLimitError extends OcrAgentError {
    readonly retryAfter: number;
    constructor(retryAfter?: number);
}
declare class ValidationError extends OcrAgentError {
    constructor(message: string);
}
/** Thrown when the account's plan limit is hit (monthly doc cap, agent slot cap, or API key limit). */
declare class PlanLimitError extends OcrAgentError {
    constructor(message: string);
}
/** Thrown when the agent is paused and cannot accept new jobs. */
declare class AgentPausedError extends OcrAgentError {
    constructor(message?: string);
}

declare class OcrAgent {
    readonly agents: AgentsResource;
    readonly extract: ExtractResource;
    readonly jobs: JobsResource;
    private _http;
    constructor(options: OcrAgentOptions);
}

export { type Agent, type AgentDetail, type AgentListResponse, AgentPausedError, type AgentSchema, type AgentStatsResponse, AuthError, type BatchExtractOptions, type BatchExtractionResult, type CreateSessionOptions, type DailyStatEntry, type ExtractOptions, type ExtractionResult, type FinalizeResult, type FinalizeSessionOptions, ForbiddenError, type Job, type JobsListOptions, NotFoundError, OcrAgent, OcrAgentError, type OcrAgentOptions, PlanLimitError, RateLimitError, type ResultItem, type ResultsOptions, type ResultsPage, type SchemaField, type SessionQuestion, type SessionStatus, ValidationError, OcrAgent as default };
