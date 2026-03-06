# FigmaAgent — AI 기반 Figma MCP 결과물 웹 렌더링 서비스 개발 계획서

---

## 1. 개요

Figma Desktop App의 Local MCP Server와 AI Agent(Google Gemini)를 연결하여,
디자인 컨텍스트 데이터 + 사용자 프롬프트를 AI에게 전달하고,
생성된 코드(HTML/CSS/React)를 웹 페이지에서 **즉시 미리보기** 할 수 있는 서비스를 개발한다.

기존 MFA 프로젝트(`figmalab-app`, port 3005)의 신규 뷰로 추가한다.
`figmalab-app` 상단 listview 그리드에 **`Figma(Agent)` 버튼**을 추가하고,
해당 버튼 클릭 시 FigmaAgent 화면이 content 영역에 렌더링된다.

---

## 2. 기술 타당성 검토

### 2.1 Figma Local MCP Server

| 항목 | 내용 |
|------|------|
| 서버 주소 | `http://localhost:3845` (Figma Desktop App 실행 시 자동 기동) |
| 근거 | 기존 `FigmaFull.tsx` / `FigmaPart.tsx` 에서 이미 사용 중 |
| 데이터 취득 방식 | ① **수동 붙여넣기** — 사용자가 Figma MCP 컨텍스트 JSON 텍스트를 직접 입력 ② **직접 fetch** — `GET http://localhost:3845/...` 브라우저 직접 호출 (same-machine이므로 CORS 제한 없음) |
| 판정 | **구현 가능** — 방식 ①을 기본으로, 방식 ②를 보조로 지원 |

### 2.2 AI Agent API 연동

#### 2.2.1 Gemini (Google Generative AI)

| 항목 | 내용 |
|------|------|
| API | `https://generativelanguage.googleapis.com/v1beta/...` |
| 브라우저 직접 호출 | CORS 허용 여부가 키 노출 위험과 맞물림 → **BFF 프록시 서버 경유 권장** |
| 모델 | `gemini-3-flash` (기본값) / `gemini-3.1-pro`, `gemini-3-pro`, `gemini-2.5-pro`, `gemini-2.5-flash-lite` 선택 가능 |
| 판정 | **구현 가능** — BFF 프록시 추가 필요 |

#### 2.2.2 API 키 보안

브라우저에서 API 키를 직접 사용하면 노출 위험이 있다.
→ **BFF(Backend-for-Frontend) 프록시 서버** 방식으로 해결.

```
[Browser: figmalab-app]
       |
       | POST /api/ai/generate  (MCP data + prompt)
       v
[BFF Proxy Server: port 3006]   ← Gemini API 키 서버 사이드 보관
       |
       └─ Gemini API  (gemini-2.0-flash)
```

### 2.3 AI 생성 결과물 웹 렌더링

| 방식 | 설명 | 보안 | 난이도 |
|------|------|------|--------|
| `<iframe srcdoc="...">` | AI가 반환한 HTML 문자열을 iframe에 직접 주입 | sandbox 속성으로 격리 가능 | 낮음 |
| `eval()` / `new Function()` | JS 코드 직접 실행 | XSS 위험 | 중간 |
| Babel Standalone + React | React JSX를 브라우저에서 트랜스파일 | 복잡 | 높음 |

> **채택**: `<iframe srcdoc>` + `sandbox="allow-scripts allow-same-origin"` 방식.
> AI에게 **완전한 HTML 문서**(`<!DOCTYPE html>…`)를 생성하도록 프롬프트 설계.

### 2.4 최종 타당성 판정

**구현 가능** — 신규 BFF 프록시 서버(Node.js/Express, port 3006) 추가가 핵심 조건.
기존 MFA 아키텍처 변경 없이 `figmalab-app` 내 신규 뷰로 추가 가능.

---

## 3. 시스템 아키텍처

```
study_biznews/
├── host-app/                  (port 3000) — 라우팅 추가 불필요 (이미 /figmalab 존재)
├── figmalab-app/              (port 3005) — 신규 뷰 FigmaAgent 추가
│   └── src/
│       ├── App.tsx            — LIST_ITEMS에 FigmaAgent 항목 추가
│       └── components/
│           ├── FigmaAgent/
│           │   ├── index.tsx              — 메인 컨테이너
│           │   ├── ControlLayer.tsx       — 제어 레이어 (fold 포함)
│           │   │   ├── AgentSetupPanel.tsx    — AI 에이전트 설정
│           │   │   ├── FigmaMcpPanel.tsx      — Figma MCP 연동 설정
│           │   │   └── InputPanel.tsx         — MCP 데이터 + 프롬프트 입력
│           │   ├── ContentLayer.tsx       — 결과 렌더링 레이어
│           │   │   ├── StatusBar.tsx          — 진행 상태 표시
│           │   │   └── PreviewFrame.tsx       — iframe 렌더링
│           │   └── FigmaAgent.module.scss
│
└── proxy-server/              (port 3006) — 신규 패키지 (BFF)
    ├── package.json
    └── src/
        └── index.ts           — Express 프록시 서버
```

### 진입 흐름

```
figmalab-app (port 3005) — /figmalab 라우트
  │
  ├─ listview 그리드 (App.tsx > LIST_ITEMS)
  │   ├─ [Figma(Full)]    → FigmaFull 컴포넌트  (기존)
  │   ├─ [Figma(Part)]    → FigmaPart 컴포넌트  (기존)
  │   └─ [Figma(Agent)]   → FigmaAgent 컴포넌트 (신규) ← 이 버튼 클릭 시 진입
  │
  └─ content 영역
      └─ activeId === 'figma-agent' 일 때 FigmaAgent 렌더링
```

**상태 관리**: Jotai (기존 프로젝트와 동일)
**스타일링**: SCSS Modules (기존 패턴 유지)

---

## 4. 화면 구조 설계

### 4.0 figmalab-app 전체 레이아웃 (진입점 포함)

```
┌─────────────────────────────────────────────────────────────────────┐
│  listview (App.tsx)                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │
│  │ Figma(Full) │  │ Figma(Part) │  │  ★ Figma(Agent)  ← 신규   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  content 영역 — activeId === 'figma-agent' 일 때 아래 화면 렌더링   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  CONTROL LAYER                               [ ▲ Fold Control ]    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                                     │
│  ┌─── AI Agent Setup (Google Gemini) ─────────────────────────────┐ │
│  │  Gemini API Token: [____________________________] [Show/Hide]  │ │
│  │  Model: [ gemini-3-flash ▼ ]                                   │ │
│  │    ├ gemini-3.1-pro      (최고 성능, Preview)                   │ │
│  │    ├ gemini-3-pro        (고성능, GA)                           │ │
│  │    ├ gemini-3-flash      (기본값 — 속도·비용 균형)               │ │
│  │    ├ gemini-2.5-pro      (안정, 장문 컨텍스트)                   │ │
│  │    └ gemini-2.5-flash-lite (저비용)                             │ │
│  │  Local App 연동 URL (선택): [___________________]              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─── Figma MCP 연동 ──────────────────────────────────────────────┐ │
│  │  Figma Desktop App → Local MCP: localhost:3845  [● Connected]  │ │
│  │  Node ID (선택): [__________]  [Fetch from Figma]              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─── Input ──────────────────────────────────────────────────────┐ │
│  │  Figma MCP Data (붙여넣기):                                     │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  { "type": "FRAME", "name": "...", ... }                 │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │  Additional Prompt:                                             │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  React + Tailwind CSS로 구현해줘                          │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                          [ Submit ▶ ]          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│ ─ ─ ─ ─ ─ ─ ─ ─  CONTENT LAYER  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                                     │
│  Status: [● Generating...] / [✓ Done] / [✗ Error: ...]            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │   <iframe srcdoc="AI Generated HTML">                       │  │
│  │                                                              │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  [▼ Show Source Code]  [↻ Regenerate]  [⬇ Download HTML]          │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.1 Fold 동작

- Control Layer 전체를 `max-height` + CSS transition으로 접고 펼침
- Fold 상태는 Jotai atom으로 전역 관리

### 4.2 AI Agent 설정

- AI Agent는 **Google Gemini** 고정
- **모델 선택** — 드롭다운으로 아래 5종 중 선택, 기본값 `gemini-3-flash`

| 모델 ID | 티어 | 특징 |
|---------|------|------|
| `gemini-3.1-pro` | Preview | 최고 성능, 멀티모달 추론, 복잡한 UI 구현에 최적 |
| `gemini-3-pro` | GA | 고성능, 1M 토큰 컨텍스트, 장문 MCP 데이터 처리에 유리 |
| `gemini-3-flash` | Preview/Default | **기본값** — 속도·비용 균형, 코딩·아젠틱 워크플로우에 적합 |
| `gemini-2.5-pro` | Stable | 안정적, 장문 컨텍스트, 재현성이 중요한 작업에 적합 |
| `gemini-2.5-flash-lite` | Stable | 저비용·저지연, 간단한 컴포넌트 생성에 적합 |

> `gemini-2.0-flash` 계열은 2026년 6월 deprecated 예정이므로 목록에서 제외.

- Gemini API Token은 sessionStorage에만 임시 저장 (localStorage 미사용 — 보안)
- 선택한 모델 ID는 BFF 프록시 서버로 전달되어 API 호출에 사용
- Local App 연동 URL은 선택 입력 항목으로 제공 (향후 확장 대비)

### 4.3 Figma MCP 연동 패널

| 항목 | 설명 |
|------|------|
| 연결 상태 표시 | `GET http://localhost:3845/ping` 또는 `GET http://localhost:3845/api/v1/version` 으로 상태 확인 |
| Node ID 입력 | Figma 디자인 URL의 `node-id` 파라미터 값 입력 |
| Fetch 버튼 | 직접 MCP API 호출해서 MCP Data 입력창에 자동 채움 |

---

## 5. BFF 프록시 서버 설계 (`proxy-server`)

### 5.1 엔드포인트

```
POST /api/ai/generate
  Body: {
    apiKey: string,          // Gemini API 키 (클라이언트에서 전달, 서버에 저장 안 함)
    model: string,           // 선택한 Gemini 모델 ID (예: 'gemini-3-flash')
    mcpData: string,         // Figma MCP JSON 문자열
    prompt: string,          // 사용자 추가 프롬프트
    localAppUrl?: string     // 로컬 앱 연동 URL (선택)
  }
  Response: {
    html: string,            // AI 생성 완전한 HTML 문서
    rawResponse: string      // 원본 AI 응답 텍스트
  }

GET /api/figma/status
  Response: { connected: boolean, version?: string }
```

### 5.2 AI 프롬프트 템플릿

```
[System]
You are an expert frontend developer. Given Figma design context data (MCP format)
and a user instruction, generate a COMPLETE, SELF-CONTAINED HTML document
(<!DOCTYPE html> ... </html>) that visually implements the design.
- Use inline CSS or a CDN (TailwindCSS, etc.) — no build step required.
- Include all images as base64 or use placeholder SVGs.
- The output MUST be a single HTML file renderable in an iframe srcdoc attribute.

[User]
## Figma MCP Data
{mcpData}

## Additional Instructions
{prompt}
```

### 5.3 기술 스택

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "cors": "^2.8.x",
    "@google/generative-ai": "^0.21.x"
  }
}
```

---

## 6. 개발 단계별 계획

### Phase 1 — 기반 인프라 구축

**목표**: BFF 프록시 서버 + figmalab-app 라우팅 추가

| 작업 | 파일 | 설명 |
|------|------|------|
| proxy-server 패키지 생성 | `proxy-server/` | Express + CORS + ts-node 셋업 |
| root package.json 수정 | `package.json` | `dev:proxy`, `dev` 스크립트에 proxy-server 추가 |
| Gemini API 연동 | `proxy-server/src/gemini.ts` | gemini-2.0-flash 호출 |
| API route 구현 | `proxy-server/src/index.ts` | POST /api/ai/generate |
| figmalab-app 버튼 추가 | `figmalab-app/src/App.tsx` | LIST_ITEMS에 `{ id: 'figma-agent', label: 'Figma(Agent)', component: FigmaAgent }` 추가 |

### Phase 2 — Control Layer UI 구현

**목표**: 설정 패널과 입력 폼 완성

| 작업 | 파일 | 설명 |
|------|------|------|
| Jotai atoms 정의 | `figmalab-app/src/components/FigmaAgent/atoms.ts` | apiKey, selectedModel, mcpData, prompt, controlFolded 등 |
| FigmaAgent 메인 컨테이너 | `FigmaAgent/index.tsx` | Control + Content 레이어 조합 |
| AgentSetupPanel | `AgentSetupPanel.tsx` | Gemini API Token 입력, 모델 선택 드롭다운, 로컬 앱 연동 URL |
| FigmaMcpPanel | `FigmaMcpPanel.tsx` | 연결 상태, Node ID 입력, Fetch 버튼 |
| InputPanel | `InputPanel.tsx` | MCP Data textarea, Prompt textarea, Submit 버튼 |
| Fold 기능 | `ControlLayer.tsx` | max-height transition + Jotai atom |
| SCSS 스타일링 | `FigmaAgent.module.scss` | 전체 레이아웃 및 컴포넌트 스타일 |

### Phase 3 — Content Layer UI 구현

**목표**: AI 응답을 받아 iframe으로 렌더링

| 작업 | 파일 | 설명 |
|------|------|------|
| Submit 핸들러 | `InputPanel.tsx` | proxy-server POST 호출, loading 상태 관리 |
| StatusBar | `StatusBar.tsx` | idle / loading / success / error 상태 표시 |
| PreviewFrame | `PreviewFrame.tsx` | `<iframe srcdoc sandbox>` + 오토 리사이즈 |
| Source Code 토글 | `ContentLayer.tsx` | HTML 소스 코드 펼치기/접기 + syntax highlight |
| Download 버튼 | `ContentLayer.tsx` | Blob + URL.createObjectURL으로 HTML 파일 저장 |

### Phase 4 — Figma MCP 직접 연동 (선택)

**목표**: Figma Desktop App MCP 서버에서 데이터 자동 취득

| 작업 | 파일 | 설명 |
|------|------|------|
| 연결 상태 확인 | `FigmaMcpPanel.tsx` | GET localhost:3845 ping 폴링 |
| Node ID fetch | `proxy-server/src/figma.ts` | Figma MCP REST 엔드포인트 호출 후 클라이언트에 반환 |

---

## 7. 핵심 구현 이슈 및 해결 방안

### 7.1 API 키 보안

- sessionStorage에만 저장, 페이지 닫으면 삭제
- 서버 측 환경 변수(`.env`)로도 설정 가능하도록 옵션 제공
- `apiKey`는 HTTPS 또는 localhost에서만 전송

### 7.2 AI 응답이 HTML이 아닌 경우

- AI 응답에서 코드 블록(` ```html ... ``` `)을 정규식으로 추출
- `<!DOCTYPE html>` 감지 실패 시 템플릿으로 래핑
- 실패 시 사용자에게 재시도 안내

### 7.3 iframe 렌더링 보안

```html
<iframe
  srcdoc={generatedHtml}
  sandbox="allow-scripts allow-same-origin"
  referrerpolicy="no-referrer"
/>
```

- `allow-scripts` 만 허용 — 외부 네트워크 차단, 팝업 차단
- Content-Security-Policy 헤더로 추가 격리

### 7.4 Figma 로컬 이미지 자산

- `localhost:3845/assets/...` URL은 iframe 내부에서 접근 가능 (same-machine)
- AI 프롬프트에 이미지 URL을 포함시켜 그대로 사용 가능
- 오프라인 또는 Figma 앱 미실행 시: placeholder SVG로 대체

### 7.5 응답 스트리밍

- Phase 3 완성 후 스트리밍 지원 고려 (Gemini streaming API)
- 현재는 단건 응답으로 구현 후 UX 확인

---

## 8. 프로젝트 파일 구조 (최종)

```
study_biznews/
├── proxy-server/                    ← 신규
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 ← Express 서버 (port 3006)
│       ├── gemini.ts                ← Gemini API 클라이언트
│       └── figma.ts                 ← Figma MCP 연동 (Phase 4)
│
├── figmalab-app/
│   └── src/
│       ├── App.tsx                  ← 수정: FigmaAgent 추가
│       └── components/
│           ├── FigmaFull.tsx        ← 기존 유지
│           ├── FigmaPart.tsx        ← 기존 유지
│           └── FigmaAgent/          ← 신규
│               ├── index.tsx
│               ├── atoms.ts
│               ├── ControlLayer.tsx
│               │   ├── AgentSetupPanel.tsx
│               │   ├── FigmaMcpPanel.tsx
│               │   └── InputPanel.tsx
│               ├── ContentLayer.tsx
│               │   ├── StatusBar.tsx
│               │   └── PreviewFrame.tsx
│               └── FigmaAgent.module.scss
│
└── package.json                     ← 수정: proxy-server dev 스크립트 추가
```

---

## 9. 포트 맵

| 서비스 | 포트 | 비고 |
|--------|------|------|
| host-app | 3000 | 기존 |
| dashboard-app | 3001 | 기존 |
| todo-app | 3002 | 기존 |
| notes-app | 3003 | 기존 |
| pomodoro-app | 3004 | 기존 |
| figmalab-app | 3005 | 기존 |
| **proxy-server** | **3006** | **신규** |
| Figma MCP (Local) | 3845 | Figma Desktop App 자동 기동 |

---

## 10. 개발 시작 전 준비 사항

1. **Figma Desktop App** 설치 및 실행 확인 (`localhost:3845` 접근 가능 여부)
2. **Gemini API 키 발급**
   - Google AI Studio: https://aistudio.google.com
3. **Node.js 버전** >= 20.0.0 (기존 `.nvmrc` 준수)

---

_작성일: 2026-02-26_
