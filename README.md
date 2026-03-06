# FigmaLab

VS Code extension for pulling Figma MCP context into the editor and generating UI code with AI agents.

## What It Does

- Connects to a Figma MCP server over JSON-RPC
- Parses Figma URLs or JSON payloads into `fileId` / `nodeId`
- Fetches Figma data and opens the JSON result in VS Code
- Fetches screenshots and opens the image in the editor
- Generates UI code with Gemini or Claude
- Inserts generated code into the active editor or saves it as a new file
- Streams operational logs into a dedicated Log view

## Current Status

Implemented today in this repository:

- Figma MCP connect / tool listing
- Figma data fetch
- Figma screenshot fetch
- Gemini model listing and code generation
- Claude static model list and code generation
- Prompt composition with output formats: `tsx`, `html`, `scss`, `tailwind`, `kotlin`
- Editor insertion and save-as flow
- Webview-based Figma / Agent / Prompt / Log panels

Not fully implemented or still inconsistent:

- `codex` appears in some types/configuration paths, but there is no Codex agent implementation
- `figmalab.defaultAgent` exists in settings but is not currently applied in the UI/host flow
- The `npm test` script is broken because the referenced VS Code test runner file does not exist

## Project Structure

```text
src/
  agent/      AI agent adapters and factory
  editor/     VS Code editor/file integration
  figma/      MCP client, parser, screenshot service
  logger/     Output channel + in-memory log store
  prompt/     Prompt construction and token estimation helpers
  webview/    Sidebar providers, message bridge, UI
  extension.ts
```

## Requirements

- Node.js 18+
- VS Code 1.85+
- A running Figma MCP server
- At least one API key:
  - Gemini: Google AI Studio
  - Claude: Anthropic Console

## Install

```bash
npm install
```

## Development

Build once:

```bash
npm run build
```

Watch mode:

```bash
npm run watch
```

Lint:

```bash
npm run lint
```

Package extension:

```bash
npm run package
```

## Mock MCP Server

The repository includes a local mock server for UI development:

```bash
node mock-mcp-server.js
```

Default endpoint:

```text
http://localhost:3845
```

The mock server supports:

- `initialize`
- `tools/list`
- `tools/call` for `get_file`
- `tools/call` for `get_image`

## How To Use

1. Build the extension with `npm run build`
2. Launch the extension in VS Code Extension Development Host
3. Open the `FigmaLab` activity bar container
4. In the `Figma` view, connect to your MCP endpoint
5. Paste a Figma URL or JSON payload
6. Fetch data or screenshot
7. In the `Agent` view, save an API key and load a model
8. In the `Prompt` view, choose an output format and generate code
9. Insert the result into the current file or save it as a new file

## Configuration

Available settings from `package.json`:

- `figmalab.mcpEndpoint`: MCP endpoint, default `http://localhost:3845`
- `figmalab.defaultAgent`: declared setting, but not wired into runtime behavior yet

## Verification

Verified locally:

- `npm run build`
- `npm run lint`

Not passing:

- `npm test`
  - Fails because `out/test/runTest.js` is missing from the repository
