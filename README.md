# VibeMission — Claude Code plugin

AI로 코딩하는 **과정**(프롬프트·검증·반복)을 기록해서 점수·등급·전세계 랭킹 카드를 만들어 주는 코딩 테스트 플러그인입니다. → https://cleanmissionai.kr

의존성 없음(Node만 있으면 됨). 캡처 훅은 시험 토큰이 있을 때만 동작하고, 토큰이 없으면 아무 일도 하지 않습니다.

## 설치

```bash
claude plugin marketplace add cleanmission-co-kr/vibemission-plugin
claude plugin install vibemission@vibemission
```

## 사용

1. https://cleanmissionai.kr/go 에서 이메일을 넣고 **토큰**을 받습니다.
2. 토큰을 넣고 Claude Code를 실행합니다:
   ```bash
   export VIBEMISSION_TOKEN=<받은 토큰>
   claude
   ```
3. Claude Code 안에서:
   ```
   /exam start     # 과제 받기 (30분 타이머 시작)
   ... 평소처럼 AI에게 시켜서 풀기 ...
   /exam submit    # 끝내기 → 결과 카드 링크가 나옵니다
   ```

30분이 지나면 자동으로 종료됩니다. 조기 종료는 `/exam submit`.

## 무엇을 기록하나요?

시험 토큰이 설정된 동안의 **프롬프트·도구 사용·결과**를 cleanmissionai.kr로 보내 채점에 사용합니다(`hooks/capture.mjs`). 결과물이 아니라 "AI를 어떻게 부리는지"를 평가합니다. 토큰이 없으면 훅은 즉시 통과(no-op)합니다.

## 라이선스

MIT
