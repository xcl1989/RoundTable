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
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, BorderStyle, ShadingType, LevelFormat } from "docx";
import { getModelDisplayName, ModelConfig } from "../services/opencode.js";

function parseModelName(jsonStr: string, fallback = ""): string {
  if (!jsonStr) return fallback;
  try {
    return getModelDisplayName(JSON.parse(jsonStr) as ModelConfig);
  } catch {
    return fallback;
  }
}

function parseInlineMd(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), font: "Microsoft YaHei", size: 22, bold: true }));
    } else {
      runs.push(new TextRun({ text: part, font: "Microsoft YaHei", size: 22 }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text, font: "Microsoft YaHei", size: 22 })];
}

function mdToParagraphs(text: string, opts?: { headingColor?: string }): Paragraph[] {
  const lines = text.split("\n");
  const result: Paragraph[] = [];
  for (const line of lines) {
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      result.push(new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: h3Match[1], font: "Microsoft YaHei", size: 24, bold: true, color: opts?.headingColor || "333333" })],
      }));
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      result.push(new Paragraph({
        spacing: { before: 280, after: 140 },
        children: [new TextRun({ text: h2Match[1], font: "Microsoft YaHei", size: 26, bold: true, color: opts?.headingColor || "333333" })],
      }));
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      result.push(new Paragraph({
        spacing: { before: 300, after: 160 },
        children: [new TextRun({ text: h1Match[1], font: "Microsoft YaHei", size: 28, bold: true, color: opts?.headingColor || "333333" })],
      }));
      continue;
    }
    const bulletMatch = line.match(/^-\s+(.+)/);
    if (bulletMatch) {
      result.push(new Paragraph({
        numbering: { reference: "md-bullet", level: 0 },
        spacing: { after: 60 },
        children: parseInlineMd(bulletMatch[1]),
      }));
      continue;
    }
    if (line.trim() === "") {
      continue;
    }
    result.push(new Paragraph({ spacing: { after: 100 }, children: parseInlineMd(line) }));
  }
  return result;
}

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json<{ topic?: string; mode?: string; total_rounds?: number; role_count?: number; moderator_model?: string }>().catch(() => ({}));
  if (!body.topic) return c.json({ error: "topic required" }, 400);
  const disc = createDiscussion(body.topic, body.mode || "roundtable", body.total_rounds || 10, body.role_count || 4, body.moderator_model || "");
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

app.get("/:id/export", async (c) => {
  const id = parseInt(c.req.param("id"));
  const disc = getDiscussion(id);
  if (!disc) return c.json({ error: "not found" }, 404);

  const participants = listParticipants(id) as any[];
  const messages = listMessages(id) as any[];
  const pMap = new Map(participants.map((p: any) => [p.id, p]));

  const topic = disc.title || disc.topic;
  const bg = disc.news_summary || "";
  const summaryMsg = messages.filter((m: any) => m.type === "summary").pop();
  const speechMsgs = messages.filter((m: any) => m.type !== "summary");

  const roundGroups = new Map<number, any[]>();
  for (const m of speechMsgs) {
    const r = m.round || 0;
    if (!roundGroups.has(r)) roundGroups.set(r, []);
    roundGroups.get(r)!.push(m);
  }
  const sortedRounds = [...roundGroups.entries()].sort((a, b) => a[0] - b[0]);

  const gold = "8B6914";
  const darkGold = "6B5010";
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: "圆桌讨论记录", font: "Microsoft YaHei", size: 48, color: gold, bold: true })],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: topic, font: "Microsoft YaHei", size: 32, color: "333333" })],
    }),
  );

  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "议题", font: "Microsoft YaHei" })] }),
  );
  for (const line of disc.topic.split("\n")) {
    children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: line, font: "Microsoft YaHei", size: 22 })] }));
  }

  if (bg) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "讨论背景", font: "Microsoft YaHei" })] }),
    );
    children.push(...mdToParagraphs(bg));
  }

  const moderatorModel = parseModelName(disc.moderator_model, summaryMsg?.model_name || "");

  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "与会嘉宾", font: "Microsoft YaHei" })] }),
  );
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: "主持人", font: "Microsoft YaHei", size: 22, bold: true, color: gold }),
        new TextRun({ text: moderatorModel ? ` — ${moderatorModel}` : "", font: "Microsoft YaHei", size: 20, color: "666666" }),
      ],
    }),
  );
  for (const p of participants) {
    const label = p.type === "user" ? "（用户）" : "";
    const desc = p.role_prompt ? ` — ${p.role_prompt}` : "";
    const modelName = parseModelName(p.model_config || "");
    const modelTag = modelName && p.type !== "user" ? ` · ${modelName}` : "";
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${p.name}${label}`, font: "Microsoft YaHei", size: 22, bold: true, color: p.color || gold }),
          new TextRun({ text: `${desc}${modelTag}`, font: "Microsoft YaHei", size: 20, color: "666666" }),
        ],
      }),
    );
  }

  if (sortedRounds.length > 0) {
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "讨论过程", font: "Microsoft YaHei" })] }),
    );

    for (const [roundNum, msgs] of sortedRounds) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun({ text: `第 ${roundNum} 轮`, font: "Microsoft YaHei", color: darkGold })],
        }),
      );
      for (const m of msgs) {
        const p = pMap.get(m.participant_id) as any;
        const name = p?.name || "主持人";
        const color = p?.color || gold;
        children.push(
          new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [new TextRun({ text: name, font: "Microsoft YaHei", size: 22, bold: true, color })],
          }),
        );
        children.push(...mdToParagraphs(m.content || ""));
      }
    }
  }

  if (summaryMsg) {
    const summaryModel = summaryMsg.model_name || moderatorModel;
    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "讨论总结", font: "Microsoft YaHei" })],
      }),
    );
    if (summaryModel) {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: `生成模型：${summaryModel}`, font: "Microsoft YaHei", size: 20, color: "666666", italics: true })],
        }),
      );
    }
    children.push(...mdToParagraphs(summaryMsg.content || ""));
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: "md-bullet",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: { document: { run: { font: "Microsoft YaHei", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 32, bold: true, color: gold, font: "Microsoft YaHei" },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, color: darkGold, font: "Microsoft YaHei" },
          paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = encodeURIComponent(`${topic.slice(0, 20)}.docx`);
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  c.header("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
  return c.body(buffer);
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
