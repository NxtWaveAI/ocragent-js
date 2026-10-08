import {
  AgentPausedError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  OcrAgentError,
  PlanLimitError,
  RateLimitError,
  ValidationError,
} from "./errors.js";

const DEFAULT_BASE_URL = "https://apiocr.nxtwaveai.com/v1";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 30_000;

export class HttpClient {
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;
  private timeout: number;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    maxRetries?: number;
    timeout?: number;
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: Record<string, unknown>;
      form?: FormData;
      params?: Record<string, string | number | undefined>;
      binary?: boolean;
    },
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = { "X-API-Key": this.apiKey };
    let bodyInit: BodyInit | undefined;

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

      let res: Response;
      try {
        res = await fetch(url.toString(), {
          method,
          headers,
          body: bodyInit,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      // Retry on 429 or 5xx (up to maxRetries)
      if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
        const waitMs = res.status === 429
          ? Math.min(Number(res.headers.get("Retry-After") ?? 60) * 1000, 60_000)
          : Math.min(2 ** (attempt - 1) * 1000, 30_000);
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({
          detail: res.statusText,
          code: "UNKNOWN",
        }));
        const msg: string = err.detail ?? "Unknown error";
        const code: string = err.code ?? "UNKNOWN";
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

      if (res.status === 204) return undefined as T;
      if (options?.binary) return res.arrayBuffer() as unknown as T;
      return res.json() as Promise<T>;
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
