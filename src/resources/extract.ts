import type { HttpClient } from "../http.js";
import type {
  BatchExtractOptions,
  BatchExtractionResult,
  ExtractionResult,
  ExtractOptions,
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

export class ExtractResource {
  constructor(private http: HttpClient) {}

  /** Extract structured data from a single document. Returns the result synchronously. */
  async single(options: ExtractOptions): Promise<ExtractionResult> {
    const form = new FormData();
    form.append("agent_id", options.agentId);
    form.append("file_front", await toBlob(options.file));
    if (options.fileBack) form.append("file_back", await toBlob(options.fileBack));
    if (options.callbackUrl) form.append("callback_url", options.callbackUrl);

    const raw = await this.http.request<Record<string, unknown>>("POST", "/extract", { form });
    return { ...raw, data: raw.result ?? {} } as unknown as ExtractionResult;
  }

  /** Extract from multiple documents at once using the same agent. */
  async batch(options: BatchExtractOptions): Promise<BatchExtractionResult> {
    const form = new FormData();
    form.append("agent_id", options.agentId);
    for (const file of options.files) {
      form.append("files", await toBlob(file));
    }
    if (options.callbackUrl) form.append("callback_url", options.callbackUrl);

    return this.http.request("POST", "/extract/batch", { form });
  }

  /**
   * Pre-upload an image and get a URL you can pass to extract() later.
   * Useful for camera captures or async pipelines.
   */
  async uploadImage(file: Blob | Buffer | NodeJS.ReadableStream): Promise<{ url: string; expires_in: number }> {
    const form = new FormData();
    form.append("file", await toBlob(file));
    return this.http.request("POST", "/upload/image", { form });
  }
}
