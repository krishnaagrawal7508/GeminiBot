import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';

export class GeminiCompletionProvider implements vscode.CompletionItemProvider {
    private _geminiApi: GeminiApi;
    private _lastRequestTime: number = 0;
    private _cooldownPeriod: number = 1000; // 1 second cooldown between requests

    constructor(geminiApi: GeminiApi) {
        this._geminiApi = geminiApi;
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | null> {
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
            if (contextText.trim().length < 5) {
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
            completionItem.detail = 'Gemini suggestion';
            completionItem.documentation = new vscode.MarkdownString('AI-generated code suggestion from Gemini');
            completionItem.sortText = '0000'; // Sort at top of suggestion list

            return [completionItem];
        } catch (error) {
            console.error('Error getting completion:', error);
            return null;
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