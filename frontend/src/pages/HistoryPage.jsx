import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, List, Button, Typography, Tag, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { listDiscussions } from "../api.js";

const { Title, Text } = Typography;

const STATUS_MAP = {
  pending: { color: "default", label: "待研究" },
  researching: { color: "processing", label: "研究中" },
  ready: { color: "gold", label: "就绪" },
  active: { color: "orange", label: "进行中" },
  completed: { color: "green", label: "已完成" },
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDiscussions()
      .then(setList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout style={{ minHeight: "100vh", background: "linear-gradient(180deg, #F5F0E8 0%, #EBE2D0 100%)" }}>
      <Layout.Header
        style={{
          background: "linear-gradient(180deg, #3E2723 0%, #4E342E 100%)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          height: 56,
          lineHeight: "56px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
          borderBottom: "2px solid #8B6914",
        }}
      >
        <Button icon={<ArrowLeftOutlined />} type="text" style={{ color: "#C9A951" }} onClick={() => navigate("/")} />
        <Title level={4} style={{ color: "#F5F0E8", margin: "0 0 0 16px", letterSpacing: 2 }}>
          ROUNDTABLE HISTORY
        </Title>
      </Layout.Header>
      <Layout.Content style={{ padding: 24, maxWidth: 800, margin: "0 auto", width: "100%" }}>
        {loading ? (
          <Spin style={{ display: "block", margin: "60px auto" }} />
        ) : (
          <List
            dataSource={list}
            locale={{ emptyText: "暂无历史讨论" }}
            renderItem={(item) => {
              const s = STATUS_MAP[item.status] || { color: "default", label: item.status };
              return (
                <List.Item
                  actions={[
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => navigate(`/discussion/${item.id}`)}
                      style={{
                        background: "linear-gradient(135deg, #C9A951, #8B6914)",
                        borderColor: "#8B6914",
                      }}
                    >
                      查看
                    </Button>,
                  ]}
                  style={{
                    background: "#FFFDF7",
                    borderRadius: 12,
                    marginBottom: 8,
                    padding: "12px 20px",
                    border: "1px solid #EDE0CC",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <List.Item.Meta
                    title={
                      <>
                        <span style={{ color: "#3D2E1F" }}>{item.title || item.topic}</span>
                        <Tag color={s.color} style={{ marginLeft: 8 }}>{s.label}</Tag>
                      </>
                    }
                    description={
                      <Text style={{ color: "#8B7355" }}>{item.total_rounds} 次发言 · {item.created_at}</Text>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Layout.Content>
    </Layout>
  );
}
