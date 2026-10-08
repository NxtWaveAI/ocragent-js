# nxtwaveai-ocr

Official Node.js / TypeScript SDK for [OCR Agent](https://ocr.nxtwaveai.com) — extract structured data from documents using AI.

## Installation

```bash
npm install nxtwaveai-ocr
```

## Quick Start

```ts
import OcrAgent from "nxtwaveai-ocr";
import fs from "fs";

const client = new OcrAgent({ apiKey: process.env.OCR_API_KEY });

// List your agents
const agents = await client.agents.list();

// Extract a document
const result = await client.extract({
  agentId: agents[0].id,
  file: fs.createReadStream("invoice.pdf"),
});

console.log(result.data);
// { invoice_number: "INV-001", total_amount: 4250, due_date: "2025-04-15" }
```

## API

### `new OcrAgent(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | required | Your API key (`sk_...`) |
| `baseUrl` | `string` | production URL | Override the API base URL |
| `maxRetries` | `number` | `3` | Retries on 429/5xx |
| `timeout` | `number` | `30000` | Request timeout (ms) |

### `client.agents`

```ts
// Manage existing agents
client.agents.list()
client.agents.get(agentId)
client.agents.getSchema(agentId)
client.agents.updateSchema(agentId, { fields })
client.agents.setStatus(agentId, "active" | "paused")
client.agents.delete(agentId)
client.agents.results(agentId, { period, page, limit })
client.agents.exportResults(agentId, { format: "csv" | "xlsx" })
client.agents.stats(agentId)

// Create a new agent (auto-confirms AI field suggestions)
const { agent_id } = await client.agents.create({
  file: fs.createReadStream("invoice.pdf"),
  docTypeHint: "invoice",      // optional hint
});

// Or use the 3-step wizard for more control:
const { session_id } = await client.agents.createSession({ file });
const session = await client.agents.getSession(session_id);
// session.questions has AI-suggested field names and types
const answers = Object.fromEntries(
  session.questions.map(q => [q.key, q.suggested_value])
);
const result = await client.agents.finalizeSession(session_id, { answers });
console.log(result.agent_id);
```

### `client.extract`

```ts
// Single document
client.extract({ agentId, file, fileBack?, callbackUrl? })

// Multiple documents
client.extract.batch({ agentId, files, callbackUrl? })

// Pre-upload an image
client.extract.uploadImage(file)
```

### `client.jobs`

```ts
client.jobs.list({ status?, page?, limit? })
client.jobs.get(jobId)
client.jobs.result(jobId)
client.jobs.download(jobId, "json" | "csv")
client.jobs.delete(jobId)
```

### Error Handling

```ts
import { OcrAgentError, AuthError, RateLimitError, PlanLimitError, AgentPausedError } from "nxtwaveai-ocr";

try {
  const result = await client.extract({ agentId: "...", file });
} catch (err) {
  if (err instanceof AuthError) {
    // 401 — invalid or expired API key
    console.error("Invalid API key");
  } else if (err instanceof PlanLimitError) {
    // 402/422 — monthly doc cap, agent slot limit, or key credit cap reached
    console.error("Plan limit reached:", err.message);
  } else if (err instanceof AgentPausedError) {
    // 422 — agent is paused
    console.error("Agent is paused — resume it first");
  } else if (err instanceof RateLimitError) {
    // 429 — too many requests
    console.error(`Rate limited. Retry after ${err.retryAfter}s`);
  } else if (err instanceof OcrAgentError) {
    console.error(err.status, err.code, err.message);
  }
}
```

## License

MIT © [NxtwaveAI](https://nxtwaveai.com)
