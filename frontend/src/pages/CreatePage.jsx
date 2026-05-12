import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layout,
  Input,
  Button,
  Card,
  Typography,
  Steps,
  Space,
  Spin,
  Tag,
  Slider,
  Switch,
  List,
  message,
  Row,
  Col,
  Avatar,
  Select,
} from "antd";
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import {
  createDiscussion,
  getDiscussion,
  researchDiscussion,
  confirmDiscussion,
  listDiscussions,
  getModels,
} from "../api.js";
import ThinkingText from "../components/ThinkingText.jsx";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

export default function CreatePage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [discussion, setDiscussion] = useState(null);
  const [research, setResearch] = useState(null);
  const [rounds, setRounds] = useState(10);
  const [includeUser, setIncludeUser] = useState(true);
  const [userName, setUserName] = useState("我");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [researchStatus, setResearchStatus] = useState("");
  const [researchLog, setResearchLog] = useState("");
  const [researchThinking, setResearchThinking] = useState("");
  const [models, setModels] = useState([]);
  const [moderatorModel, setModeratorModel] = useState(null);
  const [participantModels, setParticipantModels] = useState({});
  const [roleCount, setRoleCount] = useState(4);

  useState(() => {
    getModels().then(setModels).catch(() => {});
  });

  useState(() => {
    listDiscussions().then(setHistory).catch(() => {});
  });

  const handleResearch = async () => {
    if (!topic.trim()) return message.warning("请输入讨论话题");
    setLoading(true);
    setResearchLog("");
    setResearchStatus("");
    setResearchThinking("");
    let discId = null;
    try {
      const disc = await createDiscussion(topic, "roundtable", 10, roleCount);
      discId = disc.id;
      setDiscussion(disc);
      setStep(1);
      await researchDiscussion(disc.id, (event, data) => {
        switch (event) {
          case "research_status":
            setResearchStatus(data.message);
            break;
          case "research_delta":
            setResearchLog((prev) => prev + data.delta);
            break;
          case "thinking_delta":
            setResearchThinking((prev) => prev + data.delta);
            break;
          case "research_result":
            setResearch((prev) => ({ ...prev, news: data.news, question: data.question }));
            setResearchLog((prev) => prev + "\n\n---\n\n");
            break;
          case "roles_delta":
            setResearchLog((prev) => prev + data.delta);
            break;
          case "research_done":
            setResearch({ news: data.news, question: data.question, roles: data.roles });
            break;
          case "error":
            message.error(data.message);
            break;
        }
      });
    } catch (e) {
      message.error(e.message);
    } finally {
      if (discId) {
        try {
          const updated = await getDiscussion(discId);
          setDiscussion(updated);
          if (updated.question || updated.news_summary) {
            setResearch((prev) => ({
              ...prev,
              news: updated.news_summary || prev.news,
              question: updated.question || prev.question,
            }));
            setStep(2);
          }
        } catch {}
      }
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const opts = { rounds, includeUser, userName: includeUser ? userName : undefined };
      if (moderatorModel) opts.moderatorModel = JSON.stringify(moderatorModel);
      const pmEntries = Object.entries(participantModels).filter(([_, v]) => v);
      if (pmEntries.length > 0) {
        opts.participantModels = {};
        for (const [pid, mc] of pmEntries) {
          opts.participantModels[pid] = JSON.stringify(mc);
        }
      }
      const res = await confirmDiscussion(discussion.id, opts);
      setDiscussion(res);
      setStep(3);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    navigate(`/discussion/${discussion.id}`);
  };

  const modelOptions = (() => {
    const grouped = {};
    for (const m of models) {
      const key = m.provider;
      if (!grouped[key]) grouped[key] = { label: m.provider, options: [] };
      grouped[key].options.push({
        value: `${m.providerID}::${m.modelID}`,
        label: m.name,
        model: m,
      });
    }
    return Object.values(grouped);
  })();

  const parseModelValue = (val) => {
    if (!val) return null;
    const [providerID, ...rest] = val.split("::");
    const modelID = rest.join("::");
    return { providerID, modelID };
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F5F0E8 0%, #EBE2D0 100%)" }}>
      <Layout.Content style={{ padding: "40px 20px 60px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "radial-gradient(circle at 40% 40%, #6D4C41, #4E342E, #3E2723)",
                boxShadow:
                  "0 4px 20px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
            >
              ⬤
            </div>
          </div>
          <Title
            style={{
              color: "#3E2723",
              marginBottom: 6,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            ROUNDTABLE
          </Title>
          <Paragraph style={{ color: "#8B7355", fontSize: 15, letterSpacing: 1 }}>
            AI-Powered Intelligent Discussion · 输入话题，开始一场多视角深度对话
          </Paragraph>
        </div>

        <Steps
          current={step}
          items={[
            { title: "输入话题" },
            { title: "资讯研究" },
            { title: "确认设置" },
            { title: "开始讨论" },
          ]}
          style={{
            marginBottom: 28,
            background: "rgba(255,255,255,0.7)",
            borderRadius: 12,
            padding: "20px 28px",
            border: "1px solid #EDE0CC",
          }}
        />

        {step === 0 && (
          <Card
            style={{
              borderRadius: 16,
              border: "1px solid #EDE0CC",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            }}
            styles={{ body: { background: "#FFFDF7" } }}
          >
            <TextArea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="输入你想讨论的话题，例如：AI 是否应该拥有版权？"
              autoSize={{ minRows: 3, maxRows: 6 }}
              style={{
                fontSize: 16,
                marginBottom: 16,
                background: "#FAF7F0",
                borderColor: "#D4C5A0",
              }}
            />
            {models.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text style={{ color: "#5D4E37", fontSize: 13, display: "block", marginBottom: 6 }}>
                  <RobotOutlined /> 主持人模型
                </Text>
                <Select
                  style={{ width: "100%" }}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="默认 GLM-5.1"
                  options={modelOptions}
                  value={moderatorModel ? `${moderatorModel.providerID}::${moderatorModel.modelID}` : undefined}
                  onChange={(val) => setModeratorModel(parseModelValue(val))}
                />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: "#5D4E37", fontSize: 13, display: "block", marginBottom: 6 }}>
                <RobotOutlined /> 讨论角色数量：{roleCount} 位
              </Text>
              <Slider min={2} max={5} value={roleCount} onChange={setRoleCount}
                marks={{ 2: "2", 3: "3", 4: "4", 5: "5" }}
                step={1}
              />
            </div>
            <Row justify="space-between" align="middle">
              <Col>
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => setShowHistory(!showHistory)}
                  type="text"
                  style={{ color: "#8B7355" }}
                >
                  历史讨论
                </Button>
              </Col>
              <Col>
                <Button
                  type="primary"
                  size="large"
                  icon={<SendOutlined />}
                  loading={loading}
                  onClick={handleResearch}
                  style={{
                    background: "linear-gradient(135deg, #C9A951, #8B6914)",
                    borderColor: "#8B6914",
                    fontWeight: 600,
                    height: 44,
                    padding: "0 32px",
                  }}
                >
                  开始研究
                </Button>
              </Col>
            </Row>

            {showHistory && (
              <List
                style={{ marginTop: 20 }}
                dataSource={history}
                locale={{ emptyText: "暂无历史讨论" }}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button size="small" onClick={() => navigate(`/discussion/${item.id}`)}>
                        查看
                      </Button>,
                    ]}
                    style={{ borderBottom: "1px solid #EDE0CC" }}
                  >
                    <List.Item.Meta
                      title={<span style={{ color: "#3D2E1F" }}>{item.title || item.topic}</span>}
                      description={
                        <span style={{ color: "#8B7355" }}>{item.status} · {item.created_at}</span>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        )}

        {step === 1 && (
          <Card
            style={{
              borderRadius: 16,
              border: "1px solid #EDE0CC",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            }}
            styles={{ body: { background: "#FFFDF7" } }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <Spin size="large" />
              <Paragraph style={{ marginTop: 14, fontSize: 16, color: "#8B6914" }}>
                <RobotOutlined /> {researchStatus || "AI 主持人正在搜索资讯、生成讨论角色..."}
              </Paragraph>
            </div>
            {(researchThinking || researchLog) && (
              <div
                style={{
                  background: "#FAF7F0",
                  border: "1px solid #EDE0CC",
                  borderRadius: 12,
                  padding: "16px 20px",
                  maxHeight: 400,
                  overflowY: "auto",
                  fontSize: 13,
                  lineHeight: 1.8,
                  wordBreak: "break-word",
                  color: "#5D4E37",
                }}
              >
                <ThinkingText reasoning={researchThinking} content={researchLog} />
              </div>
            )}
          </Card>
        )}

        {step === 2 && (
          <Card
            style={{
              borderRadius: 16,
              border: "1px solid #EDE0CC",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            }}
            styles={{ body: { background: "#FFFDF7" } }}
          >
            {research && (
              <div style={{ marginBottom: 24 }}>
                <Title level={4} style={{ color: "#3E2723" }}>
                  {research.question || discussion.question}
                </Title>
                {research.news && (
                  <div
                    style={{
                      background: "#FAF7F0",
                      border: "1px solid #EDE0CC",
                      borderRadius: 8,
                      padding: "12px 16px",
                      color: "#5D4E37",
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    <Text strong style={{ color: "#8B6914" }}>最新动态：</Text>
                    {research.news}
                  </div>
                )}
              </div>
            )}

            <Title level={5} style={{ color: "#5D4E37" }}>讨论参与者</Title>
            <List
              dataSource={discussion.participants || []}
              renderItem={(p) => (
                <List.Item style={{ borderBottom: "1px solid #EDE0CC", flexDirection: "column", alignItems: "stretch" }}>
                  <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                    <List.Item.Meta
                      avatar={<Avatar style={{ backgroundColor: p.color, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>{p.name[0]}</Avatar>}
                      title={
                        <Space>
                          <span style={{ color: "#3D2E1F" }}>{p.name}</span>
                          {p.type === "user" && <Tag color="gold">你</Tag>}
                          {p.type === "ai" && <Tag color="orange">嘉宾</Tag>}
                        </Space>
                      }
                      description={<span style={{ color: "#8B7355" }}>{p.role_prompt}</span>}
                    />
                  </div>
                  {p.type === "ai" && models.length > 0 && (
                    <div style={{ marginTop: 8, paddingLeft: 48 }}>
                      <Select
                        style={{ width: "100%" }}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        size="small"
                        placeholder="默认模型（自动升级）"
                        options={modelOptions}
                        value={participantModels[p.id] ? `${participantModels[p.id].providerID}::${participantModels[p.id].modelID}` : undefined}
                        onChange={(val) => {
                          setParticipantModels((prev) => {
                            const next = { ...prev };
                            if (val) {
                              next[p.id] = parseModelValue(val);
                            } else {
                              delete next[p.id];
                            }
                            return next;
                          });
                        }}
                      />
                    </div>
                  )}
                </List.Item>
              )}
              style={{ marginBottom: 24 }}
            />

            <div
              style={{
                background: "#FAF7F0",
                borderRadius: 12,
                padding: "16px 20px",
                border: "1px solid #EDE0CC",
              }}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Text strong style={{ color: "#5D4E37" }}>发言次数：{rounds}</Text>
                  <Slider min={1} max={50} value={rounds} onChange={setRounds} />
                </Col>
                <Col span={12}>
                  <Space direction="vertical">
                    <Space>
                      <Switch checked={includeUser} onChange={setIncludeUser} />
                      <Text style={{ color: "#5D4E37" }}>我也要参与讨论</Text>
                    </Space>
                    {includeUser && (
                      <Input
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="你的称呼"
                        prefix={<UserOutlined style={{ color: "#8B6914" }} />}
                        style={{
                          width: 160,
                          background: "#FAF7F0",
                          borderColor: "#D4C5A0",
                        }}
                      />
                    )}
                  </Space>
                </Col>
              </Row>
            </div>

            <div style={{ textAlign: "right", marginTop: 28 }}>
              <Space>
                <Button onClick={() => { setStep(0); setTopic(""); setDiscussion(null); }} style={{ color: "#8B7355" }}>
                  重新开始
                </Button>
                <Button
                  type="primary"
                  size="large"
                  loading={loading}
                  onClick={handleConfirm}
                  style={{
                    background: "linear-gradient(135deg, #C9A951, #8B6914)",
                    borderColor: "#8B6914",
                    fontWeight: 600,
                    height: 44,
                    padding: "0 32px",
                  }}
                >
                  确认并开始讨论
                </Button>
              </Space>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card
            style={{
              borderRadius: 16,
              border: "1px solid #EDE0CC",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              textAlign: "center",
            }}
            styles={{ body: { background: "#FFFDF7" } }}
          >
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 40% 40%, #6D4C41, #3E2723)",
                  margin: "0 auto 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                }}
              >
                <span style={{ fontSize: 24, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>⬤</span>
              </div>
              <Title level={4} style={{ color: "#3E2723", marginBottom: 4 }}>准备就绪</Title>
              <Paragraph style={{ color: "#8B7355" }}>
                {discussion.participants?.length || 0} 位嘉宾 · {rounds} 次发言
              </Paragraph>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              onClick={handleStart}
              style={{
                background: "linear-gradient(135deg, #C9A951, #8B6914)",
                borderColor: "#8B6914",
                fontWeight: 600,
                height: 48,
                padding: "0 40px",
                fontSize: 16,
              }}
            >
              进入圆桌讨论
            </Button>
          </Card>
        )}
      </Layout.Content>
    </Layout>
  );
}
