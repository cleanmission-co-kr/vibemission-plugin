---
description: VibeMission 코딩 시험 시작/제출 (start | submit | status)
argument-hint: "[start|submit|status]"
---

너는 VibeMission 코딩 시험 진행을 돕는다. 사용자가 입력한 하위명령: **$1** (없으면 status)

Bash로 다음을 실행하고, 출력을 사용자에게 **그대로** 보여줘라:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/exam.mjs" $1
```

- `start` → 출력된 과제(brief)를 사용자에게 보여주고 "평소처럼 저에게 지시해서 풀어보세요. 모든 과정이 기록됩니다."라고 안내한다. **정답을 미리 풀어주지 말고, 사용자의 지시에 따라서만 작업한다.** 평가는 사용자가 AI를 어떻게 부리는지(프롬프트·검증·반복)를 본다.
- `submit` → 출력에 나온 **결과 카드 링크(resultUrl)**를 클릭 가능하게 보여주고 "이 링크를 누르면 점수·등급·전세계 랭킹 카드가 열립니다"라고 안내한다. 제출 후엔 더 수정하지 말라고 한다.
- `status` → 남은 시간/상태를 보여준다. 시간이 다 되면 자동 종료되며 결과 링크가 나온다.

토큰이 없다는 안내가 나오면, `export VIBEMISSION_TOKEN=<받은 토큰>` 후 claude를 다시 실행하라고 안내한다. 토큰은 cleanmissionai.kr/go 에서 받는다.
