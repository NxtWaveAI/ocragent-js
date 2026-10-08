import type { HttpClient } from "../http.js";
import type { Job, JobsListOptions } from "../types.js";

export class JobsResource {
  constructor(private http: HttpClient) {}

  /** List all jobs across all agents. */
  async list(options: JobsListOptions = {}): Promise<{ jobs: Job[]; total: number }> {
    return this.http.request("GET", "/jobs", {
      params: { status: options.status, page: options.page, limit: options.limit },
    });
  }

  /** Get the status and result of a specific job. */
  async get(jobId: string): Promise<Job> {
    return this.http.request("GET", `/jobs/${jobId}`);
  }

  /** Get the full extracted result for a completed job. */
  async result(jobId: string): Promise<{ job_id: string; result: Record<string, unknown> }> {
    return this.http.request("GET", `/jobs/${jobId}/result`);
  }

  /** Download the result as JSON or CSV. Returns an ArrayBuffer. */
  async download(jobId: string, format: "json" | "csv" = "json"): Promise<ArrayBuffer> {
    return this.http.request("GET", `/jobs/${jobId}/download`, {
      params: { format },
      binary: true,
    });
  }

  /** Permanently delete a job and its result. */
  async delete(jobId: string): Promise<void> {
    return this.http.request("DELETE", `/jobs/${jobId}`);
  }
}
