import { Hono } from "hono";
import { config } from "../config.js";

const BASE = config.OPENCODE_BASE_URL;
const AUTH_HEADER = "Basic " + Buffer.from(`${config.OPENCODE_USERNAME}:${config.OPENCODE_PASSWORD}`).toString("base64");

const app = new Hono();

let cachedModels: { providerID: string; modelID: string; name: string; provider: string }[] | null = null;

async function fetchModels() {
  const resp = await fetch(`${BASE}/provider`, {
    headers: { Authorization: AUTH_HEADER },
  });
  if (!resp.ok) throw new Error(`fetch providers failed: ${resp.status}`);
  const data = await resp.json() as any;

  const connected: string[] = data.connected || [];
  const allProviders: any[] = data.all || [];

  const models: { providerID: string; modelID: string; name: string; provider: string }[] = [];

  for (const prov of allProviders) {
    const pid = prov.id;
    if (!connected.includes(pid)) continue;
    const provName = prov.name || pid;
    const provModels = prov.models || {};
    for (const [mid, m] of Object.entries(provModels)) {
      const model = m as any;
      const caps = model.capabilities || {};
      const input = caps.input || {};
      const output = caps.output || {};
      if (!input.text || !output.text) continue;
      models.push({
        providerID: pid,
        modelID: mid,
        name: model.name || mid,
        provider: provName,
      });
    }
  }

  return models;
}

app.get("/", async (c) => {
  try {
    if (!cachedModels) {
      cachedModels = await fetchModels();
    }
    return c.json(cachedModels);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/refresh", async (c) => {
  try {
    cachedModels = await fetchModels();
    return c.json({ ok: true, count: cachedModels.length });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
