export class OcrAgentError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "OcrAgentError";
    this.status = status;
    this.code = code;
  }
}

export class AuthError extends OcrAgentError {
  constructor(message = "Invalid or expired API key.") {
    super(401, "UNAUTHORIZED", message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends OcrAgentError {
  constructor(message: string) {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends OcrAgentError {
  constructor(message = "Resource not found.") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends OcrAgentError {
  readonly retryAfter: number;

  constructor(retryAfter = 60) {
    super(429, "RATE_LIMITED", `Rate limit exceeded. Retry after ${retryAfter}s.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class ValidationError extends OcrAgentError {
  constructor(message: string) {
    super(422, "VALIDATION_ERROR", message);
    this.name = "ValidationError";
  }
}

/** Thrown when the account's plan limit is hit (monthly doc cap, agent slot cap, or API key limit). */
export class PlanLimitError extends OcrAgentError {
  constructor(message: string) {
    super(402, "plan_limit_exceeded", message);
    this.name = "PlanLimitError";
  }
}

/** Thrown when the agent is paused and cannot accept new jobs. */
export class AgentPausedError extends OcrAgentError {
  constructor(message = "This agent is paused. Resume it before submitting jobs.") {
    super(422, "agent_paused", message);
    this.name = "AgentPausedError";
  }
}
