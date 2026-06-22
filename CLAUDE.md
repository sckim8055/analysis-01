# Analysis-01 에이전트 절대 규칙 (MUST/NEVER)

이 프로젝트는 데이터 구조방정식(SEM) 모델링을 위한 시각적 파이프라인 프론트엔드(React/Vite)와 통계 연산 백엔드(Python FastAPI)로 구성됩니다.
AI 에이전트는 코드를 생성/수정할 때 다음 규칙을 절대적으로 준수해야 합니다.

## 절대 규칙 (NEVER)
- **절대** 하드코딩이나 매직 넘버를 사용하지 말 것.
- **절대** 불필요한 기능이나 과도한 추상화를 만들지 말 것 (머스크의 ATOM 원칙: 의심하고 삭제하라).
- **절대** 프론트엔드에 거대 컴포넌트(God Component)를 방치하지 말 것. 파일이 방대해지면 즉시 분리를 고려할 것.
- **절대** 예외(Error)를 조용히 넘기지 말고 큰 소리로 실패(Fail loud)하게 만들 것.

## 행동 원칙 (MUST)
- 모든 상세한 코딩 표준(SOLID, Clean Code, TDD)은 `docs/coding_standards.md`를 참고하여 적용한다.
- 토큰 최적화 및 에이전트 행동 지침은 `docs/AI-CODING-GUIDE.md`를 우선 참고한다.
- 코드를 변경하기 전 항상 연관된 기존 코드와 문서(황금 예제)를 먼저 읽는다.

## 기술 스택
- **Frontend**: React 18, Vite, TypeScript, Zustand (상태 관리), Lucide-React (아이콘)
- **Backend**: Python 3, FastAPI, uvicorn
