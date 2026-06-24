#!/usr/bin/env node
/**
 * VibeMission exam CLI (dependency-free).
 *   node exam.mjs start <토큰>   — 과제 받기 (타이머 시작). 토큰을 인자로 주면 ~/.vibemission/config.json 에 저장.
 *   node exam.mjs submit         — 제출 → 결과 카드 링크
 *   node exam.mjs status         — 남은 시간/상태
 * 토큰 해석 우선순위: 인자(start <토큰>) > 환경변수 > ~/.vibemission/config.json
 *   → 시험 시작을 한 번 하면 토큰이 파일에 저장되어, 셸 export 없이도 캡처 훅이 동작한다.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CFG_DIR = join(homedir(), ".vibemission");
const CFG_PATH = join(CFG_DIR, "config.json");
const readCfg = () => { try { return JSON.parse(readFileSync(CFG_PATH, "utf8")) || {}; } catch { return {}; } };
const writeCfg = (o) => { try { mkdirSync(CFG_DIR, { recursive: true }); writeFileSync(CFG_PATH, JSON.stringify(o), "utf8"); } catch { /* ignore */ } };

const cmd = (process.argv[2] || "status").toLowerCase();
// "start <토큰>" 지원 — 붙여넣기 오염(❯, 따옴표, 공백, 한글 플레이스홀더 등) 제거.
const argToken = (process.argv[3] || "").replace(/[^A-Za-z0-9_-]/g, "");
const cfg = readCfg();
let TOKEN = (argToken && argToken.length >= 8) ? argToken
  : (process.env.VIBEMISSION_TOKEN || process.env.HRMISSION_TOKEN || cfg.token || "");
const WEB = (process.env.VIBEMISSION_WEB_URL || process.env.HRMISSION_WEB_URL || cfg.web || "https://cleanmissionai.kr").replace(/\/$/, "");
// 토큰을 새로 받았으면 파일에 저장 → 이후 캡처 훅·명령이 셸 env 없이도 읽는다.
if (TOKEN && TOKEN !== cfg.token) writeCfg({ token: TOKEN, web: WEB });

if (!TOKEN) {
  console.log("⚠️ 토큰이 없어요.\n   Claude Code 채팅창에 이렇게 입력하세요 (셸/터미널 아님):\n     /vibemission:exam start <받은 토큰>\n   토큰은 받은 메일/화면의 명령 안에 들어 있어요. (export 안 해도 됩니다)");
  process.exit(0);
}

async function api(path, init = {}) {
  const r = await fetch(WEB + path, { headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, ...init });
  return r.json().catch(() => ({}));
}

(async () => {
  try {
    if (cmd === "start") {
      const d = await api(`/api/exam?token=${encodeURIComponent(TOKEN)}`);
      if (d.expired) { console.log(`⏰ 이미 종료된 시험입니다.\n결과 카드: ${d.resultUrl}`); return; }
      console.log(`📝 과제: ${d.title || ""}  (남은 시간 약 ${d.remainingMinutes ?? "?"}분)\n\n${d.brief || ""}\n\n──────────\n이제 평소처럼 저(AI)에게 지시해서 풀어보세요. 모든 프롬프트·과정이 기록됩니다.\n끝나면 /vibemission:exam submit (또는 30분 지나면 자동 종료).`);
    } else if (cmd === "submit") {
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
