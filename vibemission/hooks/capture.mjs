#!/usr/bin/env node
/**
 * VibeMission capture hook (dependency-free).
 * Claude Code 훅 페이로드(stdin JSON)를 받아 이벤트를 web /api/ingest 로 전송한다.
 * 원칙: 절대 세션을 막지 않는다. 어떤 에러든 삼키고 exit 0.
 * 토큰 없으면(시험 밖) 무해하게 no-op.
 */
import { readFileSync } from "node:fs";

const TOKEN = process.env.VIBEMISSION_TOKEN || process.env.HRMISSION_TOKEN;
const WEB = (process.env.VIBEMISSION_WEB_URL || process.env.HRMISSION_WEB_URL || "https://cleanmissionai.kr").replace(/\/$/, "");
const INGEST = process.env.VIBEMISSION_INGEST_URL || process.env.HRMISSION_INGEST_URL || (TOKEN ? `${WEB}/api/ingest` : null);

const done = () => process.exit(0); // 항상 통과
if (!TOKEN || !INGEST) done();

let raw = "";
try { raw = readFileSync(0, "utf8"); } catch { done(); }

let h = {};
try { h = JSON.parse(raw || "{}"); } catch { done(); }

const eventName = h.hook_event_name || h.hookEventName || "Unknown";

function truncate(v, n) {
  if (v == null) return v;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + "…[truncated]" : s;
}

function lastAssistantText(path) {
  if (!path) return "";
  try {
    const lines = readFileSync(path, "utf8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const o = JSON.parse(lines[i]);
      const msg = o.message || o;
      if ((o.type === "assistant" || msg.role === "assistant") && msg.content) {
        if (Array.isArray(msg.content)) return msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
        return String(msg.content);
      }
    }
  } catch { /* ignore */ }
  return "";
}

function mapEvent() {
  switch (eventName) {
    case "UserPromptSubmit": return { kind: "user_prompt", payload: { text: h.prompt ?? "" } };
    case "PostToolUse": return { kind: "tool_use", payload: { tool: h.tool_name, input: h.tool_input, response: truncate(h.tool_response, 8000) } };
    case "Stop": return { kind: "assistant_output", payload: { text: truncate(lastAssistantText(h.transcript_path), 12000) } };
    case "SessionStart": return { kind: "system", payload: { event: "session_start", source: h.source } };
    default: return { kind: "system", payload: { event: eventName } };
  }
}

const { kind, payload } = mapEvent();
const body = JSON.stringify({ token: TOKEN, tool: process.env.VIBEMISSION_TOOL || "claude_code", kind, payload, ts: new Date().toISOString() });

const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 2000);
try {
  await fetch(INGEST, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, body, signal: ctrl.signal });
} catch { /* 네트워크 실패도 무시 — 세션 우선 */ } finally { clearTimeout(t); done(); }
