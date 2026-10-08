import { HttpClient } from "./http.js";
import { AgentsResource } from "./resources/agents.js";
import { ExtractResource } from "./resources/extract.js";
import { JobsResource } from "./resources/jobs.js";
import type { OcrAgentOptions } from "./types.js";

export { OcrAgentError, AuthError, ForbiddenError, NotFoundError, RateLimitError, ValidationError, PlanLimitError, AgentPausedError } from "./errors.js";
export type * from "./types.js";

export class OcrAgent {
  readonly agents: AgentsResource;
  readonly extract: ExtractResource;
  readonly jobs: JobsResource;

  private _http: HttpClient;

  constructor(options: OcrAgentOptions) {
    if (!options.apiKey) throw new Error("OcrAgent: apiKey is required.");
    this._http = new HttpClient(options);
    this.extract = new ExtractResource(this._http);
    this.agents = new AgentsResource(this._http);
    this.jobs = new JobsResource(this._http);
  }
}

export default OcrAgent;
