import * as vscode from 'vscode';
import { marked } from 'marked';

export function showResultInWebview(content: string, title: string) {
  const panel = vscode.window.createWebviewPanel(
    'geminiResult',
    title,
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = getWebviewContent(content, title);
}

function getWebviewContent(content: string, title: string): string {
  const formattedContent = marked.parse(content);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
      <style>
        body { 
          font-family: var(--vscode-font-family); 
          padding: 20px; 
          line-height: 1.5;
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
        }
        pre { 
          background-color: var(--vscode-editor-background); 
          padding: 10px; 
          border-radius: 5px; 
          overflow: auto;
          font-family: var(--vscode-editor-font-family);
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        code {
          font-family: var(--vscode-editor-font-family);
        }
        h1, h2, h3 { 
          color: var(--vscode-editor-foreground);
        }
      </style>
    </head>
    <body>
      ${formattedContent}
      <script>hljs.highlightAll();</script>
    </body>
    </html>
  `;
}