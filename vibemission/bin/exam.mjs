#!/usr/bin/env node
/**
 * VibeMission exam CLI (dependency-free).
 *   node exam.mjs start <토큰>   — 과제 받기 (타이머 시작). 토큰 인자는 ~/.vibemission/config.json 에 저장.
 *   node exam.mjs submit         — 로컬 세션 로그를 통째로 업로드(훅 독립 캡처) → 제출 → 결과 카드 링크
 *   node exam.mjs sync           — 로컬 세션 로그만 업로드(제출 없이, 디버그)
 *   node exam.mjs status         — 남은 시간/상태
 * 토큰 우선순위: 인자(start <토큰>) > 환경변수 > ~/.vibemission/config.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CFG_DIR = join(homedir(), ".vibemission");
const CFG_PATH = join(CFG_DIR, "config.json");
const readCfg = () => { try { return JSON.parse(readFileSync(CFG_PATH, "utf8")) || {}; } catch { return {}; } };
const writeCfg = (o) => { try { mkdirSync(CFG_DIR, { recursive: true }); writeFileSync(CFG_PATH, JSON.stringify(o), "utf8"); } catch { /* ignore */ } };

const cmd = (process.argv[2] || "status").toLowerCase();
const argToken = (process.argv[3] || "").replace(/[^A-Za-z0-9_-]/g, "");
const cfg = readCfg();
let TOKEN = (argToken && argToken.length >= 8) ? argToken
  : (process.env.VIBEMISSION_TOKEN || process.env.HRMISSION_TOKEN || cfg.token || "");
const WEB = (process.env.VIBEMISSION_WEB_URL || process.env.HRMISSION_WEB_URL || cfg.web || "https://cleanmissionai.kr").replace(/\/$/, "");
if (TOKEN && TOKEN !== cfg.token) writeCfg({ token: TOKEN, web: WEB });

if (!TOKEN) {
  console.log("⚠️ 토큰이 없어요.\n   Claude Code 채팅창에 이렇게 입력하세요 (셸/터미널 아님):\n     /vibemission:exam start <받은 토큰>\n   토큰은 받은 메일/화면의 명령 안에 들어 있어요. (export 안 해도 됩니다)");
  process.exit(0);
}

async function api(path, init = {}) {
  const r = await fetch(WEB + path, { headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, ...init });
  return r.json().catch(() => ({}));
}

// ── 훅 독립 캡처: 로컬 Claude Code 세션 로그(JSONL)를 찾아 파싱 → 업로드 ──
// 훅이 세션에 안 켜졌어도(설치 후 재시작 안 함) 제출 시 트레일 전체를 보장한다.
// ⚠️ 반드시 '이 응시'의 세션만 골라야 함 — 기기 전체 최신 파일을 잡으면 다른 창/프로젝트의
//    프롬프트·코드가 남의 응시로 업로드된다(오채점 + 사적 코드 유출). 그래서 응시 토큰이나
//    'vibemission:exam start' 마커가 들어있는 JSONL을 우선한다.
function scanTranscripts() {
  const root = join(homedir(), ".claude", "projects");
  if (!existsSync(root)) return [];
  const found = [];
  let dirs = [];
  try { dirs = readdirSync(root); } catch { return []; }
  for (const d of dirs) {
    const dp = join(root, d);
    let files = [];
    try { files = readdirSync(dp); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const fp = join(dp, f);
      let m = 0; try { m = statSync(fp).mtimeMs; } catch { continue; }
      found.push({ fp, m });
    }
  }
  return found.sort((a, b) => b.m - a.m);
}

// 이 응시 세션의 트랜스크립트를 특정. 토큰/시작마커 포함 파일을 최근순으로 우선, 없으면 최신 파일.
function findTranscript() {
  const all = scanTranscripts();
  if (!all.length) return null;
  const marker = "vibemission:exam start";
  for (const { fp } of all) {
    let raw = ""; try { raw = readFileSync(fp, "utf8"); } catch { continue; }
    if ((TOKEN && raw.includes(TOKEN)) || raw.includes(marker)) return fp;
  }
  return all[0].fp; // 폴백(경고와 함께) — 어느 파일에도 마커가 없을 때만
}

function clip(v, n) { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) : s; }

function parseTranscript(path) {
  let raw = "";
  try { raw = readFileSync(path, "utf8"); } catch { return []; }
  let lines = raw.split("\n");
  // 시험 시작 지점 이후만 채점 대상(시작 전 잡담/다른 작업 제외). 토큰/시작마커가 처음 등장하는 줄부터.
  const startAt = lines.findIndex((ln) => ln && ((TOKEN && ln.includes(TOKEN)) || ln.includes("vibemission:exam start")));
  if (startAt > 0) lines = lines.slice(startAt);
  const out = [];
  for (const ln of lines) {
    if (!ln.trim()) continue;
    let o; try { o = JSON.parse(ln); } catch { continue; }
    const msg = o.message || o;
    const role = msg.role || o.type;
    const content = msg.content;
    if (role === "user") {
      let text = "";
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) text = content.filter((c) => c && (c.type === "text" || typeof c === "string")).map((c) => c.text || c).join("\n");
      if (text && text.trim()) out.push({ kind: "user_prompt", payload: { text: clip(text, 4000) } });
    } else if (role === "assistant") {
      if (Array.isArray(content)) {
        for (const c of content) {
          if (!c) continue;
          if (c.type === "tool_use") out.push({ kind: "tool_use", payload: { tool: c.name, input: typeof c.input === "object" ? c.input : { value: clip(c.input, 60000) } } });
          else if (c.type === "text" && c.text) out.push({ kind: "assistant_output", payload: { text: clip(c.text, 4000) } });
        }
      } else if (typeof content === "string" && content.trim()) {
        out.push({ kind: "assistant_output", payload: { text: clip(content, 4000) } });
      }
    }
  }
  return out.slice(-2000); // 최근 2000개
}

async function uploadTrail() {
  const path = findTranscript();
  if (!path) return { ok: false, reason: "no transcript" };
  const events = parseTranscript(path);
  if (!events.length) return { ok: false, reason: "empty" };
  try {
    const r = await api("/api/ingest/bulk", { method: "POST", body: JSON.stringify({ token: TOKEN, tool: "claude_code", events }) });
    return { ok: !!r.ok, inserted: r.inserted ?? 0, total: events.length };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) };
  }
}

(async () => {
  try {
    if (cmd === "start") {
      const d = await api(`/api/exam?token=${encodeURIComponent(TOKEN)}`);
      if (d.expired) { console.log(`⏰ 이미 종료된 시험입니다.\n결과 카드: ${d.resultUrl}`); return; }
      console.log(`📝 과제: ${d.title || ""}  (남은 시간 약 ${d.remainingMinutes ?? "?"}분)\n\n${d.brief || ""}\n\n──────────\n이제 평소처럼 저(AI)에게 지시해서 풀어보세요. 모든 프롬프트·과정이 기록됩니다.\n끝나면 /vibemission:exam submit (또는 30분 지나면 자동 종료).`);
    } else if (cmd === "sync") {
      const u = await uploadTrail();
      console.log(u.ok ? `✅ 로컬 기록 업로드 완료 (${u.inserted}/${u.total}개 신규).` : `⚠️ 업로드 실패: ${u.reason}`);
    } else if (cmd === "submit") {
      // 1) 훅 독립 캡처: 로컬 세션 로그를 통째로 업로드(훅이 안 켜졌어도 채점 가능)
      const u = await uploadTrail();
      if (u.ok) console.log(`📤 작업 기록 업로드 완료 (${u.inserted}/${u.total}개).`);
      else console.log(`ℹ️ 로컬 기록 업로드는 건너뜀(${u.reason}). 라이브 기록으로 채점합니다.`);
      // 2) 제출
      const d = await api(`/api/exam/submit`, { method: "POST", body: JSON.stringify({ token: TOKEN, note: "" }) });
      console.log(`✅ 제출 완료! 수고하셨어요.\n\n🎉 결과 카드(점수·등급·전세계 랭킹):\n${d.resultUrl || WEB}\n\n(채점에 10~20초 걸릴 수 있어요. 위 링크를 누르면 카드가 열립니다.)`);
    } else {
      const d = await api(`/api/exam?token=${encodeURIComponent(TOKEN)}&status=1`);
      if (d.expired) console.log(`⏰ 시험 종료됨.\n결과 카드: ${d.resultUrl}`);
      else console.log(`⏱ 상태: ${d.status || "?"} · 남은 시간 약 ${d.remainingMinutes ?? "?"}분`);
    }
  } catch (e) {
    console.log(`오류: ${(e && e.message) || e}`);
  }
})();
