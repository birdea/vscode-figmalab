# FigmaLab Code Review (Production Perspective)

- Review date: 2026-03-06
- Scope: `src/**`, `package.json`, `README.md`, test scripts
- Validation run:
  - `npm run lint` (pass)
  - `npm run test:unit` (pass, 90 tests)
  - `npm run test:coverage` (pass)

## Executive Summary

현재 코드베이스는 로컬 실험/프로토타이핑 목적에는 충분히 동작합니다. Production 관점에서는 보안(키 취급), 구성 일관성(선언 기능 vs 런타임), 운영 관측성(로그/실패 노출) 보완이 우선입니다.

핵심 정리:

1. Gemini 모델 조회에서 API key를 URL query로 사용하는 방식은 개선이 필요합니다.
2. MCP는 Desktop(localhost) 전제에서는 현재 `http` 고정이 즉시 치명 이슈는 아니지만, endpoint/문서/코드 정합성은 정리해야 합니다.
3. `codex`는 타입/설정 노출과 런타임 구현이 불일치하여 사용자 계약이 깨져 있습니다.

## Findings (Severity Ordered)

| Severity | Area | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|---|
| High | Security | Gemini 모델 목록 조회가 API key를 URL query(`?key=`)에 포함 | [src/agent/GeminiAgent.ts](/Users/birdea/workspace/vscode-figmalab/src/agent/GeminiAgent.ts:20) | 로컬 단독 환경에서는 즉시 유출이 확정되진 않지만, 프록시/로그 수집이 있는 환경에서 키 노출 가능성이 있습니다. | SDK/헤더 기반 방식으로 전환하고, URL/에러 로그에 민감값 마스킹을 적용하세요. |
| High | Product Correctness | `codex`가 타입/설정/헬프에는 존재하지만 AgentFactory 미구현 | [src/types.ts](/Users/birdea/workspace/vscode-figmalab/src/types.ts:2), [package.json](/Users/birdea/workspace/vscode-figmalab/package.json:135), [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts:186), [src/agent/AgentFactory.ts](/Users/birdea/workspace/vscode-figmalab/src/agent/AgentFactory.ts:20) | 사용자에게 노출된 옵션이 런타임에서 실패할 수 있어 제품 신뢰를 저하시킵니다. | `codex`를 실제 구현하거나, 릴리스 전까지 설정/타입/헬프에서 제거해 계약을 일치시키세요. |
| Medium | Configuration Consistency | README에 `figmalab.mcpEndpoint`가 문서화되어 있으나 실제 설정 항목/주입 흐름이 불완전 | [README.md](/Users/birdea/workspace/vscode-figmalab/README.md:93), [src/webview/SidebarProvider.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/SidebarProvider.ts:35), [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts:100) | 운영 시 “설정 가능” 기대와 실제 동작이 다를 수 있습니다. | Desktop MCP 정책 기준으로 endpoint를 고정할지 configurable로 갈지 결정하고 문서/코드/설정을 동일하게 맞추세요. |
| Medium | Observability UX | Log 뷰는 실시간 append 중심이며, 늦게 열린 경우 초기 로그 재표시가 약함 | [src/logger/Logger.ts](/Users/birdea/workspace/vscode-figmalab/src/logger/Logger.ts:59), [src/webview/SidebarProvider.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/SidebarProvider.ts:41) | 장애 초반 이벤트를 사용자가 놓칠 수 있습니다. | Log 뷰 초기화 시 최근 entries snapshot 전송을 추가하세요. |
| Medium | Maintainability / Accuracy | Prompt estimate와 실제 생성 prompt 경로가 분리됨 | [src/webview/ui/components/PromptLayer.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/components/PromptLayer.ts:133), [src/prompt/PromptBuilder.ts](/Users/birdea/workspace/vscode-figmalab/src/prompt/PromptBuilder.ts:12), [src/agent/GeminiAgent.ts](/Users/birdea/workspace/vscode-figmalab/src/agent/GeminiAgent.ts:96) | 사용자 표시 추정치와 실제 요청 크기 차이, 에이전트별 동작 편차가 생깁니다. | PromptBuilder 단일 소스로 estimate/generate를 통합하세요. |

## Desktop MCP Re-Assessment

이 프로젝트가 Remote MCP가 아닌 Desktop MCP(로컬 앱 연동) 전제라면 다음과 같이 우선순위를 조정하는 것이 타당합니다.

- `http` only transport 자체는 당장 릴리스 블로커 아님
- 대신 우선할 것:
  - endpoint 정책 명확화(고정 또는 설정 가능)
  - 문서/설정/런타임 정합성
  - 연결 실패 시 사용자 메시지 품질

즉, 이전 리뷰에서 제안한 `https` 지원은 장기 확장 과제(P3)로 내리고, 현재는 정합성과 진단성 개선이 더 효율적입니다.

## Production Scorecard (Updated)

| Metric | Score | Notes |
|---|---:|---|
| Security (Secrets Handling) | 5.8/10 | Query key 사용은 개선 필요. 로컬 전제이므로 즉시 Critical은 아님. |
| Reliability (Desktop MCP) | 6.8/10 | 핵심 기능은 동작하나 endpoint/오류 처리 정책 명확화 필요. |
| Functional Correctness | 6.7/10 | 주요 플로우 동작, 단 `codex` 계약 불일치 존재. |
| Test Quality | 8.7/10 | 90 passing, coverage 양호. |
| Operability | 6.9/10 | 로그 체계는 있으나 초기 가시성 보강 필요. |
| Maintainability | 7.1/10 | 모듈 구조는 양호, 프롬프트 경로 중복이 부채. |
| **Overall (Weighted)** | **7.0/10** | Desktop MCP 전제에서는 베타 배포 가능 수준, 핵심 과제 선행 권장. |

Coverage snapshot (`npm run test:coverage`):

- Statements: 88.98%
- Branches: 77.72%
- Functions: 94.18%
- Lines: 88.98%

## Backlog (Priority x Cost)

| Priority | Task | Cost | Why now |
|---|---|---|---|
| P0 | Gemini API key query 제거 + 민감값 마스킹 | 1.0~1.5d | 보안 리스크 대비 효과가 가장 큼 |
| P0 | `codex` 정책 확정 및 설정/타입/런타임 정렬 | 0.5~1.0d | 사용자 계약 불일치 해소 |
| P1 | MCP endpoint 정책 확정(고정/설정 가능) 및 문서/코드 동기화 | 0.5~1.0d | Desktop 운영 기준 정합성 확보 |
| P1 | 로그 뷰 초기 hydrate + 오류 메시지 표준화 | 0.5~1.0d | 운영/디버깅 효율 개선 |
| P2 | PromptBuilder 단일화(estimate + generate) | 1.5~2.0d | 중장기 유지보수 비용 절감 |
| P3 | (옵션) Remote MCP 대비 `https` transport 지원 | 1.5~2.5d | 향후 확장 준비 |

## Phased Plan (Rewritten)

### Phase 1: Security and Contract Alignment

- Gemini key query 제거
- `codex` 정책 결정(구현 또는 제거)
- 완료 기준: 키 비노출 검증, 설정-런타임 불일치 0건

### Phase 2: Desktop MCP Operational Tightening

- MCP endpoint 정책 확정 및 문서/코드 일치
- 실패 메시지/로그 표준화
- 완료 기준: 사용자 관점 오류 재현성 향상, 운영 문서 일치

### Phase 3: Maintainability and Future Expansion

- PromptBuilder 경로 통합
- 필요 시 https/remote MCP 대응
- 완료 기준: 프롬프트 경로 단일화, 확장 과제 분리 완료

## Notes on `codex` Policy

"`codex` 지원 정책 확정"의 의미는 다음 중 하나를 선택해 코드와 설정을 일치시키는 것입니다.

1. 지원: `codex` Agent를 실제 구현하고 UI/모델조회/생성을 완전 연결
2. 미지원: `codex` 관련 타입/설정/헬프 노출을 제거해 사용자 계약을 명확화

현재 상태는 노출은 되어 있으나 동작은 미완성이라, 어떤 방향이든 조속히 정렬이 필요합니다.
