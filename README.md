# 새는돈 (leak-finder)

휴대폰 요금 고지서 캡처 한 장으로 1년간 새는 통신비를 찾아 주는 모바일 웹입니다.

## MVP 범위

| 화면 | 하는 일 |
| --- | --- |
| 1 고지서 업로드 | 통신사 선택 후 캡처 위치 안내, 캡처 업로드 또는 직접 입력 |
| 2 항목 확인 | 읽어 낸 요금제, 약정, 부가서비스를 보여 주고 수정 |
| 3 결과 카드 | 1년 절감액 + 규칙별 근거, 공유 |
| 4 조치 가이드 | 항목별 신청, 해지 단계와 연락처 |

## 진단 규칙

| 규칙 | 판정 | 결과 | 1년 절감액 |
| --- | --- | --- | --- |
| R1 | 선택약정 할인 없음 (알뜰폰 제외) | 절감 | 월정액 × 25% × 12 |
| R1 | 할인이 합계로만 찍혀 선택약정 여부를 모름 | 확인 | 합산 안 함 |
| R2 | 안 쓰는 유료 부가서비스 (할인 뒤 실제 내는 금액) | 절감 | 월 금액 합 × 12 |
| R3 | 2개월 안에 끝나는 프로모션 | 절감 | 인상분 × (12 - 남은 개월) |
| R4 | 사용량보다 큰 요금제 | 절감 | 한 단계 아래 요금제와 차액 × 12 |
| R5 | 연체 가산금 (가산금 + 미납가산금) | 절감 | 이번 달 가산금 (반복 가정 안 함) |
| R6 | 평소(지난 달 중앙값)보다 1.3배 이상, 5천 원 이상 많이 나온 달 | 확인 | 합산 안 함 |

- 절감 항목만 1년 절감액에 더하고, 확인 항목은 사용자가 직접 봐야 할 것으로 따로 보여 줍니다.
- R1과 R4가 같이 나오면 R1은 바뀐 요금제 기준으로 계산해 중복을 막습니다.
- 고지서가 여러 장(모바일, 단말대금, 인터넷·TV)이면 `diagnoseAll`로 한 번에 진단하고, 항목마다 출처 명세서를 붙입니다.
- 코드는 `src/lib/diagnose/`, 실제 고지서에서 금액만 옮긴 테스트 데이터는 `src/lib/diagnose/fixtures/`에 있습니다.

## 고지서 자동 읽기

캡처를 `POST /api/extract`로 보내면 `claude-haiku-5-5`가 금액과 항목명만 JSON으로 읽고, 서버가 검증한 뒤 확인 화면 입력값으로 바꿉니다.

| 단계 | 하는 일 | 코드 |
| --- | --- | --- |
| 한도 확인 | IP당 10분에 10회, 4장, 장당 4MB, 합계 10MB, PNG/JPG/WEBP/GIF | `src/app/api/extract/route.ts`, `src/lib/extract/rate-limit.ts` |
| 모델 호출 | 이름, 번호는 출력하지 않게 지시, 이미지 속 지시문 무시 | `src/lib/extract/claude.ts` |
| 응답 검증 | 모양, 금액 범위, 글자 길이 확인, 틀린 항목 버림 | `src/lib/extract/schema.ts` |
| 검산 | 항목 합(또는 부가세 포함 합)이 요금계와 10원 이내인지, 아니면 확인 화면에 경고 | `src/lib/extract/reconcile.ts` |

- 이미지는 메모리에서만 처리하고 저장하지 않습니다. 실패 로그에도 이미지나 응답 내용은 남기지 않습니다.
- 인증 정보가 없으면 503을 돌려주고, 화면은 직접 입력으로 이어집니다.

### 인증

| 환경 | 방식 | 환경 변수 |
| --- | --- | --- |
| 운영 (Vercel) | **ID 페더레이션**: Vercel이 요청마다 발급하는 OIDC 토큰을 Anthropic 토큰으로 교환, 정적 키 없음 | `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID`, `ANTHROPIC_WORKSPACE_ID` |
| 로컬 개발 | API 키 | `ANTHROPIC_API_KEY` |

- 운영에 `ANTHROPIC_API_KEY`를 같이 넣으면 키가 먼저 쓰여 페더레이션이 무시됩니다. 운영에는 넣지 않습니다.
- Anthropic 콘솔 발급자: `https://oidc.vercel.com/leedongwooks-projects` (Vercel 팀 발급자 방식)
- 규칙 조건: 주체 `owner:leedongwooks-projects:project:leak-finder:environment:production`, 대상 `https://vercel.com/leedongwooks-projects`
- 페더레이션 ID 는 비밀값이 아닙니다. 토큰 교환과 캐시, 만료 전 갱신은 SDK가 처리합니다 (`src/lib/extract/claude.ts`).
- 모델 출력은 신뢰하지 않습니다. 공격자가 모델 출력을 완전히 조작해도 할 수 있는 일은 자기 결과 화면에 틀린 숫자를 띄우는 것뿐입니다 (도구 호출 없음, 다른 사용자 데이터 없음, 화면은 글자로만 표시).

## 개발

```bash
npm install
cp .env.example .env.local   # 자동 읽기를 쓰려면 ANTHROPIC_API_KEY 입력
npm run dev     # http://localhost:3000
npm test        # 진단 규칙 테스트
```

## 작업 규칙

- `main`에 직접 커밋하지 않고 브랜치 + Pull Request로 진행
- 요금 데이터는 `data/`에, 출처와 기준일을 함께 기록

## 문서

- 기획서 v0.1, 기능명세서 v0.1, 와이어프레임 (Claude 아티팩트)
