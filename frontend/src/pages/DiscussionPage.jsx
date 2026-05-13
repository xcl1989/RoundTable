import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Layout,
  Typography,
  Button,
  Space,
  Avatar,
  Tag,
  Input,
  Spin,
  message,
  Drawer,
  List,
  Divider,
} from "antd";
import {
  SendOutlined,
  FlagOutlined,
  StopOutlined,
  HomeOutlined,
  PlusOutlined,
  UserOutlined,
  MenuOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import * as api from "../api.js";
import ThinkingText from "../components/ThinkingText.jsx";
import RoundTable from "../components/RoundTable.jsx";

const { Title, Text } = Typography;
const { TextArea } = Input;

function SpeechBubble({ msg, participant }) {
  const isUser = participant?.type === "user";
  const isSummary = msg.type === "summary";
  const bubbleColor = participant?.color || "#8B6914";

  if (isSummary) {
    return (
      <div style={{ marginBottom: 20, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 1, background: "linear-gradient(90deg, transparent, #C9A951)" }} />
            <Text strong style={{ fontSize: 12, color: "#C9A951", letterSpacing: 3 }}>
              ROUNDTABLE SUMMARY
            </Text>
            <div style={{ width: 40, height: 1, background: "linear-gradient(90deg, #C9A951, transparent)" }} />
          </div>
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, #2A1F10 0%, #3D2E1F 50%, #2A1F10 100%)",
            color: "#F5F0E8",
            padding: "22px 28px",
            borderRadius: 16,
            fontSize: 14,
            lineHeight: 1.8,
            boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,169,81,0.1)",
            border: "1px solid rgba(201,169,81,0.15)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 18,
              top: 10,
              fontSize: 44,
              opacity: 0.08,
              color: "#C9A951",
              fontFamily: "Georgia, serif",
              lineHeight: 1,
            }}
          >
            &ldquo;
          </div>
          <ThinkingText reasoning={msg.reasoning} content={msg.content} isSummary dark />
          {msg.model_name && (
            <div style={{ textAlign: "right", marginTop: 8, fontSize: 11, opacity: 0.35 }}>
              {msg.model_name}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        marginBottom: 14,
        padding: "0 20px",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <Avatar
        size={36}
        style={{
          backgroundColor: isUser ? "#8D6E63" : bubbleColor,
          flexShrink: 0,
          fontSize: 14,
          fontWeight: 700,
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          border: "2px solid rgba(255,255,255,0.15)",
        }}
      >
        {isUser ? "我" : participant?.name?.[0] || "?"}
      </Avatar>

      <div
        style={{
          maxWidth: "66%",
          marginLeft: isUser ? 0 : 10,
          marginRight: isUser ? 10 : 0,
        }}
      >
        <div
          style={{
            marginBottom: 4,
            fontSize: 12,
            color: isUser ? "#C9A951" : bubbleColor,
            fontWeight: 600,
            textAlign: isUser ? "right" : "left",
            letterSpacing: 0.5,
            textShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        >
          {participant?.name || "?"}
        </div>
        <div
          style={{
            background: isUser
              ? "linear-gradient(135deg, rgba(141,110,99,0.9), rgba(109,76,65,0.85))"
              : "rgba(255,253,247,0.08)",
            color: isUser ? "#FFF8E7" : "#E8DDD0",
            padding: "12px 16px",
            borderRadius: isUser ? "14px 6px 14px 14px" : "6px 14px 14px 14px",
            fontSize: 14,
            lineHeight: 1.7,
            boxShadow: isUser
              ? "0 3px 12px rgba(141,110,99,0.15)"
              : "0 2px 8px rgba(0,0,0,0.15)",
            borderLeft: isUser ? "none" : `3px solid ${bubbleColor}`,
            borderRight: isUser ? `3px solid rgba(201,169,81,0.3)` : "none",
            backdropFilter: isUser ? "none" : "blur(8px)",
            border: isUser ? "none" : "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <ThinkingText reasoning={msg.reasoning} content={msg.content} dark />
          {msg.model_name && (
            <div style={{ textAlign: "right", marginTop: 6, fontSize: 10, opacity: 0.35, letterSpacing: 0.5 }}>
              {msg.model_name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscussionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  const [discussion, setDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [streamingText, setStreamingText] = useState({});
  const [streamingThinking, setStreamingThinking] = useState({});
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [summaryStreamingText, setSummaryStreamingText] = useState("");
  const [summaryStreamingThinking, setSummaryStreamingThinking] = useState("");
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const sseRef = useRef(false);
  const pollTimerRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => { loadDiscussion(); }, [id]);
  useEffect(() => { scrollToBottom(); }, [messages, streamingText, streamingThinking]);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    if (discussion?.status === "active" && !sseRef.current) {
      pollTimerRef.current = setInterval(async () => {
        try {
          const data = await api.getDiscussion(id);
          setDiscussion(data);
          setMessages(data.messages || []);
          setParticipants(data.participants || []);
          if (data.status !== "active") {
            setStarting(false);
            if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
          }
        } catch {}
      }, 3000);
    }
    return () => {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    };
  }, [discussion?.status, id]);

  async function loadDiscussion() {
    try {
      const data = await api.getDiscussion(id);
      setDiscussion(data);
      setMessages(data.messages || []);
      setParticipants(data.participants || []);
      const userP = (data.participants || []).find((p) => p.type === "user");
      if (userP?.wants_to_speak) setHandRaised(true);
      if (data.status === "active") setStarting(true);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function listenSSE() {
    sseRef.current = true;
    try {
      await api.startDiscussion(id, (event, data) => handleEvent(event, data));
    } catch (e) {
      console.error("SSE error:", e);
    } finally {
      sseRef.current = false;
      message.destroy("summary_loading");
      setStarting(false);
    }
  }

  function handleEvent(event, data) {
    switch (event) {
      case "round_start":
        reloadDiscussion();
        break;
      case "participant_invited":
        setCurrentSpeaker(data);
        setStreamingText((prev) => ({ ...prev, [data.participant_id]: "" }));
        setStreamingThinking((prev) => ({ ...prev, [data.participant_id]: "" }));
        break;
      case "speech_delta":
        setStreamingText((prev) => ({
          ...prev,
          [data.participant_id]: (prev[data.participant_id] || "") + data.delta,
        }));
        break;
      case "thinking_delta":
        setStreamingThinking((prev) => ({
          ...prev,
          [data.participant_id]: (prev[data.participant_id] || "") + data.delta,
        }));
        break;
      case "speech_complete":
        setStreamingText((prev) => { const n = { ...prev }; delete n[data.participant_id]; return n; });
        setStreamingThinking((prev) => { const n = { ...prev }; delete n[data.participant_id]; return n; });
        setCurrentSpeaker(null);
        setMessages((prev) => [...prev, { ...data, content: data.text || data.content, reasoning: data.reasoning || "", model_name: data.model_name || "" }]);
        reloadParticipants();
        break;
      case "user_speech_ready":
        setWaitingForUser(true);
        setHandRaised(false);
        setTimeout(() => inputRef.current?.focus(), 200);
        break;
      case "generating_summary":
        message.destroy("summary_loading");
        message.loading({ content: "正在生成讨论总结...", key: "summary_loading", duration: 0 });
        break;
      case "summary":
        message.destroy("summary_loading");
        setMessages((prev) => [...prev, { ...data, content: data.text || data.content, reasoning: data.reasoning || "", model_name: data.model_name || "", type: "summary" }]);
        break;
      case "discussion_end":
        message.destroy("summary_loading");
        setStarting(false);
        setCurrentSpeaker(null);
        message.success("圆桌讨论结束");
        reloadParticipants();
        break;
      case "error":
        message.error(data.message);
        break;
    }
  }

  async function reloadDiscussion() {
    const data = await api.getDiscussion(id);
    setDiscussion(data);
    setMessages(data.messages || []);
    setParticipants(data.participants || []);
  }

  async function reloadParticipants() {
    const data = await api.getDiscussion(id);
    setParticipants(data.participants || []);
  }

  async function handleStart() {
    setStarting(true);
    listenSSE();
  }

  async function handleRaiseHand() {
    const userP = participants.find((p) => p.type === "user");
    if (!userP) return;
    if (handRaised) {
      await api.cancelHand(id, userP.id);
      setHandRaised(false);
    } else {
      await api.raiseHand(id, userP.id);
      setHandRaised(true);
      message.success("已举手，等待主持人安排发言");
    }
  }

  async function handleSendSpeech() {
    if (!userInput.trim()) return;
    await api.submitSpeech(id, userInput);
    setMessages((prev) => [...prev, {
      participant_id: participants.find((p) => p.type === "user")?.id,
      round: discussion.current_round,
      content: userInput,
      type: "user",
    }]);
    setUserInput("");
    setWaitingForUser(false);
  }

  async function handleStop() {
    await api.stopDiscussion(id);
    setStarting(false);
    reloadDiscussion();
  }

  async function handleGenerateSummary() {
    setSummaryGenerating(true);
    setSummaryStreamingText("");
    setSummaryStreamingThinking("");
    try {
      await api.generateSummary(id, (event, data) => {
        switch (event) {
          case "summary_delta":
            setSummaryStreamingText((prev) => prev + data.delta);
            break;
          case "thinking_delta":
            setSummaryStreamingThinking((prev) => prev + data.delta);
            break;
          case "summary_done":
            setSummaryStreamingText("");
            setSummaryStreamingThinking("");
            setMessages((prev) => [...prev, {
              content: data.text,
              reasoning: data.reasoning || "",
              type: "summary",
              model_name: data.model_name || "",
            }]);
            break;
          case "error":
            message.error(data.message);
            break;
        }
      });
    } catch (e) {
      message.error(e.message);
    } finally {
      setSummaryGenerating(false);
    }
  }

  if (loading) return <Spin style={{ display: "block", margin: "100px auto" }} size="large" />;

  return (
    <Layout style={{ minHeight: "100vh", background: "#1A1612" }}>
      <Layout.Header
        style={{
          background: "linear-gradient(180deg, #2A1810 0%, #3E2723 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          height: mobile ? 46 : 52,
          lineHeight: mobile ? "46px" : "52px",
          boxShadow: "0 3px 16px rgba(0,0,0,0.25)",
          borderBottom: "1px solid rgba(201,169,81,0.2)",
        }}
      >
        <Space>
          <Button icon={<HomeOutlined />} type="text" size="small" style={{ color: "#C9A951" }} onClick={() => navigate("/")} />
          <Text
            strong
            style={{
              color: "#F5F0E8",
              fontSize: mobile ? 13 : 15,
              letterSpacing: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: mobile ? "42vw" : "50vw",
              display: "inline-block",
            }}
            title={discussion?.title || discussion?.topic}
          >
            {discussion?.title || discussion?.topic || "圆桌讨论"}
          </Text>
        </Space>
        <Space size={8}>
          {discussion?.status !== "completed" && (
            <>
              {!starting ? (
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={handleStart}
                  style={{
                    background: "linear-gradient(135deg, #C9A951, #8B6914)",
                    borderColor: "#8B6914",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  开始
                </Button>
              ) : (
                <Button danger size="small" icon={<StopOutlined />} onClick={handleStop} style={{ fontSize: 13 }}>
                  结束
                </Button>
              )}
            </>
          )}
          {starting && participants.some((p) => p.type === "user") && (
            <Button
              size="small"
              type={handRaised ? "default" : "primary"}
              icon={<FlagOutlined />}
              onClick={handleRaiseHand}
              ghost={!handRaised}
              style={!handRaised ? {
                background: "linear-gradient(135deg, #C9A951, #8B6914)",
                borderColor: "#8B6914",
                fontWeight: 600,
                fontSize: 13,
                color: "#fff",
              } : { fontSize: 13 }}
            >
              {handRaised ? "取消" : "举手"}
            </Button>
          )}
          <Button icon={<MenuOutlined />} type="text" size="small" style={{ color: "#C9A951" }} onClick={() => setDrawerOpen(true)} />
        </Space>
      </Layout.Header>

      <Layout.Content style={{ display: "flex", flexDirection: "column", height: `calc(100vh - ${mobile ? 46 : 52}px)` }}>
        {discussion?.status === "active" && (
          <div
            style={{
              background: "linear-gradient(180deg, #2A2218 0%, #1E1810 60%, #1A1612 100%)",
              borderBottom: "1px solid rgba(201,169,81,0.1)",
              padding: mobile ? "8px 0 4px" : "16px 0 10px",
              textAlign: "center",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              position: "relative",
              zIndex: 2,
            }}
          >
            <RoundTable
              participants={participants}
              currentSpeakerId={currentSpeaker?.participant_id || null}
              waitingForUser={waitingForUser}
              handRaised={handRaised}
              round={discussion.current_round}
              totalRounds={discussion.total_rounds}
              onRoundTableClick={() => setDrawerOpen(true)}
            />
          </div>
        )}

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 0 8px",
            background: "linear-gradient(180deg, #1E1810 0%, #1A1612 30%, #161210 100%)",
          }}
        >
          {messages.map((msg, i) => {
            const p = participants.find((pp) => pp.id === msg.participant_id);
            return <SpeechBubble key={msg.id || i} msg={msg} participant={p} />;
          })}

          {currentSpeaker &&
            (streamingText[currentSpeaker.participant_id] || streamingThinking[currentSpeaker.participant_id]) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  marginBottom: 14,
                  padding: "0 20px",
                }}
              >
                <Avatar
                  size={36}
                  style={{
                    backgroundColor: currentSpeaker.color,
                    flexShrink: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                    border: "2px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {currentSpeaker.name?.[0]}
                </Avatar>
                <div style={{ marginLeft: 10, maxWidth: "66%" }}>
                  <div
                    style={{
                      marginBottom: 4,
                      fontSize: 12,
                      color: currentSpeaker.color,
                      fontWeight: 600,
                      textShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  >
                    {currentSpeaker.name}
                  </div>
                  <div
                    style={{
                      background: "rgba(255,253,247,0.08)",
                      padding: "12px 16px",
                      borderRadius: "6px 14px 14px 14px",
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "#E8DDD0",
                      borderLeft: `3px solid ${currentSpeaker.color}`,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <ThinkingText
                      reasoning={streamingThinking[currentSpeaker.participant_id] || ""}
                      content={streamingText[currentSpeaker.participant_id] || ""}
                      dark
                    />
                    <Spin size="small" style={{ marginLeft: 4 }} />
                  </div>
                </div>
              </div>
            )}

          {discussion?.status === "completed" && !starting && messages.length === 0 && (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>⬤</div>
              <Title level={4} style={{ color: "#C9A951", fontWeight: 300, letterSpacing: 2 }}>
                讨论已结束
              </Title>
            </div>
          )}

          {discussion?.status === "completed" && !starting && messages.length > 0 && !messages.some((m) => m.type === "summary") && !summaryGenerating && (
            <div style={{ textAlign: "center", padding: "24px 20px" }}>
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                onClick={handleGenerateSummary}
                style={{
                  background: "linear-gradient(135deg, #C9A951, #8B6914)",
                  borderColor: "#8B6914",
                  fontWeight: 600,
                  height: 44,
                  padding: "0 32px",
                }}
              >
                生成讨论总结
              </Button>
            </div>
          )}

          {summaryGenerating && (
            <div style={{ marginBottom: 20, padding: "0 24px" }}>
              <div style={{ textAlign: "center", marginBottom: 10 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 1, background: "linear-gradient(90deg, transparent, #C9A951)" }} />
                  <Text strong style={{ fontSize: 12, color: "#C9A951", letterSpacing: 3 }}>
                    GENERATING SUMMARY
                  </Text>
                  <div style={{ width: 40, height: 1, background: "linear-gradient(90deg, #C9A951, transparent)" }} />
                </div>
              </div>
              <div
                style={{
                  background: "linear-gradient(135deg, #2A1F10 0%, #3D2E1F 50%, #2A1F10 100%)",
                  padding: "22px 28px",
                  borderRadius: 16,
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: "#F5F0E8",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,169,81,0.1)",
                  border: "1px solid rgba(201,169,81,0.15)",
                }}
              >
                <ThinkingText reasoning={summaryStreamingThinking} content={summaryStreamingText} dark />
                <Spin size="small" style={{ marginLeft: 4 }} />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {waitingForUser && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(26,22,18,0.95)",
              borderTop: "1px solid rgba(201,169,81,0.2)",
              display: "flex",
              gap: 8,
              backdropFilter: "blur(12px)",
            }}
          >
            <TextArea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入你的发言..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{
                background: "rgba(255,253,247,0.06)",
                borderColor: "rgba(201,169,81,0.2)",
                color: "#E8DDD0",
              }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSendSpeech();
                }
              }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendSpeech}
              style={{
                background: "linear-gradient(135deg, #C9A951, #8B6914)",
                borderColor: "#8B6914",
                fontWeight: 600,
                height: "auto",
              }}
            >
              发言
            </Button>
          </div>
        )}
      </Layout.Content>

      <Drawer
        title={
          <span style={{ color: "#C9A951", letterSpacing: 2, fontSize: 13 }}>ROUNDTABLE MEMBERS</span>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={340}
        styles={{
          body: { background: "#1E1810" },
          header: { background: "#2A2218", borderBottom: "1px solid rgba(201,169,81,0.15)" },
          mask: { background: "rgba(0,0,0,0.6)" },
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <RoundTable
            participants={participants}
            currentSpeakerId={currentSpeaker?.participant_id || null}
            handRaised={handRaised}
            round={discussion?.current_round || 0}
            totalRounds={discussion?.total_rounds || 0}
          />
        </div>
        <Divider style={{ borderColor: "rgba(201,169,81,0.1)", margin: "12px 0" }} />
        <Title level={5} style={{ color: "#C9A951", fontSize: 13, letterSpacing: 1 }}>与会嘉宾</Title>
        <List
          dataSource={participants}
          renderItem={(p) => (
            <List.Item style={{ borderBottom: "1px solid rgba(201,169,81,0.08)" }}>
              <List.Item.Meta
                avatar={
                  <div style={{ position: "relative" }}>
                    <Avatar
                      style={{
                        backgroundColor: p.color,
                        boxShadow: currentSpeaker?.participant_id === p.id
                          ? "0 0 12px rgba(201,169,81,0.5)"
                          : "0 2px 6px rgba(0,0,0,0.3)",
                        border: "2px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {p.name[0]}
                    </Avatar>
                    {currentSpeaker?.participant_id === p.id && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "#C9A951",
                          boxShadow: "0 0 8px rgba(201,169,81,0.6)",
                        }}
                      />
                    )}
                  </div>
                }
                title={
                  <Space>
                    <span style={{ color: "#E8DDD0" }}>{p.name}</span>
                    {p.type === "user" && <Tag color="gold">你</Tag>}
                    {p.type === "ai" && <Tag color="orange">嘉宾</Tag>}
                  </Space>
                }
                description={<span style={{ color: "#8B7355" }}>{p.role_prompt}</span>}
              />
            </List.Item>
          )}
          style={{ marginBottom: 16 }}
        />

        <Divider style={{ borderColor: "rgba(201,169,81,0.1)", margin: "12px 0" }} />
        <Title level={5} style={{ color: "#C9A951", fontSize: 13, letterSpacing: 1 }}>会议控制</Title>
        <Space direction="vertical" style={{ width: "100%" }}>
          {starting && (
            <Button
              block
              icon={<PlusOutlined />}
              onClick={async () => {
                await api.addRounds(id, 1);
                reloadDiscussion();
                message.success("已追加 1 次发言");
              }}
              style={{
                background: "rgba(201,169,81,0.08)",
                borderColor: "rgba(201,169,81,0.3)",
                color: "#C9A951",
              }}
            >
              追加 1 次发言
            </Button>
          )}
          {!starting && messages.length > 0 && (
            <Button
              block
              icon={<DownloadOutlined />}
              onClick={async () => {
                try {
                  await api.exportDiscussion(id);
                  message.success("导出成功");
                } catch (e) {
                  message.error(e.message);
                }
              }}
              style={{
                background: "rgba(201,169,81,0.08)",
                borderColor: "rgba(201,169,81,0.3)",
                color: "#C9A951",
              }}
            >
              导出 Word 文档
            </Button>
          )}
          <Button block onClick={() => navigate("/")} style={{ color: "#8B7355", background: "transparent" }}>
            返回首页
          </Button>
        </Space>
      </Drawer>
    </Layout>
  );
}
