import { config } from "../config.js";

export interface ModelConfig {
  providerID: string;
  modelID: string;
}

export const MODERATOR_MODEL: ModelConfig = { providerID: "zai-coding-plan", modelID: "glm-5.1" };
export const PARTICIPANT_MODEL: ModelConfig = { providerID: "opencode-go", modelID: "deepseek-v4-flash" };
export const PARTICIPANT_MODEL_LATE: ModelConfig = { providerID: "opencode-go", modelID: "deepseek-v4-pro" };

export function getModelDisplayName(model?: ModelConfig): string {
  if (!model) return "";
  const map: Record<string, string> = {
    "glm-5.1": "GLM-5.1",
    "deepseek-v4-flash": "DeepSeek V4 Flash",
    "deepseek-v4-pro": "DeepSeek V4 Pro",
  };
  return map[model.modelID] || model.modelID;
}

const BASE = config.OPENCODE_BASE_URL;
const AUTH_HEADER = "Basic " + Buffer.from(`${config.OPENCODE_USERNAME}:${config.OPENCODE_PASSWORD}`).toString("base64");

const headers = {
  "Content-Type": "application/json",
  Authorization: AUTH_HEADER,
};

export async function createSession(): Promise<string> {
  const resp = await fetch(`${BASE}/session`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  if (!resp.ok) throw new Error(`create session failed: ${resp.status}`);
  const data = await resp.json();
  return data.id;
}

interface StreamCallbacks {
  onDelta: (delta: string) => void;
  onReasoning?: (delta: string) => void;
}

interface StreamResult {
  text: string;
  reasoning: string;
}

async function postPrompt(sessionId: string, prompt: string, systemHint?: string, model?: ModelConfig) {
  const parts: any[] = [];
  if (systemHint) parts.push({ type: "text", text: systemHint });
  parts.push({ type: "text", text: prompt });

  const body: any = { parts, agent: "build" };
  if (model) body.model = model;

  const resp = await fetch(`${BASE}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`prompt failed: ${resp.status}`);
}

function processSSELines(
  lines: string[],
  sessionId: string,
  reasoningPartIds: Set<string>,
  callbacks: StreamCallbacks | null,
  state: { fullText: string; fullReasoning: string; currentText: string; currentPartId: string }
): "idle" | "continue" {
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    try {
      const data = JSON.parse(line.slice(6));
      const payload = data.payload || {};
      const props = payload.properties || {};
      const eventType = payload.type || "";

      const session = props.sessionID || props.info?.sessionID || props.part?.sessionID || "";
      if (session && session !== sessionId) continue;

      if (eventType === "message.part.updated") {
        const part = props.part || {};
        const partType = part.type || "";
        const partId = part.id || "";

        if (partType === "reasoning") {
          reasoningPartIds.add(partId);
          const text = part.text || "";
          if (text) {
            state.fullReasoning += text;
            callbacks?.onReasoning?.(text);
          }
        }

        if (partType === "text" && part.time?.end) {
          if (state.currentText.trim()) {
            state.fullText += state.currentText;
            state.currentText = "";
          }
        }
      } else if (eventType === "message.part.delta") {
        const delta = props.delta || "";
        const partId = props.partID || state.currentPartId;
        if (delta) {
          if (reasoningPartIds.has(partId)) {
            state.fullReasoning += delta;
            callbacks?.onReasoning?.(delta);
          } else {
            state.currentText += delta;
            callbacks?.onDelta(delta);
          }
        }
      } else if (eventType === "session.status") {
        if (props.status?.type === "idle") {
          if (state.currentText) state.fullText += state.currentText;
          return "idle";
        }
      }
    } catch {}
  }
  return "continue";
}

export async function sendPrompt(sessionId: string, prompt: string, systemHint?: string, model?: ModelConfig): Promise<StreamResult> {
  await postPrompt(sessionId, prompt, systemHint, model);

  const resp = await fetch(`${BASE}/global/event`, { headers });
  if (!resp.ok || !resp.body) throw new Error(`SSE failed: ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const reasoningPartIds = new Set<string>();
  const state = { fullText: "", fullReasoning: "", currentText: "", currentPartId: "" };
  let buffer = "";
  const start = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (Date.now() - start > 300000) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    const result = processSSELines(lines, sessionId, reasoningPartIds, null, state);
    if (result === "idle") {
      return { text: state.fullText, reasoning: state.fullReasoning };
    }
  }
  if (state.currentText) state.fullText += state.currentText;
  return { text: state.fullText, reasoning: state.fullReasoning };
}

export async function sendPromptStream(
  sessionId: string,
  prompt: string,
  onDelta: (delta: string) => void,
  systemHint?: string,
  onReasoning?: (delta: string) => void,
  model?: ModelConfig
): Promise<StreamResult> {
  await postPrompt(sessionId, prompt, systemHint, model);

  const sseResp = await fetch(`${BASE}/global/event`, { headers });
  if (!sseResp.ok || !sseResp.body) throw new Error(`SSE failed: ${sseResp.status}`);

  const reader = sseResp.body.getReader();
  const decoder = new TextDecoder();
  const reasoningPartIds = new Set<string>();
  const state = { fullText: "", fullReasoning: "", currentText: "", currentPartId: "" };
  const callbacks: StreamCallbacks = { onDelta, onReasoning };
  let buffer = "";
  const start = Date.now();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (Date.now() - start > 300000) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    const result = processSSELines(lines, sessionId, reasoningPartIds, callbacks, state);
    if (result === "idle") {
      return { text: state.fullText, reasoning: state.fullReasoning };
    }
  }
  if (state.currentText) state.fullText += state.currentText;
  return { text: state.fullText, reasoning: state.fullReasoning };
}
