import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  createDiscussion,
  getDiscussion,
  listDiscussions,
  listParticipants,
  listMessages,
  addParticipant,
  removeParticipant,
  updateDiscussion,
} from "../services/db.js";
import { coordinator } from "../services/coordinator.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json<{ topic?: string; mode?: string; total_rounds?: number; role_count?: number }>().catch(() => ({}));
  if (!body.topic) return c.json({ error: "topic required" }, 400);
  const disc = createDiscussion(body.topic, body.mode || "roundtable", body.total_rounds || 10, body.role_count || 4);
  return c.json(disc);
});

app.get("/", (c) => {
  return c.json(listDiscussions());
});

app.get("/:id", (c) => {
  const disc = getDiscussion(parseInt(c.req.param("id")));
  if (!disc) return c.json({ error: "not found" }, 404);
  const participants = listParticipants(disc.id);
  const messages = listMessages(disc.id);
  return c.json({ ...disc, participants, messages });
});

app.post("/:id/research", async (c) => {
  const id = parseInt(c.req.param("id"));
  const disc = getDiscussion(id);
  if (!disc) return c.json({ error: "not found" }, 404);

  return streamSSE(c, async (stream) => {
    const send = (event: string, data: any) => {
      stream.writeSSE({ event, data: JSON.stringify(data) });
    };

    try {
      await coordinator.research(id, send);
    } catch (e: any) {
      send("error", { message: e.message });
    }
    stream.close();
  });
});

app.post("/:id/confirm", async (c) => {
  const id = parseInt(c.req.param("id"));
  const disc = getDiscussion(id);
  if (!disc) return c.json({ error: "not found" }, 404);

  const body = await c.req.json<{
    rounds?: number;
    addParticipants?: { name: string; role_prompt?: string; color?: string }[];
    includeUser?: boolean;
    userName?: string;
    moderatorModel?: string;
    participantModels?: Record<number, string>;
  }>().catch(() => ({}));

  coordinator.confirm(id, body);
  const updated = getDiscussion(id);
  const participants = listParticipants(id);
  return c.json({ ...updated, participants });
});

app.post("/:id/start", async (c) => {
  const id = parseInt(c.req.param("id"));
  const disc = getDiscussion(id);
  if (!disc) return c.json({ error: "not found" }, 404);
  if (disc.status === "active") return c.json({ error: "already active" }, 400);

  return streamSSE(c, async (stream) => {
    const send = (event: string, data: any) => {
      stream.writeSSE({ event, data: JSON.stringify(data) });
    };

    try {
      await coordinator.startDiscussion(id, send);
    } catch (e: any) {
      send("error", { message: e.message });
    }
    stream.close();
  });
});

app.post("/:id/stop", (c) => {
  const id = parseInt(c.req.param("id"));
  coordinator.stopDiscussion(id);
  return c.json({ ok: true });
});

app.post("/:id/summary", async (c) => {
  const id = parseInt(c.req.param("id"));
  const disc = getDiscussion(id);
  if (!disc) return c.json({ error: "not found" }, 404);

  return streamSSE(c, async (stream) => {
    const send = (event: string, data: any) => {
      stream.writeSSE({ event, data: JSON.stringify(data) });
    };

    try {
      await coordinator.generateSummary(id, send);
    } catch (e: any) {
      send("error", { message: e.message });
    }
    stream.close();
  });
});

app.post("/:id/raise-hand", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{ participant_id?: number }>().catch(() => ({}));
  const participants = listParticipants(id);
  const userP = body.participant_id
    ? participants.find((p: any) => p.id === body.participant_id)
    : participants.find((p: any) => p.type === "user");

  if (!userP) return c.json({ error: "no user participant" }, 404);
  coordinator.raiseHand(id, userP.id);
  return c.json({ ok: true, participant_id: userP.id });
});

app.post("/:id/cancel-hand", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{ participant_id?: number }>().catch(() => ({}));
  const participants = listParticipants(id);
  const userP = body.participant_id
    ? participants.find((p: any) => p.id === body.participant_id)
    : participants.find((p: any) => p.type === "user");

  if (!userP) return c.json({ error: "no user participant" }, 404);
  coordinator.cancelRaiseHand(userP.id);
  return c.json({ ok: true });
});

app.post("/:id/speak", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{ content: string }>();
  if (!body.content) return c.json({ error: "content required" }, 400);
  try {
    await coordinator.submitUserSpeech(id, body.content);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

app.post("/:id/add-rounds", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{ count: number }>();
  if (!body.count) return c.json({ error: "count required" }, 400);
  coordinator.addRounds(id, body.count);
  const updated = getDiscussion(id);
  return c.json(updated);
});

app.get("/:id/messages", (c) => {
  const id = parseInt(c.req.param("id"));
  return c.json(listMessages(id));
});

app.get("/:id/participants", (c) => {
  const id = parseInt(c.req.param("id"));
  return c.json(listParticipants(id));
});

app.delete("/:id/participants/:pid", (c) => {
  removeParticipant(parseInt(c.req.param("pid")));
  return c.json({ ok: true });
});

app.post("/:id/participants", async (c) => {
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json<{ name: string; role_prompt: string }>();
  if (!body.name) return c.json({ error: "name required" }, 400);
  const participants = listParticipants(id);
  const p = addParticipant(id, {
    name: body.name,
    role_prompt: body.role_prompt || "",
    color: "#1890ff",
    type: "ai",
    sort_order: participants.length + 1,
  });
  return c.json(p);
});

export default app;
