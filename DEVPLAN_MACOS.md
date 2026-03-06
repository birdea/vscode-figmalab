# iFigmaLab: VSCode Plugin 포팅 개발 명세서

## 1. 개요 및 목적

### 1.1 목적
현재 웹 애플리케이션(React + Cloudflare Workers) 형태로 구현된 **iFigmaLab**을 **VSCode 확장 프로그램(Plugin)** 으로 포팅합니다.
이를 통해 개발자는 웹 브라우저와 에디터를 오가는 컨텍스트 스위칭 없이, VSCode 내부에서 직접 Figma 디자인(Design Context, Screenshot)을 불러오고 Gemini API를 활용하여 코드를 생성/적용할 수 있습니다.

### 1.2 주요 차이점 및 이점
- **환경의 변화**: 브라우저(샌드박스) 환경에서 VSCode Extension Host(Node.js) + Webview 환경으로 전환됩니다.
- **CORS 제약 해소**: Extension Host는 Node.js 환경에서 동작하므로 브라우저단에서 발생했던 `mcp.figma.com` CORS 제약이 없습니다. 따라서 Cloudflare Workers를 경유하던 MCP 통신을 Extension Host에서 직접 처리할 수 있습니다.
- **에디터 통합**: 생성된 결과를 단순 복사하는 것을 넘어, 활성화된 문서에 코드를 바로 삽입하거나 새로운 파일로 저장하는 VSCode 내장 FileSystem API와 연동할 수 있습니다.

---

## 2. 아키텍처 설계 (Architecture)

### 2.1 아키텍처 비교

**AS-IS (iFigmaLab Web)**:
`Browser (React)` ↔ `Cloudflare Workers (OAuth + MCP Proxy)` ↔ `Figma (Remote MCP)` / `Gemini API`

**TO-BE (VSCode Plugin)**:
```text
VSCode Application
 ├── Webview (React UI)
 │    ├─ 기존 iFigmaLab UI 재활용
 │    └─ 메시지 브릿지 (vscode.postMessage)
 │         ↕ (IPC 양방향 통신)
 └── Extension Host (Node.js)
      ├─ Figma Remote MCP 직접 연결 (@modelcontextprotocol/sdk)
      ├─ Gemini API 통신 (또는 Webview 내에서 통신 유지 가능)
      ├─ VSCode Editor 연동 (파일 쓰기, 코드 삽입)
      └─ Figma OAuth 로직 (UriHandler 기반 콜백 처리)
           ↕ (HTTPS)
      Cloudflare Workers (Token Exchange Only)
           └─ Client Secret을 은닉하기 위해 토큰 교환/갱신(OAuth) 용도로만 유지
```

### 2.2 핵심 컴포넌트 역할

1. **Extension Host (src/extension.ts)**:
   - VSCode 라이프사이클 관리 및 Webview Panel 생성
   - UI(Webview)로부터의 명령(Message) 수신 및 응답 처리
   - 직접적인 API 호출 수행 (Figma Remote MCP 연동)
2. **Webview UI (webview-ui/)**:
   - `iFigmaLab`의 React 컴포넌트를 화면에 렌더링
   - 웹에서의 `fetch` 기반 API 호출을 `vscode.postMessage` 브릿지를 통한 구조로 리팩토링
3. **Authentication (OAuth 플로우)**:
   - 플러그인에서 OAuth 브라우저를 띄운 뒤, VSCode 프로토콜(`vscode://`) 딥링크로 콜백 수신
   - `client_secret`을 플러그인에 하드코딩하는 것은 취약하므로, 기존 구축된 `Cloudflare Workers`의 토큰 발급 API(`/api/figma/oauth/token`)를 그대로 활용하여 토큰을 획득

---

## 3. 포팅 구현 과제 (Key Implementation Tasks)

### 3.1 Webview 연동 및 프론트엔드 리팩토링
- **빌드 시스템 개편**: VSCode Webview에 삽입될 수 있도록 단일 JS/CSS 파일 형태로 번들링하거나, VSCode Webview 리소스 로드 규칙(`webview.asWebviewUri`)에 맞게 절대 경로 설정.
- **API 레이어 IPC 교체**: 
  - 기존 `fetchDesignContext`, `fetchScreenshot` 호출 로직을 Extension Host로 메시지를 보내는 모델로 변경.
  - 예시: `vscode.postMessage({ command: 'fetchScreenshot', url: '...' })`

### 3.2 Figma Remote MCP 직접 연동 (Extension Host)
- VSCode Extension의 메인 런타임은 Node.js이므로 브라우저 CORS 제약이 없습니다.
- 기존 Phase 2에서 작성했던 `Cloudflare Workers`의 `mcpClient.ts` 로직을 Extension Host로 이전하여, 공식 `@modelcontextprotocol/sdk/client/index.js` 패키지를 그대로 사용.

### 3.3 Figma OAuth 인증 플로우 적용 (VSCode 환경)
1. 사용자가 UI에서 'Login with Figma' 클릭
2. Extension이 임의의 State와 PKCE 생성 후 `vscode.env.openExternal(figmaAuthUrl)` 실행하여 외부 브라우저 호출
3. Figma 애플리케이션 콘솔 내에 VSCode 플러그인용 Redirect URI 추가 (`vscode://publisher.ext-name/auth`)
4. Figma 인증 완료 후 사용자가 브라우저에서 `vscode://...` 딥링크 열기 승인 시, `vscode.window.registerUriHandler()`가 Authorization Code 수신
5. Extension이 Cloudflare Workers(`POST /api/figma/oauth/token`)를 호출하여 `access_token` 교환
6. 발급된 토큰은 VSCode의 **SecretStorage** API를 활용하여 안전하게 암호화 보관.

### 3.4 파일 생성 및 코드 적용 기능 추가 (VSCode 특화 기능)
- iFigmaLab에서 생성된 결과물 영역에 **"에디터에 삽입 (Insert at Cursor)"** 또는 **"새 파일로 적용 (Apply as new file)"** 버튼 추가.
- Extension Host에서 `vscode.workspace.applyEdit` 혹은 `vscode.window.activeTextEditor?.edit` 기능을 호출하여 에디터에 자동 반영되도록 향상.

---

## 4. 작업 순서 (Implementation Phases)

### Phase 1: 플러그인 뼈대 및 보일러플레이트 구성
- `yo code` 제너레이터를 활용하여 새로운 VSCode Extension 프로젝트 스캐폴딩 구성
- 웹 프로젝트와 익스텐션 코드를 명확히 분리: `src/` (Extension Host 로직), `webview-ui/` (React 코드)
- React 번들러(Vite 또는 Webpack)와 Extension 번들러(esbuild 또는 tsc)간 빌드 파이프라인 연동

### Phase 2: 인증 기반 구축 (Figma OAuth)
- Figma Developer Console Redirect URI 정보 반영 (VSCode 딥링크)
- Extension Host 내에 `UriHandler` 구현
- Cloudflare Workers 기반의 토큰 교환 테스트 및 VSCode `SecretStorage` 적재 로직 완성
- Webview UI에 인증 상태 전달 구현

### Phase 3: 코어 로직(Ext. Host) 및 IPC 브릿지 구현
- 원격 MCP 프로토콜 연결 모듈(`mcpClient.ts`)을 Extension Host에 이식
- Webview 패널 생성 및 `vscode.postMessage` 양방향 통신 브릿지 셋업
- Gemini 응답을 처리하는 비동기 프록시 스트림 셋업 (Gemini 통신을 브라우저에 둘지, Host에 둘지 결정)

### Phase 4: Frontend UI 포팅 및 테스트
- `iFigmaLab`의 UI 컴포넌트, 상태(Jotai), i18n 번역 파일 등을 `webview-ui` 로 복사 후 이식
- 외부 브라우저 환경에 의존하던 CSS를 VSCode 기본 테마 색상(CSS Variables, `var(--vscode-*)`)과 이질감 없게 연동 작업 (필요 시)
- Figma URL 분석 기반 컨텍스트 요청 기능이 정상적으로 IPC-MCP를 타고 흐르는 지 E2E 테스트

### Phase 5: 플러그인 고도화 및 배포
- 코드 결과문 자동 반영('에디터에 적용') 버튼 추가 및 통합 검증
- `.vsix` 파일 생성을 위한 패키징 (`vsce package`) 진행 및 로컬 확장프로그램 설치 테스트
- 정상 가동 확인 시 VSCode Marketplace 배포 문서 점검

---

## 5. 고려 사항 및 한계점
- **Webview 보안 제약**: 로컬 에셋(이미지, 폰트) 참조 시 반드시 `asWebviewUri` 변환을 이용해야 함.
- **Webview 상태 초기화 방지**: 패널(Tab)이 닫히거나 포커스를 잃으면 React 앱이 언마운트되거나 상태를 상실할 수 있습니다. `acquireVsCodeApi().getState()` / `setState()` 를 사용해 상태를 직렬화(Serialize) 해두거나, 핵심 State를 Extension Host 상단에서 관리하는 것을 권장합니다.
