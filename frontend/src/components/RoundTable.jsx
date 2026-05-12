import { useState, useEffect } from "react";
import { Avatar, Tooltip } from "antd";

function useIsMobile() {
  const [mobile, setMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

function getLayout(mobile) {
  if (mobile) return { table: 72, radius: 88, avatar: 30, avatarSpeak: 34, nameFont: 9, chairSize: 22, showChairs: false, showNames: false, rimInset: -4, rimBorder: 2 };
  return { table: 100, radius: 120, avatar: 38, avatarSpeak: 42, nameFont: 10, chairSize: 28, showChairs: true, showNames: true, rimInset: -5, rimBorder: 3 };
}

function getPosition(index, total, radius) {
  const startAngle = -90;
  const angle = startAngle + (360 / total) * index;
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.cos(rad) * radius,
    y: Math.sin(rad) * radius,
    angle,
  };
}

export default function RoundTable({
  participants = [],
  currentSpeakerId,
  waitingForUser,
  handRaised,
  round,
  totalRounds,
  onRoundTableClick,
}) {
  const mobile = useIsMobile();
  const L = getLayout(mobile);
  const total = participants.length;
  if (total === 0) return null;

  const pad = mobile ? 56 : 80;
  const containerW = L.radius * 2 + pad;
  const containerH = L.radius * 2 + pad;
  const cx = containerW / 2;
  const cy = containerH / 2;

  return (
    <div
      style={{ display: "inline-block", position: "relative" }}
      onClick={onRoundTableClick}
    >
      {!mobile && (
        <div
          style={{
            position: "absolute",
            left: cx - L.radius - 20,
            top: cy + 10,
            width: (L.radius + 20) * 2,
            height: 40,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(201,169,81,0.12) 0%, transparent 70%)",
            filter: "blur(8px)",
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          width: containerW,
          height: containerH,
          cursor: onRoundTableClick ? "pointer" : "default",
        }}
      >
        {/* Central table */}
        <div
          style={{
            position: "absolute",
            left: cx - L.table / 2,
            top: cy - L.table / 2 - (mobile ? 3 : 6),
            width: L.table,
            height: L.table,
            borderRadius: "50%",
            background: "radial-gradient(ellipse 70% 60% at 40% 35%, #7A5242 0%, #5A3A2E 40%, #3D251E 75%, #241510 100%)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4), inset 0 1px 3px rgba(255,255,255,0.08), inset 0 -4px 8px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: L.rimInset,
              borderRadius: "50%",
              border: `${L.rimBorder}px solid rgba(201,169,81,0.25)`,
              boxShadow: "inset 0 0 12px rgba(201,169,81,0.1)",
              pointerEvents: "none",
            }}
          />
          <div style={{ fontSize: mobile ? 7 : 8, color: "rgba(201,169,81,0.4)", letterSpacing: 2, fontWeight: 300 }}>
            ROUNDTABLE
          </div>
          <div style={{ fontSize: mobile ? 20 : 24, fontWeight: 700, color: "#C9A951", lineHeight: 1.1, textShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
            {round || 0}
          </div>
          <div style={{ fontSize: mobile ? 7 : 8, color: "rgba(201,169,81,0.4)", letterSpacing: 1, marginTop: 1 }}>
            / {totalRounds || 0}
          </div>
        </div>

        {/* Chairs */}
        {L.showChairs && participants.map((_, i) => {
          const pos = getPosition(i, total, L.radius);
          return (
            <div
              key={`chair-${i}`}
              style={{
                position: "absolute",
                left: cx + pos.x - L.chairSize / 2,
                top: cy + pos.y - L.chairSize / 2,
                width: L.chairSize,
                height: L.chairSize,
                borderRadius: "50%",
                border: "2px solid rgba(201,169,81,0.18)",
                background: "rgba(201,169,81,0.06)",
                zIndex: 1,
              }}
            />
          );
        })}

        {/* Participants */}
        {participants.map((p, i) => {
          const pos = getPosition(i, total, L.radius);
          const isSpeaking = currentSpeakerId === p.id;
          const isUser = p.type === "user";
          const hasHand = handRaised && isUser;
          const size = isSpeaking ? L.avatarSpeak : L.avatar;

          const px = cx + pos.x;
          const py = cy + pos.y;

          return (
            <Tooltip key={p.id} title={`${p.name} · ${p.role_prompt || ""}`} mouseEnterDelay={0.3}>
              <div
                style={{
                  position: "absolute",
                  left: px - size / 2,
                  top: py - size / 2,
                  zIndex: isSpeaking ? 10 : 4,
                  transition: "transform 0.35s ease",
                  transform: isSpeaking ? "scale(1.1)" : "scale(1)",
                }}
              >
                {hasHand && (
                  <div
                    style={{
                      position: "absolute",
                      top: -14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: mobile ? 12 : 14,
                      zIndex: 5,
                      animation: "handWave 0.5s ease-in-out infinite alternate",
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                    }}
                  >
                    ✋
                  </div>
                )}
                <div
                  style={{
                    borderRadius: "50%",
                    padding: isSpeaking ? 3 : 2,
                    background: isSpeaking
                      ? "linear-gradient(135deg, #C9A951, #E8C96A, #8B6914, #C9A951)"
                      : "rgba(255,255,255,0.15)",
                    backgroundSize: isSpeaking ? "300% 300%" : "auto",
                    animation: isSpeaking ? "shineBorder 2.5s linear infinite" : "none",
                    boxShadow: isSpeaking
                      ? "0 0 20px rgba(201,169,81,0.5), 0 0 40px rgba(201,169,81,0.15)"
                      : "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                >
                  <Avatar
                    size={size}
                    style={{
                      backgroundColor: p.color,
                      fontSize: size / 2.2,
                      fontWeight: 700,
                      border: "2px solid rgba(255,255,255,0.3)",
                    }}
                  >
                    {p.name[0]}
                  </Avatar>
                </div>
                {L.showNames && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: size / 2 + 4,
                      transform: "translateX(-50%)",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      fontSize: L.nameFont,
                      color: isSpeaking ? "#C9A951" : "rgba(201,169,81,0.6)",
                      fontWeight: isSpeaking ? 700 : 500,
                      textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                      letterSpacing: 0.5,
                      transition: "color 0.3s",
                    }}
                  >
                    {p.name}
                  </div>
                )}
              </div>
            </Tooltip>
          );
        })}

        {/* Waiting for user prompt */}
        {waitingForUser && (
          <div
            style={{
              position: "absolute",
              left: cx - 55,
              top: cy + L.radius + (mobile ? 8 : 22),
              width: 110,
              textAlign: "center",
              fontSize: mobile ? 10 : 11,
              color: "#C9A951",
              fontWeight: 600,
              background: "rgba(201,169,81,0.12)",
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid rgba(201,169,81,0.25)",
              backdropFilter: "blur(4px)",
              zIndex: 5,
            }}
          >
            ✋ 请发言
          </div>
        )}
      </div>

      <style>{`
        @keyframes shineBorder {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes handWave {
          0% { transform: rotate(-8deg) translateY(0); }
          100% { transform: rotate(8deg) translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
