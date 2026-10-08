export interface OcrAgentOptions {
  apiKey: string;
  baseUrl?: string;
  maxRetries?: number;
  timeout?: number;
}

// ── Agents ────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  status: "active" | "paused";
  expected_pages: number;
  fields_count: number;
  total_extractions: number;
  created_at: string;
}

export interface SchemaField {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "array";
  description?: string;
}

export interface AgentSchema {
  fields: SchemaField[];
}

export interface AgentDetail extends Agent {
  schema: AgentSchema;
}

export interface AgentListResponse {
  agents: Agent[];
  total: number;
}

// ── Agent creation (wizard) ───────────────────────────────────

export interface CreateSessionOptions {
  /** Sample document image (front page). JPEG, PNG, or WEBP. */
  file: Blob | Buffer | NodeJS.ReadableStream | File;
  /** Back-page image when page_layout is "two_sided". */
  fileBack?: Blob | Buffer | NodeJS.ReadableStream | File;
  /** "single" (default) or "two_sided". */
  pageLayout?: "single" | "two_sided";
  /** Optional hint, e.g. "invoice", "passport". */
  docTypeHint?: string;
}

export interface SessionQuestion {
  key: string;
  question: string;
  kind: string;
  suggested_value: string;
  hint: string;
  confirmed_value: string;
  required?: boolean;
}

export interface SessionStatus {
  session_id: string;
  status: string;
  doc_type_guess: string;
  questions: SessionQuestion[];
  suggested_answers: Record<string, { value: string; hint: string }>;
  answers: Record<string, string>;
  created_agent_id: string | null;
}

export interface FinalizeSessionOptions {
  /** Map of question key → answer string. */
  answers: Record<string, string>;
  /** Override whether fields are required: key → true|false. */
  requiredOverrides?: Record<string, boolean>;
}

export interface FinalizeResult {
  session_id: string;
  status: "agent_created" | "needs_more_info";
  agent_id?: string;
  agent_name?: string;
  followup_questions: SessionQuestion[];
}

// ── Extraction ────────────────────────────────────────────────

export interface ExtractOptions {
  agentId: string;
  file: Blob | Buffer | NodeJS.ReadableStream | File;
  fileBack?: Blob | Buffer | NodeJS.ReadableStream | File;
  callbackUrl?: string;
}

export interface BatchExtractOptions {
  agentId: string;
  files: Array<Blob | Buffer | NodeJS.ReadableStream | File>;
  callbackUrl?: string;
}

export interface ExtractionResult {
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

export interface BatchExtractionResult {
  batch_id: string;
  submitted: number;
  results: ExtractionResult[];
}

// ── Results ───────────────────────────────────────────────────

export interface ResultsOptions {
  period?: "7d" | "30d" | "90d";
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

export interface ResultItem {
  job_id: string;
  status: string;
  filename: string;
  data: Record<string, unknown>;
  accuracy: number;
  created_at: string;
}

export interface ResultsPage {
  results: ResultItem[];
  total: number;
  page: number;
  pages: number;
}

// ── Stats / History ───────────────────────────────────────────

export interface DailyStatEntry {
  date: string;
  count: number;
  credits_used: number;
}

export interface AgentStatsResponse {
  agent_id: string;
  stats: DailyStatEntry[];
}

// ── Jobs ──────────────────────────────────────────────────────

export interface Job {
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

export interface JobsListOptions {
  status?: "completed" | "failed" | "processing";
  page?: number;
  limit?: number;
}
