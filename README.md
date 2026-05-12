# 🏛️ Roundtable

> AI-Powered Intelligent Discussion · Multi-Perspective Deep Conversations

<p align="center">
  <img src="pic/roundtable.png" alt="Roundtable Discussion" width="720" />
</p>

Roundtable is an AI-driven roundtable discussion application. Enter a topic, and AI will host a multi-role discussion streamed in real time — researching background, generating diverse participants, coordinating speaker turns, and producing a summary.

---

## ✨ Features

- **Smart Research** — AI moderator decides whether web search is needed, then formulates a sharp discussion question
- **Multi-Role Generation** — Automatically creates 2–5 participants with diverse perspectives and backgrounds
- **Real-Time Streaming** — SSE-based streaming output with live text, reasoning steps, and thinking display
- **User Participation** — Join the discussion directly, raise your hand to speak
- **Roundtable Visualization** — Animated circular table layout with golden glow for the active speaker
- **Model Selection** — Configure the moderator model and each participant's model independently (200+ models available)
- **Discussion Summary** — Automatic summary at the end, or manually trigger one anytime
- **Dark Theme** — Immersive conference-room dark theme with warm gold accents
- **Responsive Design** — Adapts layouts for mobile screens
- **Discussion History** — Revisit past discussions anytime

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · Vite 6 · Ant Design 5 · React Router 7 · react-markdown |
| Backend | Hono · TypeScript · better-sqlite3 |
| AI | OpenCode API (SSE Streaming) |
| Runtime | Node.js / Bun |

---

## 📋 Prerequisites

- **Node.js** >= 18 or **Bun** (recommended)
- An **OpenCode server** running at `http://127.0.0.1:4096` (with credentials)

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
bun install
cd server && bun install
cd ../frontend && bun install
cd ..
```

### 2. Configure environment

Create `server/.env`:

```env
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_USERNAME=opencode
OPENCODE_PASSWORD=your_password
PORT=3001
```

### 3. Start development

```bash
# Terminal 1 — Backend server (port 3001)
cd server && bun run dev

# Terminal 2 — Frontend dev server (port 5173)
cd frontend && bun run dev
```

Open `http://localhost:5173` in your browser.

### 4. Production build

```bash
cd frontend && bun run build
cd ../server && bun run dev
```

Visit `http://localhost:3001`.

---

## 📂 Project Structure

```
Roundtable/
├── server/                     # Backend
│   ├── src/
│   │   ├── index.ts            # Hono app entry, route registration
│   │   ├── config.ts           # Environment config
│   │   ├── routes/
│   │   │   ├── discussion.ts   # REST + SSE endpoints
│   │   │   └── model.ts        # Model list API
│   │   └── services/
│   │       ├── coordinator.ts  # Core discussion logic
│   │       ├── db.ts           # SQLite data layer
│   │       └── opencode.ts     # OpenCode API client
│   └── data/                   # SQLite database (auto-created)
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── api.js              # API client
│   │   ├── pages/
│   │   │   ├── CreatePage.jsx  # Topic input & setup
│   │   │   ├── DiscussionPage.jsx  # Live discussion
│   │   │   └── HistoryPage.jsx     # Discussion history
│   │   └── components/
│   │       ├── RoundTable.jsx  # Table visualization
│   │       └── ThinkingText.jsx    # Markdown + reasoning
│   └── dist/                   # Build output
└── pic/                        # Screenshots
```

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_BASE_URL` | `http://127.0.0.1:4096` | OpenCode API endpoint |
| `OPENCODE_USERNAME` | `admin` | OpenCode auth username |
| `OPENCODE_PASSWORD` | — | OpenCode auth password (required) |
| `PORT` | `3001` | Backend server port |
| `DB_PATH` | `data/roundtable.db` | SQLite database path |

---

## 🎯 Usage

1. **Enter a topic** — anything from tech debates to current affairs
2. **Configure settings** — choose role count (2–5), speech rounds, and AI models
3. **Research phase** — AI searches for context and formulates a question
4. **Review participants** — edit roles, add/remove members, join in yourself
5. **Start discussion** — watch the live roundtable unfold with real-time streaming
6. **Participate** — raise your hand and share your thoughts
7. **Get summary** — AI generates a structured summary of all viewpoints

---

## 📸 Screenshots

| Topic Input | Discussion View |
|:-----------:|:---------------:|
| <img src="pic/title.png" width="360" /> | <img src="pic/roundtable.png" width="360" /> |

---

## 📄 License

MIT
