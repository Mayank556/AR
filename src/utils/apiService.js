const BASE = "/api";

export async function saveStrokes(strokes, session = "default") {
  const res = await fetch(`${BASE}/strokes/${session}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strokes }),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  return res.json();
}

export async function loadStrokes(session = "default") {
  const res = await fetch(`${BASE}/strokes/${session}`);
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  const data = await res.json();
  return data.strokes || [];
}

export async function listSessions() {
  const res = await fetch(`${BASE}/sessions`);
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  const data = await res.json();
  return data.sessions || [];
}

export async function deleteSession(session = "default") {
  const res = await fetch(`${BASE}/strokes/${session}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
}
