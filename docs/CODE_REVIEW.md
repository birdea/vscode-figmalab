# 코드 리뷰

## 범위

검토 대상:

- VS Code 확장 호스트 흐름
- 웹뷰 UI 및 메시지 브리지
- Figma MCP 연동
- AI 에이전트 연동
- 빌드, 타입 안정성, 테스트 가능성

로컬 검증 항목:

- `npm run build`
- `npm run lint`
- `npm test`
- `npx tsc --noEmit`

## 요약

이 저장소는 이미 동작 가능한 수직 기능 흐름을 갖추고 있습니다. MCP 연결/조회, 스크린샷 조회, Gemini/Claude 생성, 에디터 삽입, 로깅까지 코드상으로 이어져 있습니다. 현재의 핵심 문제는 구조 부재보다는 UI와 호스트 사이의 신뢰성 부족, 실제 결함을 잡아내지 못하는 빌드 품질 게이트, 그리고 사용자에게 현재 상태를 잘못 전달할 수 있는 UX 불일치에 가깝습니다.

가장 먼저 해결해야 할 문제는 다음 네 가지입니다.

1. 실제 TypeScript 오류가 존재하지만, 현재 프로덕션 빌드에서는 타입 체크를 하지 않습니다.
2. 호스트 메시지 핸들러의 정적 상태가 뷰와 세션 사이에 새어 나갈 수 있습니다.
3. 여러 호스트 실패가 UI에 전달되지 않고 로그에만 남아 무음 실패가 발생합니다.
4. 로그 클리어 명령이 잘못 연결되어 있어 Log 뷰가 실제로 비워지지 않습니다.

## 장점

- `agent`, `figma`, `editor`, `prompt`, `webview`, `logger`로 폴더 역할이 비교적 명확하게 분리되어 있음
- VS Code API 사용이 전반적으로 적절함: secrets, output channel, file save, webview
- 확장 진입점이 단순하고 읽기 쉬움
- UI 개발용 mock MCP 서버가 포함되어 있음
- 최소한의 유닛 테스트라도 존재해서 출발점이 전혀 없는 상태는 아님

## 우선순위별 주요 이슈

| 우선순위 | 분류                | 이슈                                                                                                             | 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 영향                                                                                                                                                                                                                                                            | 권장 조치                                                                                                                                                                      |
| -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Critical | 빌드 / 버그         | 배포 빌드에서 TypeScript 타입 체크를 하지 않으며, 현재 저장소에는 실제 TS 오류가 존재합니다.                     | [esbuild.config.js](/Users/birdea/workspace/vscode-figmalab/esbuild.config.js#L1), [tsconfig.json](/Users/birdea/workspace/vscode-figmalab/tsconfig.json#L1), [src/webview/ui/main.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/main.ts#L18), [src/webview/ui/components/FigmaLayer.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/components/FigmaLayer.ts#L3)                                                                                                 | `npm run build`는 통과하지만 `npx tsc --noEmit`는 실패합니다. 이유는 `main.ts`가 호출하는 `FigmaLayer.onDataResult`, `FigmaLayer.onScreenshotResult`가 실제로 구현되어 있지 않기 때문입니다. 즉, 현재 릴리스 절차로는 깨진 UI 로직이 그대로 배포될 수 있습니다. | `typecheck` 스크립트를 추가하고 CI 및 `build` 과정에 포함하세요. 그리고 `main.ts`에서 호출하는 메서드를 구현하거나, 호출 자체를 제거해야 합니다.                               |
| High     | 상태 관리 / 버그    | `WebviewMessageHandler`의 정적 상태가 모든 핸들러 인스턴스에 공유되어 agent/model/MCP 데이터가 섞일 수 있습니다. | [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts#L11), [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts#L59), [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts#L188)                                                                                                             | `currentAgent`, `currentModel`, `lastMcpData`가 static이기 때문에 상태가 뷰나 워크스페이스에 종속되지 않고 프로세스 전역으로 공유됩니다. 그 결과 오래된 MCP 데이터로 생성되거나, 다른 패널에서 선택한 모델이 섞이는 문제가 생길 수 있습니다.                    | 상태를 `ExtensionContext` 또는 워크스페이스 단위 세션 스토어로 분리하세요. 사용자 세션 데이터는 static mutable state로 관리하지 않는 편이 안전합니다.                          |
| High     | 에러 처리 / UX      | 여러 호스트 측 실패가 로그에만 남고 웹뷰에는 전달되지 않습니다.                                                  | [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts#L35), [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts#L151), [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts#L178), [src/webview/ui/main.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/main.ts#L18)              | 예를 들어 모델 목록 조회 실패, 모델 정보 열기 실패, secret 저장 실패, editor 저장/삽입 실패 등은 사용자가 현재 패널에서 바로 인지하기 어렵습니다. 로그만 남기는 방식은 진단에는 도움이 되지만 인터랙티브 도구의 UX로는 부족합니다.                              | 모든 명령에 대해 성공/실패 이벤트를 표준화하고, 각 패널에서 인라인 오류를 렌더링하도록 바꾸세요. 로그는 보조 진단 수단으로 두는 편이 맞습니다.                                 |
| High     | 버그 / UX           | 로그 클리어 명령이 실제 Log 웹뷰를 비우지 못합니다.                                                              | [src/extension.ts](/Users/birdea/workspace/vscode-figmalab/src/extension.ts#L55), [src/webview/ui/main.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/main.ts#L48), [src/webview/ui/components/LogLayer.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/components/LogLayer.ts#L3)                                                                                                                                                                                 | `extension.ts`는 `{ command: 'log.clear' }`를 보내지만, 웹뷰는 `event === 'log.append'`만 수신합니다. 따라서 output channel은 비워져도 화면상의 Log 뷰는 새로고침 전까지 그대로 남습니다.                                                                       | `log.clear`를 정식 host event로 추가하고 `LogLayer.clear()`를 구현하세요. 호스트-웹뷰 메시지 계약은 대칭적이고 타입 안정적으로 유지하는 것이 좋습니다.                         |
| High     | 테스트 가능성       | 선언된 테스트 명령이 현재 동작하지 않습니다.                                                                     | [package.json](/Users/birdea/workspace/vscode-figmalab/package.json#L101)                                                                                                                                                                                                                                                                                                                                                                                                                 | `npm test`는 `./out/test/runTest.js`가 없어서 즉시 실패합니다. 이 상태에서는 자동 검증에 대한 신뢰를 줄 수 없고, 회귀를 잡아낼 수 없습니다.                                                                                                                     | 실제 VS Code 통합 테스트 러너를 연결해 `out/test`를 생성하도록 하거나, 동작하는 유닛 테스트 체계로 교체해 CI에 포함하세요.                                                     |
| Medium   | 제품 / 설정         | 설정값과 실제 런타임 지원 범위가 일치하지 않습니다.                                                              | [package.json](/Users/birdea/workspace/vscode-figmalab/package.json#L88), [src/agent/AgentFactory.ts](/Users/birdea/workspace/vscode-figmalab/src/agent/AgentFactory.ts#L20), [src/extension.ts](/Users/birdea/workspace/vscode-figmalab/src/extension.ts#L12)                                                                                                                                                                                                                            | `figmalab.defaultAgent`는 `codex`를 노출하지만 실제 Codex 구현은 없습니다. 또한 `defaultAgent` 설정은 선언만 되어 있고 실제 초기 UI/호스트 상태에 반영되지 않습니다. 사용자 입장에서는 존재하는 설정이지만 동작하지 않는 기능으로 보입니다.                     | Codex를 제대로 구현하고 `defaultAgent`를 실제로 적용하거나, 지원하지 않는 옵션은 기능이 완성될 때까지 제거하세요.                                                              |
| Medium   | UX / 정확성         | Prompt 토큰 추정이 실제 생성 프롬프트와 분리되어 있어 오해를 유발합니다.                                         | [src/webview/ui/components/PromptLayer.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/components/PromptLayer.ts#L90), [src/prompt/PromptBuilder.ts](/Users/birdea/workspace/vscode-figmalab/src/prompt/PromptBuilder.ts#L12), [src/prompt/TokenEstimator.ts](/Users/birdea/workspace/vscode-figmalab/src/prompt/TokenEstimator.ts#L8)                                                                                                                                         | 현재 Prompt 패널은 사용자 입력 텍스트만 기준으로 토큰을 계산하지만, 실제 생성에는 output-format 지시문과 MCP 데이터가 함께 포함됩니다. 이미 `PromptBuilder`와 `TokenEstimator`가 있는데 UI는 이를 사용하지 않고 있어 표시된 추정값이 실질적으로 틀립니다.       | 프롬프트 생성과 토큰 계산을 하나의 단일 소스로 통합하고, 웹뷰는 호스트에 추정을 요청하거나 동일 모듈을 공유하도록 정리하세요.                                                  |
| Medium   | UX                  | Figma 패널이 마운트 즉시 자동 연결을 시도하고, 연결 성공 시 mock URL을 자동 주입합니다.                          | [src/webview/ui/components/FigmaLayer.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/components/FigmaLayer.ts#L24), [src/webview/ui/components/FigmaLayer.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/components/FigmaLayer.ts#L63)                                                                                                                                                                                                                            | 서버가 떠 있지 않은 정상 상황에서도 시작 즉시 실패 로그가 쌓이고, `https://figma.com/file/mock-1234?node-id=0:1` 같은 예제 값이 실제 값처럼 입력됩니다. 프로토타입 단계에서는 편할 수 있지만, 실제 제품 UX로는 혼란을 만들 가능성이 큽니다.                     | 자동 연결은 명시적 액션 또는 저장된 사용자 설정 기반으로 바꾸고, 예제 데이터는 “샘플 불러오기” 같은 별도 액션으로 분리하세요. 가능하면 개발 모드에서만 노출하는 편이 좋습니다. |
| Medium   | UX / VS Code 적합성 | UI가 아직 `alert()`를 사용하고 있고, 장시간 작업에 대한 로딩/진행률/취소 흐름이 없습니다.                        | [src/webview/ui/components/FigmaLayer.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/components/FigmaLayer.ts#L42), [src/webview/WebviewMessageHandler.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/WebviewMessageHandler.ts#L205), [src/webview/ui/main.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/main.ts#L36), [src/webview/ui/components/PromptLayer.ts](/Users/birdea/workspace/vscode-figmalab/src/webview/ui/components/PromptLayer.ts#L31) | `alert()`는 VS Code 웹뷰 안에서 이질적이고 차단적입니다. 또한 호스트는 `prompt.generating` 이벤트를 보내지만 UI는 이를 전혀 소비하지 않습니다. 생성 시간이 길어지면 사용자는 화면이 멈춘 것으로 느낄 가능성이 큽니다.                                           | `alert()` 대신 인라인 검증 또는 VS Code notification으로 바꾸고, 생성 중 상태 표시, 진행률, 취소 버튼을 추가하세요.                                                            |
| Medium   | 네트워킹 / 호환성   | `McpClient`가 Node `http`에 고정되어 있어 HTTPS MCP endpoint를 지원하지 못합니다.                                | [src/figma/McpClient.ts](/Users/birdea/workspace/vscode-figmalab/src/figma/McpClient.ts#L1), [src/figma/McpClient.ts](/Users/birdea/workspace/vscode-figmalab/src/figma/McpClient.ts#L32)                                                                                                                                                                                                                                                                                                 | endpoint는 설정값으로 자유롭게 입력받지만 실제 전송은 항상 `http.request`만 사용합니다. 사용자가 `https://...`를 넣는 순간 바로 실패할 수 있는 숨은 호환성 버그입니다.                                                                                          | `url.protocol`에 따라 `http`/`https`를 분기하거나, 타임아웃/상태코드/프로토콜 처리를 지원하는 상위 레벨 HTTP 클라이언트 사용을 고려하세요.                                     |
| Low      | 리소스 관리         | 스크린샷 미리보기 파일을 temp 디렉터리에 쌓기만 하고 정리하지 않습니다.                                          | [src/figma/ScreenshotService.ts](/Users/birdea/workspace/vscode-figmalab/src/figma/ScreenshotService.ts#L22)                                                                                                                                                                                                                                                                                                                                                                              | 스크린샷 기능을 자주 쓰면 임시 PNG 파일이 계속 남습니다. 당장 치명적이지는 않지만 일상적으로 쓰는 도구에는 좋지 않은 습관입니다.                                                                                                                                | 생성한 temp 파일을 추적하고, deactivate 시점이나 editor close 이후 정리 가능한 범위에서 삭제하세요.                                                                            |
| Low      | 유지보수성          | Prompt 생성 로직이 공용 `PromptBuilder`를 쓰지 않고 에이전트별로 중복 구현되어 있습니다.                         | [src/prompt/PromptBuilder.ts](/Users/birdea/workspace/vscode-figmalab/src/prompt/PromptBuilder.ts#L12), [src/agent/GeminiAgent.ts](/Users/birdea/workspace/vscode-figmalab/src/agent/GeminiAgent.ts#L86), [src/agent/ClaudeAgent.ts](/Users/birdea/workspace/vscode-figmalab/src/agent/ClaudeAgent.ts#L59)                                                                                                                                                                                | 프롬프트 규칙이 시간이 지나면서 분기될 가능성이 높습니다. 실제로 지금도 Gemini와 Claude의 prompt 구성과 지시 강도가 조금씩 다릅니다. 이런 차이는 디버깅과 테스트를 어렵게 만듭니다.                                                                             | 프롬프트 생성은 하나의 공용 모듈로 통합하고, 각 에이전트는 provider transport 차이만 담당하도록 분리하세요.                                                                    |
| Low      | 유지보수성 / 최신성 | Claude 모델 메타데이터가 코드에 하드코딩되어 있습니다.                                                           | [src/agent/ClaudeAgent.ts](/Users/birdea/workspace/vscode-figmalab/src/agent/ClaudeAgent.ts#L6)                                                                                                                                                                                                                                                                                                                                                                                           | 모델 ID와 제공 여부는 시간이 지나면 금방 바뀝니다. 프로토타입으로는 이해할 수 있지만, 확장 기능 수준에서는 금방 낡는 지점입니다.                                                                                                                                | 가능하면 provider가 지원하는 실시간 discovery를 쓰고, 어렵다면 버전 관리되는 모델 레지스트리와 테스트를 분리해 두세요.                                                         |

## UI 리뷰

### 좋은 점

- VS Code theme variable을 활용해 전반적으로 네이티브 스타일에 가까운 톤을 유지하고 있습니다.
- Figma / Agent / Prompt / Log 패널 분리가 직관적입니다.
- 사이드바 환경에 맞게 버튼과 라벨의 밀도가 비교적 잘 맞춰져 있습니다.

### 개선 필요

- Prompt 패널에 현재 MCP 컨텍스트가 로드되어 있는지, 그 크기가 얼마나 되는지, 어떤 모델이 선택되어 있는지가 한눈에 보이지 않습니다.
- Agent 패널에 “API key 저장 성공/실패”, “모델 로드 실패”, “모델 정보 열기 성공” 같은 상태 피드백이 없습니다.
- 호스트는 `figma.dataResult`, `figma.screenshotResult`를 보내지만 Figma 패널은 이를 실제 화면 결과로 표현하지 못하고 있습니다.
- Log 패널에 빈 상태, 상세 펼침, 그룹핑, clear 동기화가 없습니다.
- 전반적으로 `11px` 위주의 작은 타이포를 사용해 가독성이 떨어질 수 있습니다.

## UX 리뷰

### 핵심 UX 리스크

- 현재 패널에서는 상태가 바뀌지 않는데 백그라운드에서는 작업이 진행되는 경우가 많습니다.
- 자동 연결과 mock 자동 주입은 “편리함”보다는 “왜 이 값이 들어갔지?”라는 혼란을 만들 가능성이 큽니다.
- “Generate” 버튼은 비활성화되지만, 그 외의 진행 상태 표현이 거의 없습니다.
- 저장된 API 키, 선택한 모델, 실제 생성 요청 사이의 관계가 사용자에게 명확히 설명되지 않습니다.
- 오류 메시지 체계가 일관되지 않습니다. 어떤 것은 인라인, 어떤 것은 로그 전용, 어떤 것은 `alert`, 어떤 것은 아예 보이지 않습니다.

### 권장 UX 개선

- 각 패널 상단 또는 하단에 일관된 상태 표시 영역을 추가하세요.
- 생성 전 현재 agent, model, MCP 컨텍스트 상태, 예상 프롬프트 크기를 한 번에 보여주는 요약 카드가 있으면 좋습니다.
- 차단형 브라우저 alert 대신 인라인 검증 또는 VS Code notification을 사용하세요.
- “Reconnect”, “Reset”, “MCP context clear” 같은 명시적 액션을 제공하세요.
- JSON 미리보기, 스크린샷 미리보기, 생성 코드 미리보기를 탭 또는 토글로 나누면 사용성이 좋아집니다.

## 기술 개선 포인트

### 아키텍처

- 단방향 fire-and-forget 메시지 대신, 명확한 command-response 계층을 두는 것이 좋습니다.
- 패널 간 공유 상태는 handler static 필드가 아니라 전용 store로 관리하는 편이 낫습니다.
- 웹뷰 UI를 여러 DOM 조작 콜백의 집합으로 두기보다 작은 상태 머신처럼 다루면 신뢰성이 올라갑니다.

### 안정성

- `typecheck`를 추가하고 CI 및 release packaging에 반드시 포함하세요.
- 메시지 브리지와 extension activation 흐름에 대한 통합 테스트를 추가하세요.
- `McpClient`, `WebviewMessageHandler`, agent adapter에 대한 mocking 기반 테스트를 추가하세요.
- MCP 응답 형태를 더 방어적으로 검증해야 합니다.

### 보안 / 운영 위생

- 가능하면 API 키를 query string에 넣지 않는 편이 좋습니다. query param은 프록시나 로그에 남을 가능성이 더 높습니다.
- 로그 출력 시 민감값을 기본적으로 마스킹하는 것을 고려하세요.
- 외부 요청 실패 시 retry/backoff 또는 더 구체적인 timeout 메시지를 제공하면 운영성이 좋아집니다.

## 권장 개선 순서

1. 타입 체크 실패를 해결하고 `npm run typecheck`를 추가합니다.
2. 로그 clear, Figma 결과 표시, 명령 실패 반환 등 host/webview 계약을 바로잡습니다.
3. `WebviewMessageHandler`의 static 공유 상태를 제거합니다.
4. 프롬프트 생성과 토큰 추정을 하나의 로직으로 통합합니다.
5. `defaultAgent`와 `codex` 관련 설정-런타임 불일치를 해소합니다.
6. 로딩, 성공, 실패, 취소 흐름을 포함한 UX 상태를 보강합니다.
7. 메시지 처리, MCP transport, agent 동작에 대한 테스트를 확장합니다.

## 바로 실행할 수 있는 작업 목록

- `FigmaLayer.onDataResult()`와 `FigmaLayer.onScreenshotResult()`를 구현하거나, `main.ts`의 해당 호출을 제거합니다.
- `typecheck` 스크립트를 추가하고 build/CI에서 실패 시 차단되도록 합니다.
- `event: 'log.clear'`를 host message union에 추가하고 `LogLayer.clear()`를 구현합니다.
- handler의 static 상태를 명시적 상태 저장소로 대체합니다.
- `PromptBuilder`를 실제 생성과 estimate UI에 연결합니다.
- mock 자동 주입을 제거하고 별도 샘플 액션으로 바꿉니다.
- 동작하지 않는 `npm test`를 실제 테스트 러너로 교체하거나, 준비될 때까지 스크립트를 정리합니다.
