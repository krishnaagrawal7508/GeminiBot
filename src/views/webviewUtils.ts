import * as vscode from 'vscode';

export function showResultInWebview(content: string, title: string) {
    const panel = vscode.window.createWebviewPanel(
        'geminiResult',
        title,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { 
          font-family: var(--vscode-font-family); 
          padding: 20px; 
          line-height: 1.5;
          color: var(--vscode-foreground);
        }
        pre { 
          background-color: var(--vscode-editor-background); 
          padding: 10px; 
          border-radius: 5px; 
          overflow: auto;
          font-family: var(--vscode-editor-font-family);
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
      ${formatContent(content)}
    </body>
    </html>
  `;
}

function formatContent(content: string): string {
    // Convert markdown-style code blocks to HTML
    let formattedContent = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_, language, code) => {
        return `<pre><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
    });

    // Convert line breaks to <br> tags
    formattedContent = formattedContent.replace(/\n/g, '<br>');

    return formattedContent;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}