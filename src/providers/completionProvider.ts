import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';

export class GeminiCompletionProvider implements vscode.CompletionItemProvider {
    private _geminiApi: GeminiApi;
    private _lastRequestTime: number = 0;
    private _cooldownPeriod: number = 50; // Reduced to 50ms for more responsiveness
    private _inlineCompletionProvider?: vscode.Disposable;
    private _context: vscode.ExtensionContext;

    constructor(geminiApi: GeminiApi, context: vscode.ExtensionContext) {
        this._geminiApi = geminiApi;
        this._context = context;
        this._registerInlineCompletionProvider();
    }

    private _registerInlineCompletionProvider() {
        // Register the inline completion provider (ghost text)
        this._inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**' }, // All files
            {
                provideInlineCompletionItems: async (document, position, context, token) => {
                    // Check if we should throttle requests
                    const now = Date.now();
                    if (now - this._lastRequestTime < this._cooldownPeriod) {
                        return null;
                    }

                    try {
                        // Get API key (if not set, don't bother)
                        const apiKey = await this._geminiApi.getApiKey();
                        if (!apiKey) {
                            return null;
                        }

                        // Get context around cursor
                        const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
                        const prevLines = this._getPreviousLines(document, position, 10);
                        const contextText = prevLines.join('\n') + linePrefix;

                        // Skip if we don't have enough context
                        if (contextText.trim().length < 3) { // Reduced from 5 to 3 for more suggestions
                            return null;
                        }

                        this._lastRequestTime = now;

                        // Get completion suggestion from Gemini
                        const completionText = await this._geminiApi.getCodeCompletion(
                            document,
                            position,
                            contextText
                        );

                        if (!completionText || token.isCancellationRequested) {
                            return null;
                        }

                        // Create inline completion item
                        const item = new vscode.InlineCompletionItem(
                            completionText,
                            new vscode.Range(position, position)
                        );
                        
                        // Add command to let users know they can press Tab
                        item.command = {
                            title: 'Tab to accept',
                            command: '' // This is just for showing the message
                        };

                        return [item];
                    } catch (error) {
                        console.error('Error getting inline completion:', error);
                        return null;
                    }
                }
            }
        );

        // Add to context subscriptions so it gets disposed when the extension is deactivated
        this._context.subscriptions.push(this._inlineCompletionProvider);
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | null> {
        // Regular completion items will still be available
        // but now we also have inline completions (ghost text)
        const now = Date.now();
        if (now - this._lastRequestTime < this._cooldownPeriod) {
            return null;
        }

        try {
            // Get API key (if not set, don't bother)
            const apiKey = await this._geminiApi.getApiKey();
            if (!apiKey) {
                return null;
            }

            // Get context around cursor
            const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
            const prevLines = this._getPreviousLines(document, position, 10);
            const contextText = prevLines.join('\n') + linePrefix;

            // Skip if we don't have enough context
            if (contextText.trim().length < 3) {
                return null;
            }

            this._lastRequestTime = now;

            // Get completion suggestion from Gemini
            const completionText = await this._geminiApi.getCodeCompletion(
                document,
                position,
                contextText
            );

            if (!completionText || token.isCancellationRequested) {
                return null;
            }

            // Create completion item
            const completionItem = new vscode.CompletionItem(
                completionText,
                vscode.CompletionItemKind.Text
            );

            completionItem.insertText = completionText;
            completionItem.detail = 'Gemini suggestion';
            completionItem.documentation = new vscode.MarkdownString('AI-generated code suggestion from Gemini. Press Tab to accept.');
            completionItem.sortText = '0000'; // Sort at top of suggestion list
            
            // Add command to trigger acceptance of the suggestion
            completionItem.command = {
                command: 'editor.action.insertSnippet',
                title: 'Accept suggestion',
                arguments: [{ snippet: completionText }]
            };

            return [completionItem];
        } catch (error) {
            console.error('Error getting completion:', error);
            return null;
        }
    }

    // This function should be called when the extension is deactivated
    dispose() {
        if (this._inlineCompletionProvider) {
            this._inlineCompletionProvider.dispose();
        }
    }

    private _getPreviousLines(
        document: vscode.TextDocument,
        position: vscode.Position,
        maxLines: number
    ): string[] {
        const result: string[] = [];
        let currentLine = position.line;

        while (currentLine > 0 && result.length < maxLines) {
            currentLine--;
            result.unshift(document.lineAt(currentLine).text);
        }

        return result;
    }
}