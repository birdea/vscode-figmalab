import * as esbuild from 'esbuild';
import { OutputFormat } from '../types';
import { buildPreviewDocument } from './PreviewRenderer';

export interface PreviewPanelContent {
  title: string;
  html: string;
}

export async function buildPreviewPanelContent(
  code: string,
  cspSource: string,
  preferredFormat?: OutputFormat,
): Promise<PreviewPanelContent> {
  if (shouldUseRuntimePreview(code, preferredFormat)) {
    try {
      return await buildRuntimePreviewContent(code, cspSource);
    } catch (error) {
      const preview = buildPreviewDocument(code, preferredFormat);
      preview.warnings = [
        `Runtime preview failed and fell back to static rendering: ${toMessage(error)}`,
        ...preview.warnings,
      ];
      return {
        title: preview.title,
        html: buildStaticPanelHtml(preview.title, preview.description, preview.warnings, preview.html, cspSource),
      };
    }
  }

  const preview = buildPreviewDocument(code, preferredFormat);
  return {
    title: preview.title,
    html: buildStaticPanelHtml(
      preview.title,
      preview.description,
      preview.warnings,
      preview.html,
      cspSource,
    ),
  };
}

function shouldUseRuntimePreview(code: string, preferredFormat?: OutputFormat): boolean {
  if (preferredFormat === 'tsx') {
    return true;
  }

  return /from\s+['"]react['"]/.test(code) || /className\s*=/.test(code);
}

async function buildRuntimePreviewContent(
  code: string,
  cspSource: string,
): Promise<PreviewPanelContent> {
  const bundle = await buildReactPreviewBundle(code);
  return {
    title: 'React / TSX Preview',
    html: buildRuntimePanelHtml(
      'React / TSX Preview',
      'Rendered with a lightweight React runtime preview.',
      ['Single-file React output is executed directly inside the preview panel.'],
      bundle,
      cspSource,
    ),
  };
}

async function buildReactPreviewBundle(code: string): Promise<string> {
  const buildResult = await esbuild.build({
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    plugins: [
      {
        name: 'preview-virtual-modules',
        setup(build) {
          build.onResolve({ filter: /^virtual:preview-app$/ }, () => ({
            path: 'virtual:preview-app',
            namespace: 'preview',
          }));

          build.onLoad({ filter: /^virtual:preview-app$/, namespace: 'preview' }, () => ({
            contents: code,
            loader: 'tsx',
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import * as PreviewModule from 'virtual:preview-app';

        const rootElement = document.getElementById('root');
        const errorElement = document.getElementById('runtime-error');

        function showError(message) {
          if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
          }
        }

        function resolveComponent(moduleValue) {
          const candidate =
            moduleValue?.default ??
            moduleValue?.AppLayout ??
            moduleValue?.App ??
            moduleValue;

          if (!candidate) {
            throw new Error('No previewable React component export was found.');
          }

          return candidate;
        }

        try {
          const AppComponent = resolveComponent(PreviewModule);
          if (!rootElement) {
            throw new Error('Preview root element was not found.');
          }

          const root = createRoot(rootElement);
          const element = React.isValidElement(AppComponent)
            ? AppComponent
            : React.createElement(AppComponent);
          root.render(element);
        } catch (error) {
          showError(error instanceof Error ? error.message : String(error));
        }
      `,
      loader: 'tsx',
      sourcefile: 'preview-entry.tsx',
      resolveDir: process.cwd(),
    },
  });

  return buildResult.outputFiles[0]?.text ?? '';
}

function buildRuntimePanelHtml(
  title: string,
  description: string,
  warnings: string[],
  bundle: string,
  cspSource: string,
): string {
  const warningItems = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${cspSource} data: blob: http://localhost:3845 https:; font-src ${cspSource}; connect-src http://localhost:3845 https:;"
  />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
    }
    .meta {
      padding: 12px 14px;
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 55%, transparent);
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
    }
    .meta h1 {
      margin: 0 0 4px;
      font-size: 13px;
    }
    .meta p {
      margin: 0;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .meta ul {
      margin: 8px 0 0;
      padding-left: 18px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    #runtime-error {
      display: none;
      margin: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 99, 71, 0.45);
      background: rgba(255, 99, 71, 0.12);
      color: #ffb4a5;
      font-size: 12px;
    }
    #root {
      min-height: calc(100vh - 74px);
      overflow: auto;
      background: white;
    }
  </style>
</head>
<body>
  <div class="meta">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <ul>${warningItems}</ul>
  </div>
  <div id="runtime-error"></div>
  <div id="root"></div>
  <script>${bundle}</script>
</body>
</html>`;
}

function buildStaticPanelHtml(
  title: string,
  description: string,
  warnings: string[],
  previewHtml: string,
  cspSource: string,
): string {
  const warningItems = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
  const warningBlock = warningItems ? `<ul class="warnings">${warningItems}</ul>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data: blob: http://localhost:3845 https:; font-src ${cspSource}; frame-src 'self' data:;"
  />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
    }
    .shell {
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 100vh;
    }
    .meta {
      padding: 12px 14px;
      border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 55%, transparent);
      background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
    }
    .meta h1 {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 600;
    }
    .meta p {
      margin: 0;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .warnings {
      margin: 8px 0 0;
      padding-left: 18px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    iframe {
      width: 100%;
      height: calc(100vh - 74px);
      border: 0;
      background: white;
    }
    .unsupported {
      padding: 20px 14px;
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="meta">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      ${warningBlock}
    </div>
    <iframe sandbox="allow-same-origin" srcdoc="${escapeAttribute(previewHtml)}"></iframe>
  </div>
</body>
</html>`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\n/g, '&#10;');
}
