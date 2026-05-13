const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    "Content-Type": "application/json",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export function createDiscussion(topic, mode = "roundtable", totalRounds = 10, roleCount = 4, moderatorModel = null) {
  return request("/discussions", {
    method: "POST",
    body: JSON.stringify({ topic, mode, total_rounds: totalRounds, role_count: roleCount, moderator_model: moderatorModel ? JSON.stringify(moderatorModel) : "" }),
  });
}

export function getDiscussion(id) {
  return request(`/discussions/${id}`);
}

export function listDiscussions() {
  return request("/discussions");
}

export function researchDiscussion(id, onEvent) {
  return new Promise((resolve, reject) => {
    fetch(`${BASE}/discussions/${id}/research`, { method: "POST" }).then((res) => {
      if (!res.ok) {
        reject(new Error(`research failed: ${res.status}`));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";
      let finalData = null;

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            resolve(finalData);
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              if (!data) continue;
              try {
                const parsed = JSON.parse(data);
                if (currentEvent === "research_done") {
                  finalData = parsed;
                }
                onEvent(currentEvent, parsed);
              } catch {}
              currentEvent = "message";
            }
          }
          read();
        }).catch(reject);
      }
      read();
    }).catch(reject);
  });
}

export function confirmDiscussion(id, opts = {}) {
  return request(`/discussions/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

export function startDiscussion(id, onEvent) {
  return new Promise((resolve, reject) => {
    fetch(`${BASE}/discussions/${id}/start`, { method: "POST" }).then((res) => {
      if (!res.ok) {
        reject(new Error(`start failed: ${res.status}`));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            resolve();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              if (!data) continue;
              try {
                onEvent(currentEvent, JSON.parse(data));
              } catch {}
              currentEvent = "message";
            }
          }
          read();
        }).catch(reject);
      }
      read();
    }).catch(reject);
  });
}

export function stopDiscussion(id) {
  return request(`/discussions/${id}/stop`, { method: "POST" });
}

export function raiseHand(id, participantId) {
  return request(`/discussions/${id}/raise-hand`, {
    method: "POST",
    body: JSON.stringify({ participant_id: participantId }),
  });
}

export function cancelHand(id, participantId) {
  return request(`/discussions/${id}/cancel-hand`, {
    method: "POST",
    body: JSON.stringify({ participant_id: participantId }),
  });
}

export function submitSpeech(id, content) {
  return request(`/discussions/${id}/speak`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function addRounds(id, count) {
  return request(`/discussions/${id}/add-rounds`, {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}

export function addParticipant(id, name, rolePrompt) {
  return request(`/discussions/${id}/participants`, {
    method: "POST",
    body: JSON.stringify({ name, role_prompt: rolePrompt }),
  });
}

export function removeParticipant(id, pid) {
  return request(`/discussions/${id}/participants/${pid}`, {
    method: "DELETE",
  });
}

export function getModels() {
  return request("/models");
}

export function generateSummary(id, onEvent) {
  return new Promise((resolve, reject) => {
    fetch(`${BASE}/discussions/${id}/summary`, { method: "POST" }).then((res) => {
      if (!res.ok) {
        reject(new Error(`summary failed: ${res.status}`));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "message";

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            resolve();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              if (!data) continue;
              try {
                onEvent(currentEvent, JSON.parse(data));
              } catch {}
              currentEvent = "message";
            }
          }
          read();
        }).catch(reject);
      }
      read();
    }).catch(reject);
  });
}

export async function exportDiscussion(id) {
  const res = await fetch(`${BASE}/discussions/${id}/export`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  let filename = `discussion-${id}.docx`;
  const m = cd.match(/filename\*=UTF-8''(.+)/i) || cd.match(/filename="?([^";]+)"?/i);
  if (m) filename = decodeURIComponent(m[1]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
