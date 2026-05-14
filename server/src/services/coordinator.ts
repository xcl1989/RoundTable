import {
  getDiscussion,
  updateDiscussion,
  addParticipant,
  listParticipants,
  getParticipant,
  updateParticipant,
  addMessage,
  listMessages,
} from "./db.js";
import { createSession, sendPrompt, sendPromptStream, MODERATOR_MODEL, PARTICIPANT_MODEL, PARTICIPANT_MODEL_LATE, getModelDisplayName, ModelConfig } from "./opencode.js";

function parseModelConfig(json: string): ModelConfig | undefined {
  if (!json) return undefined;
  try {
    const obj = JSON.parse(json);
    if (obj.providerID && obj.modelID) return obj as ModelConfig;
  } catch {}
  return undefined;
}

function getModeratorModel(disc: any): ModelConfig {
  return parseModelConfig(disc.moderator_model) || MODERATOR_MODEL;
}

function getParticipantModel(participant: any, totalSpeeches: number, speechIndex: number): ModelConfig {
  const custom = parseModelConfig(participant.model_config);
  if (custom) return custom;
  return speechIndex > Math.floor(totalSpeeches * 2 / 3) ? PARTICIPANT_MODEL_LATE : PARTICIPANT_MODEL;
}

function fixJsonQuotes(text: string): string {
  let result = "";
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && (i === 0 || text[i - 1] !== "\\")) {
      if (!inStr) {
        inStr = true;
        result += ch;
      } else {
        const after = text.slice(i + 1).match(/\S/);
        const nextCh = after?.[0];
        if (nextCh && !",}]:\n\r".includes(nextCh)) {
          result += "\\u201c";
        } else {
          inStr = false;
          result += ch;
        }
      }
    } else {
      result += ch;
    }
  }
  return result;
}

const COLORS = ["#1890ff", "#f5222d", "#52c41a", "#fa8c16", "#722ed1", "#13c2c2", "#eb2f96", "#faad14"];

const MODERATOR_SYSTEM = `你是一个圆桌讨论主持人。你的职责：
1. 根据话题搜索最新资讯，提炼讨论问题
2. 为讨论生成多元视角的参与者角色
3. 协调讨论流程，决定每次由谁发言
4. 最后生成讨论总结

规则：
- 生成角色时确保观点多元，不重复立场
- 每次判断发言者时考虑讨论平衡性，避免某位参与者发言过频
- 回复简洁直接，不要多余解释`;

const RESEARCH_PROMPT = (topic: string) => `你是一个圆桌讨论主持人。用户提出话题：「${topic}」

首先判断：这个话题是否需要依赖最新实时资讯才能讨论？
- 需要搜索：涉及新闻事件、政策动态、行业趋势、市场变化等时效性强的话题
- 无需搜索：概念性、哲学性、观点性话题（如 "AI是否应有版权""996工作制的利弊""教育内卷" 等），直接用你的知识

【需要搜索时】
1. 使用 webfetch 工具依次搜索：
   - 百度新闻热搜：https://top.baidu.com/board?tab=realtime
   - 网易新闻：https://news.163.com
   - 新浪新闻：https://news.sina.com.cn
2. 汇总信息，用2-3句话概括最新动态作为 news
3. 基于信息提炼一个值得深入讨论的问题

【无需搜索时】
1. 将话题优化为一个更精炼、更有讨论空间的问句作为 question
2. news 字段留空字符串 ""
3. 不需要使用 webfetch

严格按JSON格式输出，不要加其他内容：
{"news": "动态概括（无需搜索时为空字符串）", "question": "优化的讨论问题"}`;

const GENERATE_ROLES_PROMPT = (topic: string, question: string, news: string, roleCount: number) => `讨论话题：${topic}
讨论问题：${question}
背景资讯：${news}

请生成${roleCount}个不同视角的讨论参与者，确保立场多元、背景多样。

严格按以下JSON数组格式回复，不要加其他内容：
[{"name": "姓名", "role": "身份背景，如：资深XX、XX领域专家", "stance": "核心观点倾向"}]
注意：JSON字符串值内部不要使用英文双引号，如需引用请用中文引号「」或『』。`;

const WHO_NEXT_PROMPT = (
  question: string,
  speechIndex: number,
  totalSpeeches: number,
  participants: any[],
  recentSpeakers: { id: number; name: string }[],
  lastSpeech: string | null,
  userWantsToSpeak: boolean,
  userName: string
) => {
  const aiList = participants
    .filter((p: any) => p.type === "ai")
    .map((p: any) => `${p.id}. ${p.name}（${p.role_prompt}）`)
    .join("\n");
  const recentNames = recentSpeakers.length > 0
    ? recentSpeakers.map(s => s.name).join("、")
    : "无";
  const userNote = userWantsToSpeak ? `\n\n⚠️ ${userName} 已举手，请优先安排其发言，回复 "user"。` : "";
  const lastSpeechSection = lastSpeech ? `\n最近一次发言：\n${lastSpeech}` : "";

  return `讨论问题：${question}
当前第 ${speechIndex}/${totalSpeeches} 次发言。
最近发言者：${recentNames}
可选发言者：
${aiList}
${userNote}
${lastSpeechSection}

请选择你认为最合适的下一位发言者。严格只回复一个纯数字ID。${userWantsToSpeak ? '如需安排举手用户发言，回复 "user"。' : ''}不要回复任何其他文字。`;
};

const SPEAKER_PROMPT = (name: string, role: string, question: string, gapMessages: string, isFirstSpeaker: boolean) =>
  `你正在参加一场圆桌讨论。

你的身份：${name}，${role}
讨论问题：${question}

${gapMessages ? `自你上次发言以来的讨论内容：\n${gapMessages}` : (isFirstSpeaker ? "你是第一位发言者。" : "你被再次邀请发言，请补充观点或回应之前的讨论。")}

请基于你的身份和立场发言（200-400字）。直接发言，不要重复身份信息。`;

const SUMMARY_PROMPT = (question: string, userNote: string = "", lastSpeech: string | null = null) =>
  `讨论问题：${question}
${lastSpeech ? `\n最后一次发言：\n${lastSpeech}\n` : ""}${userNote}
请根据你在本次讨论中积累的所有信息，生成一份讨论总结。

要求：
- 使用纯 Markdown 格式输出，不要使用 JSON
- 用二级标题 ## 分隔各部分
- 列表使用 - 符号

格式如下：
## 各方核心观点
（每人1-2句，仅总结实际发言的参与者，不要为未发言者编造观点）

## 主要共识
（列出2-4点）

## 主要分歧
（列出2-4点）

## 总结性评论
（一段总结）`;

export class DiscussionCoordinator {
  async research(
    discussionId: number,
    onEvent?: (event: string, data: any) => void
  ): Promise<{ news: string; question: string; roles: any[] }> {
    const disc = getDiscussion(discussionId);
    if (!disc) throw new Error("讨论不存在");

    const emit = (event: string, data: any) => { try { onEvent?.(event, data); } catch {} };

    const modSession = await createSession();
    updateDiscussion(discussionId, { moderator_session_id: modSession, status: "researching" });

    emit("research_status", { message: "AI 主持人正在分析话题、准备讨论..." });

    const moderatorModel = getModeratorModel(disc);

    let researchResult = "";
    if (onEvent) {
      const stream = await sendPromptStream(modSession, RESEARCH_PROMPT(disc.topic), (delta) => {
        emit("research_delta", { delta });
      }, undefined, (rDelta) => {
        emit("thinking_delta", { delta: rDelta });
      }, moderatorModel);
      researchResult = stream.text;
    } else {
      const result = await sendPrompt(modSession, RESEARCH_PROMPT(disc.topic), undefined, moderatorModel);
      researchResult = result.text;
    }

    let news = "";
    let question = "";
    try {
      const jsonMatch = researchResult.match(/\{[\s\S]*\}/)?.[0];
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch);
        news = parsed.news || "";
        question = parsed.question || disc.topic;
      } else {
        const braceIdx = researchResult.indexOf("{");
        if (braceIdx >= 0) {
          let partial = researchResult.slice(braceIdx);
          for (let extra = 0; extra <= 3; extra++) {
            try {
              const parsed = JSON.parse(partial + "}".repeat(extra));
              news = parsed.news || "";
              question = parsed.question || disc.topic;
              break;
            } catch {}
          }
        }
      }
    } catch {
      question = disc.topic;
    }

    emit("research_result", { news, question });

    emit("research_status", { message: "正在生成多元视角的讨论角色..." });

    const roleCount = disc.role_count || 4;
    let rolesResult = "";
    if (onEvent) {
      const stream = await sendPromptStream(modSession, GENERATE_ROLES_PROMPT(disc.topic, question, news, roleCount), (delta) => {
        emit("roles_delta", { delta });
      }, undefined, (rDelta) => {
        emit("thinking_delta", { delta: rDelta });
      }, moderatorModel);
      rolesResult = stream.text;
    } else {
      const result = await sendPrompt(modSession, GENERATE_ROLES_PROMPT(disc.topic, question, news, roleCount), undefined, moderatorModel);
      rolesResult = result.text;
    }

    let roles: any[] = [];
    try {
      // Layer 1: try extracting from ```json ... ``` code block
      let jsonText = rolesResult.match(/```(?:json)?\s*([\[][\s\S]*?[\]][\s\S]*?)\s*```/)?.[1];
      // Layer 2: try plain JSON array anywhere in text
      if (!jsonText) jsonText = rolesResult.match(/\[[\s\S]*\]/)?.[0];
      // Layer 2.5: try fixing truncated JSON array (missing closing brackets)
      if (!jsonText) {
        const bracketIdx = rolesResult.indexOf("[");
        if (bracketIdx >= 0) {
          let partial = rolesResult.slice(bracketIdx);
          const lastBrace = partial.lastIndexOf("}");
          const cutPoint = lastBrace > 0 ? lastBrace + 1 : partial.length;
          partial = fixJsonQuotes(partial.slice(0, cutPoint));
          for (const suffix of ["]", "}]"]) {
            try {
              roles = JSON.parse(partial + suffix);
              break;
            } catch {}
          }
        }
      }
      // Layer 3: try line-by-line parsing for name/role/stance patterns
      if (roles.length === 0 && jsonText) {
        roles = JSON.parse(fixJsonQuotes(jsonText));
      } else if (roles.length === 0) {
        const lines = rolesResult.split("\n");
        for (const line of lines) {
          const nameMatch = line.match(/(?:姓名|name|名字)[：:]\s*(.+)/i);
          const roleMatch = line.match(/(?:角色|身份|role|背景)[：:]\s*(.+)/i);
          const stanceMatch = line.match(/(?:观点|立场|stance)[：:]\s*(.+)/i);
          if (nameMatch) {
            roles.push({
              name: nameMatch[1].trim(),
              role: roleMatch?.[1]?.trim() || "",
              stance: stanceMatch?.[1]?.trim() || "",
            });
          }
        }
      }
    } catch (e) {
      console.error("Role parsing failed, raw result (first 500 chars):", rolesResult?.slice(0, 500), e);
    }

    // Fallback: retry role generation with non-streaming sendPrompt if streaming returned incomplete text
    if (roles.length === 0 && onEvent) {
      emit("research_status", { message: "正在重试角色生成..." });
      const retryResult = await sendPrompt(modSession, GENERATE_ROLES_PROMPT(disc.topic, question, news, roleCount), undefined, moderatorModel);
      try {
        let jsonText = retryResult.text.match(/```(?:json)?\s*([\[][\s\S]*?[\]][\s\S]*?)\s*```/)?.[1];
        if (!jsonText) jsonText = retryResult.text.match(/\[[\s\S]*\]/)?.[0];
        if (!jsonText) {
          const bracketIdx = retryResult.text.indexOf("[");
          if (bracketIdx >= 0) {
            let partial = retryResult.text.slice(bracketIdx);
            const lastBrace = partial.lastIndexOf("}");
            const cutPoint = lastBrace > 0 ? lastBrace + 1 : partial.length;
            partial = fixJsonQuotes(partial.slice(0, cutPoint));
            for (const suffix of ["]", "}]"]) {
              try { roles = JSON.parse(partial + suffix); break; } catch {}
            }
            jsonText = roles.length > 0 ? "ok" : undefined;
          }
        }
        if (roles.length === 0 && jsonText) {
          roles = JSON.parse(fixJsonQuotes(jsonText));
        }
      } catch {}
    }

    updateDiscussion(discussionId, { question, news_summary: news, title: question });

    emit("research_done", { news, question, roles });

    for (let i = 0; i < roles.length; i++) {
      const r = roles[i];
      try {
        addParticipant(discussionId, {
          name: r.name || `角色${i + 1}`,
          role_prompt: `${r.role || ""}，${r.stance || ""}`,
          color: COLORS[i % COLORS.length],
          type: "ai",
          sort_order: i + 1,
        });
      } catch {}
    }

    updateDiscussion(discussionId, { status: "ready" });
    return { news, question, roles };
  }

  async confirm(discussionId: number, customizations?: { rounds?: number; addParticipants?: any[]; includeUser?: boolean; userName?: string; moderatorModel?: string; participantModels?: Record<number, string> }) {
    const disc = getDiscussion(discussionId);
    if (!disc) throw new Error("讨论不存在");

    if (customizations?.rounds) {
      updateDiscussion(discussionId, { total_rounds: customizations.rounds });
    }

    if (customizations?.moderatorModel) {
      updateDiscussion(discussionId, { moderator_model: customizations.moderatorModel });
    }

    if (customizations?.addParticipants) {
      const existing = listParticipants(discussionId);
      let order = existing.length;
      for (const p of customizations.addParticipants) {
        order++;
        addParticipant(discussionId, {
          name: p.name,
          role_prompt: p.role_prompt || p.role || "",
          color: p.color || COLORS[order % COLORS.length],
          type: "ai",
          sort_order: order,
        });
      }
    }

    if (customizations?.includeUser) {
      const existing = listParticipants(discussionId);
      addParticipant(discussionId, {
        name: customizations.userName || "我",
        role_prompt: "讨论参与者",
        color: "#666666",
        type: "user",
        sort_order: existing.length + 1,
      });
    }

    if (customizations?.participantModels) {
      for (const [pid, modelJson] of Object.entries(customizations.participantModels)) {
        updateParticipant(parseInt(pid), { model_config: modelJson });
      }
    }
  }

  async startDiscussion(
    discussionId: number,
    onEvent: (event: string, data: any) => void
  ): Promise<void> {
    const disc = getDiscussion(discussionId);
    if (!disc) throw new Error("讨论不存在");

    updateDiscussion(discussionId, { status: "active" });
    const modSession = disc.moderator_session_id || await createSession();
    if (!disc.moderator_session_id) {
      updateDiscussion(discussionId, { moderator_session_id: modSession });
    }

    const participants = listParticipants(discussionId);
    const sessionCache: Record<number, string> = {};

    for (const p of participants) {
      if (p.type === "ai" && !p.session_id) {
        const sid = await createSession();
        updateParticipant(p.id, { session_id: sid });
        sessionCache[p.id] = sid;
      } else if (p.session_id) {
        sessionCache[p.id] = p.session_id;
      }
    }

    const totalSpeeches = disc.total_rounds;
    const speechLog: { participantId: number; name: string; content: string }[] = [];
    const lastSpeechPos: Map<number, number> = new Map();
    const recentSpeakers: { id: number; name: string }[] = [];

    const moderatorModel = getModeratorModel(disc);

    for (let speechIndex = 1; speechIndex <= totalSpeeches; speechIndex++) {
      updateDiscussion(discussionId, { current_round: speechIndex });
      onEvent("round_start", { round: speechIndex });

      const currentDisc = getDiscussion(discussionId);
      if (currentDisc?.status !== "active") break;

      const currentParticipants = listParticipants(discussionId);
      const activeParticipants = currentParticipants.filter((p: any) => p.status === "active");
      if (activeParticipants.length === 0) break;

      const userRaised = currentParticipants.find((p: any) => p.type === "user" && p.wants_to_speak);
      const userName = userRaised?.name || "用户";
      const lastSpeech = speechLog.length > 0
        ? `${speechLog[speechLog.length - 1].name}：${speechLog[speechLog.length - 1].content}`
        : null;

      const decision = await sendPrompt(
        modSession,
        WHO_NEXT_PROMPT(
          currentDisc.question, speechIndex, totalSpeeches,
          currentParticipants, recentSpeakers.slice(-6),
          lastSpeech, !!userRaised, userName
        ),
        undefined,
        moderatorModel
      );

      const trimmed = decision.text.trim();

      if (userRaised && (trimmed.includes("user") || trimmed === String(userRaised.id))) {
        onEvent("user_speech_ready", { participant_id: userRaised.id, round: speechIndex });
        const waitUntil = Date.now() + 300000;
        while (Date.now() < waitUntil) {
          const p = getParticipant(userRaised.id);
          if (!p?.wants_to_speak) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        const userMsgs = listMessages(discussionId).filter((m: any) => m.participant_id === userRaised.id);
        const latestUserMsg = userMsgs[userMsgs.length - 1];
        if (latestUserMsg?.content) {
          speechLog.push({ participantId: userRaised.id, name: userRaised.name, content: latestUserMsg.content });
          lastSpeechPos.set(userRaised.id, speechLog.length - 1);
        }
        recentSpeakers.push({ id: userRaised.id, name: userRaised.name });
        if (recentSpeakers.length > 10) recentSpeakers.shift();
        continue;
      }

      const num = parseInt(trimmed.match(/\d+/)?.[0] || "0");
      const speaker = num
        ? currentParticipants.find((p: any) => p.id === num && p.type === "ai")
        : activeParticipants[0];
      if (!speaker || speaker.type !== "ai") continue;

      onEvent("participant_invited", { participant_id: speaker.id, name: speaker.name, color: speaker.color, round: speechIndex });

      const sessionId = sessionCache[speaker.id];
      if (!sessionId) continue;

      // Compute gap messages for this participant
      const prevPos = lastSpeechPos.get(speaker.id);
      const gapStart = prevPos !== undefined ? prevPos + 1 : 0;
      const gapMessages = speechLog.slice(gapStart)
        .map(s => `${s.name}：${s.content}`)
        .join("\n\n");

      let speech = "";
      let speechReasoning = "";
      const isFirstSpeaker = speechLog.length === 0;
      const speechPrompt = SPEAKER_PROMPT(speaker.name, speaker.role_prompt, currentDisc.question, gapMessages, isFirstSpeaker);
      const participantModel = getParticipantModel(speaker, totalSpeeches, speechIndex);

      const streamResult = await sendPromptStream(sessionId, speechPrompt, (delta) => {
        onEvent("speech_delta", { participant_id: speaker.id, delta });
      }, undefined, (rDelta) => {
        onEvent("thinking_delta", { participant_id: speaker.id, delta: rDelta });
      }, participantModel);
      speech = streamResult.text;
      speechReasoning = streamResult.reasoning;

      onEvent("speech_complete", { participant_id: speaker.id, text: speech, reasoning: speechReasoning, round: speechIndex, model_name: getModelDisplayName(participantModel) });

      addMessage(discussionId, {
        participant_id: speaker.id,
        round: speechIndex,
        content: speech,
        reasoning: speechReasoning,
        type: "ai",
        model_name: getModelDisplayName(participantModel),
      });

      speechLog.push({ participantId: speaker.id, name: speaker.name, content: speech });
      lastSpeechPos.set(speaker.id, speechLog.length - 1);
      recentSpeakers.push({ id: speaker.id, name: speaker.name });
      if (recentSpeakers.length > 10) recentSpeakers.shift();
    }

    const currentDisc3 = getDiscussion(discussionId);
    if (currentDisc3?.status === "active") {
      const summaryModel = getModeratorModel(currentDisc3);
      const userP = participants.find((p: any) => p.type === "user");
      const hasUserSpoken = userP ? speechLog.some(s => s.participantId === userP.id) : false;
      const summaryUserNote = userP && !hasUserSpoken
        ? `\n注意：用户「${userP.name}」虽然参与了讨论但未发言，总结中不要为该用户编造观点。`
        : "";
      const lastSummarySpeech = speechLog.length > 0
        ? `${speechLog[speechLog.length - 1].name}：${speechLog[speechLog.length - 1].content}`
        : null;
      onEvent("generating_summary", {});
      const summaryResult = await sendPrompt(modSession, SUMMARY_PROMPT(currentDisc3.question, summaryUserNote, lastSummarySpeech), undefined, summaryModel);
      addMessage(discussionId, {
        participant_id: null,
        round: currentDisc3.current_round,
        content: summaryResult.text,
        type: "summary",
        model_name: getModelDisplayName(summaryModel),
      });
      onEvent("summary", { text: summaryResult.text, model_name: getModelDisplayName(summaryModel) });
    }

    updateDiscussion(discussionId, { status: "completed" });
    onEvent("discussion_end", {});
  }

  async submitUserSpeech(discussionId: number, content: string): Promise<void> {
    const disc = getDiscussion(discussionId);
    if (!disc) throw new Error("讨论不存在");

    const userP = listParticipants(discussionId).find((p: any) => p.type === "user" && p.wants_to_speak);
    if (!userP) throw new Error("没有举手");

    addMessage(discussionId, {
      participant_id: userP.id,
      round: disc.current_round,
      content,
      type: "user",
    });

    updateParticipant(userP.id, { wants_to_speak: 0 });
  }

  raiseHand(discussionId: number, participantId: number): void {
    updateParticipant(participantId, { wants_to_speak: 1 });
  }

  cancelRaiseHand(participantId: number): void {
    updateParticipant(participantId, { wants_to_speak: 0 });
  }

  stopDiscussion(discussionId: number): void {
    updateDiscussion(discussionId, { status: "completed" });
  }

  addRounds(discussionId: number, count: number): void {
    const disc = getDiscussion(discussionId);
    if (!disc) throw new Error("讨论不存在");
    updateDiscussion(discussionId, { total_rounds: disc.total_rounds + count });
  }

  async generateSummary(
    discussionId: number,
    onEvent: (event: string, data: any) => void
  ): Promise<void> {
    const disc = getDiscussion(discussionId);
    if (!disc) throw new Error("讨论不存在");

    const moderatorModel = getModeratorModel(disc);
    let modSession = disc.moderator_session_id;
    const allMessages = listMessages(discussionId);
    const allParticipants = listParticipants(discussionId);
    const userParticipant = allParticipants.find((p: any) => p.type === "user");
    const speechMessages = allMessages.filter((m: any) => m.type !== "summary" && m.content.trim());
    const hasUserSpeech = userParticipant
      ? speechMessages.some((m: any) => m.participant_id === userParticipant.id)
      : false;
    const transcript = speechMessages.map((m: any) => {
      const p = m.participant_id
        ? allParticipants.find((pp: any) => pp.id === m.participant_id)
        : null;
      const name = p?.name || (m.type === "user" ? "用户" : "主持人");
      return `${name}：${m.content}`;
    }).join("\n\n");

    const userNote = userParticipant
      ? (hasUserSpeech
        ? ""
        : `\n注意：用户「${userParticipant.name}」虽然参与了讨论但未发言，总结中不要为该用户编造观点，只需总结已发言者的内容。`)
      : "";

    const prompt = `讨论问题：${disc.question || disc.topic}

以下是本次讨论的所有发言：

${transcript}
${userNote}
请根据以上发言，生成一份讨论总结。

要求：
- 使用纯 Markdown 格式输出，不要使用 JSON
- 用二级标题 ## 分隔各部分
- 列表使用 - 符号

格式如下：
## 各方核心观点
（每人1-2句，仅总结实际发言的参与者）

## 主要共识
（列出2-4点）

## 主要分歧
（列出2-4点）

## 总结性评论
（一段总结）`;

    if (!modSession) {
      modSession = await createSession();
    }

    const streamResult = await sendPromptStream(modSession, prompt, (delta) => {
      onEvent("summary_delta", { delta });
    }, undefined, (rDelta) => {
      onEvent("thinking_delta", { delta: rDelta });
    }, moderatorModel);

    addMessage(discussionId, {
      participant_id: null,
      round: disc.current_round,
      content: streamResult.text,
      reasoning: streamResult.reasoning,
      type: "summary",
      model_name: getModelDisplayName(moderatorModel),
    });

    onEvent("summary_done", {
      text: streamResult.text,
      reasoning: streamResult.reasoning,
      model_name: getModelDisplayName(moderatorModel),
    });
  }
}

export const coordinator = new DiscussionCoordinator();
