import express from "express";
import cors from "cors";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "strokes.json");
const PORT = process.env.PORT || 3001;

const app = express();
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:4173"];

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser requests (curl, same-origin) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  }
}));
app.use(express.json({ limit: "10mb" }));

// ── helpers ──────────────────────────────────────────────────────────────────
function readSessions() {
  if (!existsSync(DATA_FILE)) return {};
  try { return JSON.parse(readFileSync(DATA_FILE, "utf8")); } catch (err) {
    console.error("Failed to read sessions file:", err.message);
    return {};
  }
}

function writeSessions(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// ── routes ───────────────────────────────────────────────────────────────────

// GET /api/sessions  — list all saved session names
app.get("/api/sessions", (_req, res) => {
  const sessions = readSessions();
  res.json({ sessions: Object.keys(sessions) });
});

// GET /api/strokes/:session  — load strokes for a session (default: "default")
app.get("/api/strokes/:session?", (req, res) => {
  const key = req.params.session || "default";
  const sessions = readSessions();
  res.json({ strokes: sessions[key] || [] });
});

// POST /api/strokes/:session  — save strokes for a session
app.post("/api/strokes/:session?", (req, res) => {
  const key = req.params.session || "default";
  const { strokes } = req.body;
  if (!Array.isArray(strokes)) return res.status(400).json({ error: "strokes must be an array" });

  const sessions = readSessions();
  sessions[key] = strokes;
  writeSessions(sessions);
  res.json({ ok: true, session: key, count: strokes.length });
});

// DELETE /api/strokes/:session  — delete a session
app.delete("/api/strokes/:session?", (req, res) => {
  const key = req.params.session || "default";
  const sessions = readSessions();
  delete sessions[key];
  writeSessions(sessions);
  res.json({ ok: true, session: key });
});

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`AR/VR backend running on http://localhost:${PORT}`);
});
