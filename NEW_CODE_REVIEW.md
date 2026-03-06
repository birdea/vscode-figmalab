# FigmaLab Code Review (Current State)

- Review date: 2026-03-07 (Asia/Seoul)
- Scope: `src/**`, `test/**`, `package.json`, `README.md`
- Reference docs:
  - [CODE_REVIEW.md](/Users/birdea/workspace/vscode-figmalab/CODE_REVIEW.md)
  - [docs/CODE_REVIEW.md](/Users/birdea/workspace/vscode-figmalab/docs/CODE_REVIEW.md)
- Validation run:
  - `npm run lint` ✅ pass
  - `npm run test:coverage` ✅ pass
- Coverage snapshot:
  - Statements: **88.60%**
  - Branches: **77.31%**
  - Functions: **95.42%**
  - Lines: **88.60%**

## Executive Summary

이전 리뷰에서 지적된 주요 P0/P1 과제 다수는 이미 해소되었습니다. 현재 코드는 프로토타입을 넘어 베타 수준으로 안정화되었고, 테스트 게이트도 정상입니다.

다만 Production 관점에서는 아직 세 가지 축이 남아 있습니다.

1. 로그 웹뷰 수명주기 관리 부재로 인한 중복 subscriber 누적 가능성
2. Gemini 모델 조회 경로의 네트워크 내구성 부족
3. 문서와 실제 구현 사이의 정합성 저하

## Findings (Severity Ordered)

| Severity | Area | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|---|
| High | Operability / Resource Management | Log 뷰가 열릴 때마다 `Logger` subscriber가 추가되지만 해제되지 않음 | [src/webview/SidebarProvider.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/SidebarProvider.ts:44), [src/logger/Logger.ts](/Users/birdea/workspace/vscode-figmalab/src/logger/Logger.ts:14) | Log 뷰 재생성/재초기화가 반복되면 동일 로그가 중복 append되고, 장기적으로 subscriber 누수가 발생할 수 있습니다. | `Logger.onLog(...)`의 반환 `Disposable`을 보관하고, 웹뷰 dispose 시 해제하세요. |
| Medium | Reliability | Gemini 모델 목록 조회가 HTTP status, timeout, response shape 검증 없이 동작 | [src/agent/GeminiAgent.ts](/Users/birdea/workspace/vscode-figmalab/src/agent/GeminiAgent.ts:18) | Google API 오류 시 JSON 파싱 실패나 hang 형태로 노출될 수 있고, 사용자 메시지가 일관되지 않을 수 있습니다. | `res.statusCode` 검사, request timeout, 응답 shape 검증을 추가하고 실패 메시지를 표준화하세요. |
| Medium | Documentation / Product Correctness | README가 현재 구현 상태를 반영하지 못함 | [README.md](/Users/birdea/workspace/vscode-figmalab/README.md:23), [README.md](/Users/birdea/workspace/vscode-figmalab/README.md:24), [README.md](/Users/birdea/workspace/vscode-figmalab/README.md:97) | 사용자/기여자가 잘못된 제품 계약을 이해할 수 있습니다. 현재는 `codex`가 노출되지 않는데 문서는 미구현이라 쓰고, 일부 설정은 이미 연결됐습니다. | README를 현재 런타임 기준으로 정리하고, 실제 미완성 항목만 남기세요. |
| Medium | State Model | `WebviewMessageHandler`가 상태를 `static` 필드로 공유 | [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts:13) | 지금은 단순하지만 상태 출처가 `globalState`, `secrets`, `static memory`로 분산되어 추후 기능 확장 시 일관성 버그 위험이 커집니다. | 상태 저장 책임을 한 곳으로 모으고, 적어도 `agent/model/mcpData`의 source-of-truth를 명확히 문서화하세요. |
| Low | UX / Functional Clarity | Figma fetch는 MCP 미연결 상태에서도 조용히 parse 결과만 반환 | [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts:141), [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts:177) | 사용자는 “fetch”가 실제 MCP 호출인지 단순 URL parse인지 구분하기 어렵습니다. | 미연결 상태에서 fallback parse를 반환할 때 안내 메시지를 추가해 행위 차이를 분명히 하세요. |

## What Improved Since Previous Reviews

- 테스트 실패 상태가 해소되어 품질 게이트가 복구되었습니다.
- `McpClient`는 status / path / id 검증이 추가되어 이전보다 견고합니다.
- prompt generation은 host 레벨 동시 실행 방어가 들어갔습니다.
- Figma fetch 실패는 명시적 이벤트로 구분되어 진단성이 좋아졌습니다.
- Claude 모델 카탈로그는 설정 기반으로 외부화되었습니다.
- `Logger`는 단일 콜백 구조에서 다중 subscriber 구조로 개선되었습니다.

## Production Scorecard (Current)

| Metric | Score | Notes |
|---|---:|---|
| Release Stability | 8.6/10 | `lint`/`test:coverage` 통과, 기본 품질 게이트 정상 |
| Reliability | 7.6/10 | MCP 측은 개선됐지만 Gemini 모델 조회 내구성 보완 필요 |
| Security / Secrets Handling | 7.6/10 | 이전보다 개선, 다만 외부 API 실패 처리 표준화가 더 필요 |
| Operability / Diagnostics | 7.2/10 | 로그 체계는 충분하나 subscriber lifecycle 미완 |
| Maintainability | 7.8/10 | 모듈 구조 양호, static shared state는 중기 리스크 |
| Product / Docs Consistency | 6.5/10 | README와 런타임 정합성 보완 필요 |
| **Overall (Weighted)** | **7.6/10** | 베타 배포 가능 수준. 운영성/문서 정리 후 Production 적합도 상승 가능 |

## Recommended Roadmap

### P0

- Log subscriber dispose 처리
- 완료 기준: Log 뷰 재오픈/재초기화 후에도 append 중복 0건

### P1

- Gemini 모델 조회에 status/timeout/shape validation 추가
- Figma fetch의 “MCP 호출 vs 로컬 parse fallback” 메시지 분리
- 완료 기준: 외부 API 실패가 예측 가능한 사용자 메시지로 귀결

### P2

- `WebviewMessageHandler` static state 정리
- README 최신화
- 완료 기준: 상태 source-of-truth 문서화 완료, README와 제품 동작 불일치 0건

## Review Notes

- 현재 리뷰는 이전 두 문서를 단순 반복하지 않고, 이미 해소된 항목은 제외하고 남은 문제만 재평가했습니다.
- 다음 리뷰는 기능 추가보다 운영성/수명주기 관리 보완 후 다시 수행하는 편이 효율적입니다.
