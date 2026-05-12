import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { config } from "./config.js";
import discussionRoutes from "./routes/discussion.js";
import modelRoutes from "./routes/model.js";

const app = new Hono();

app.use("*", cors());

app.route("/api/discussions", discussionRoutes);
app.route("/api/models", modelRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.use("/*", serveStatic({ root: "../frontend/dist" }));

app.get("*", serveStatic({ root: "../frontend/dist", path: "index.html" }));

console.log(`Roundtable server starting on port ${config.PORT}`);

export default app;

import { serve } from "@hono/node-server";
serve({ fetch: app.fetch, port: config.PORT });
