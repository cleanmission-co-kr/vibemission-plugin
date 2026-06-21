#!/usr/bin/env node
/**
 * VibeMission exam CLI (dependency-free).
 *   node exam.mjs start    — 과제 받기 (타이머 시작)
 *   node exam.mjs submit   — 제출 → 결과 카드 링크
 *   node exam.mjs status   — 남은 시간/상태
 * 토큰/주소는 환경변수에서. (VIBEMISSION_TOKEN 우선, HRMISSION_TOKEN 호환)
 */
const TOKEN = process.env.VIBEMISSION_TOKEN || process.env.HRMISSION_TOKEN || "";
const WEB = (process.env.VIBEMISSION_WEB_URL || process.env.HRMISSION_WEB_URL || "https://cleanmissionai.kr").replace(/\/$/, "");
const cmd = (process.argv[2] || "status").toLowerCase();

if (!TOKEN) {
  console.log("⚠️ VIBEMISSION_TOKEN이 설정되지 않았습니다.\n   export VIBEMISSION_TOKEN=<받은 토큰> 한 뒤 claude를 다시 실행하세요.\n   토큰은 cleanmissionai.kr/go 에서 받습니다.");
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
      console.log(`📝 과제: ${d.title || ""}  (남은 시간 약 ${d.remainingMinutes ?? "?"}분)\n\n${d.brief || ""}\n\n──────────\n이제 평소처럼 저(AI)에게 지시해서 풀어보세요. 모든 프롬프트·과정이 기록됩니다.\n끝나면 /exam submit (또는 30분 지나면 자동 종료).`);
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
