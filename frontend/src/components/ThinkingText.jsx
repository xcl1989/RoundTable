import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ThinkingText({ reasoning, content, style = {}, isSummary, dark }) {
  const [collapsed, setCollapsed] = useState(true);
  const hasReasoning = reasoning && reasoning.trim().length > 0;

  return (
    <div style={style}>
      {hasReasoning && (
        <div style={{ marginBottom: 8 }}>
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{
              cursor: "pointer",
              background: dark
                ? "rgba(201,169,81,0.1)"
                : (isSummary ? "rgba(201,169,81,0.15)" : "#F2E8D5"),
              border: dark
                ? "1px dashed rgba(201,169,81,0.25)"
                : (isSummary ? "1px dashed rgba(201,169,81,0.3)" : "1px dashed #D4C5A0"),
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              color: dark ? "rgba(201,169,81,0.6)" : (isSummary ? "rgba(201,169,81,0.6)" : "#8B7355"),
              fontStyle: "italic",
              userSelect: "none",
              display: "inline-block",
              transition: "all 0.2s",
            }}
          >
            💭 {collapsed ? "展开思考过程" : "收起思考过程"}
          </div>
          {!collapsed && (
            <div
              style={{
                background: dark
                  ? "rgba(201,169,81,0.05)"
                  : (isSummary ? "rgba(201,169,81,0.06)" : "#FAF4E8"),
                border: dark
                  ? "1px solid rgba(201,169,81,0.1)"
                  : (isSummary ? "1px solid rgba(201,169,81,0.12)" : "1px solid #EDE0CC"),
                borderRadius: 8,
                padding: "10px 14px",
                marginTop: 6,
                fontSize: 13,
                color: dark ? "rgba(201,169,81,0.5)" : (isSummary ? "rgba(245,240,232,0.7)" : "#8B7355"),
                fontStyle: "italic",
                lineHeight: 1.7,
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
      {content && <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>}
    </div>
  );
}
