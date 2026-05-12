import "dotenv/config";

export const config = {
  OPENCODE_BASE_URL: process.env.OPENCODE_BASE_URL || "http://127.0.0.1:4096",
  OPENCODE_USERNAME: process.env.OPENCODE_USERNAME || "admin",
  OPENCODE_PASSWORD: process.env.OPENCODE_PASSWORD || "",
  PORT: parseInt(process.env.PORT || "3001"),
  DB_PATH: process.env.DB_PATH || "data/roundtable.db",
};
