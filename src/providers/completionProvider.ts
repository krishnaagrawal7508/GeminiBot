import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';

export class GeminiCompletionProvider implements vscode.CompletionItemProvider {
    private _geminiApi: GeminiApi;
    private _lastRequestTime: number = 0;
    private _cooldownPeriod: number = 20; 
    private _inlineCompletionProvider?: vscode.Disposable;
    private _context: vscode.ExtensionContext;
    private _minContextLength: number = 1; 

    constructor(geminiApi: GeminiApi, context: vscode.ExtensionContext) {
        this._geminiApi = geminiApi;
        this._context = context;
        this._registerInlineCompletionProvider();
    }

    private _registerInlineCompletionProvider() {
        this._inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**' }, 
            {
                provideInlineCompletionItems: async (document, position, context, token) => {
                    const now = Date.now();
                    if (now - this._lastRequestTime < this._cooldownPeriod) {
                        return null;
                    }

                    try {
                        const apiKey = await this._geminiApi.getApiKey();
                        if (!apiKey) {
                            return null;
                        }
                        const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
                        const nextPart = document.lineAt(position.line).text.substring(position.character);
                        const prevLines = this._getPreviousLines(document, position, 15);
                        const nextLines = this._getNextLines(document, position, 5); 
                        const contextText = prevLines.join('\n') + linePrefix;

                        if (contextText.trim().length < this._minContextLength) {
                            return null;
                        }

                        this._lastRequestTime = now;

                        const rawCompletionText = await this._geminiApi.getCodeCompletion(
                            document,
                            position,
                            contextText,
                            nextPart,
                            nextLines  
                        );

                        if (!rawCompletionText || token.isCancellationRequested) {
                            return null;
                        }

                        const completionText = this._formatCompletionText(
                            document,
                            position,
                            rawCompletionText,
                            linePrefix
                        );

                        const item = new vscode.InlineCompletionItem(
                            completionText,
                            new vscode.Range(position, position)
                        );
                        
                        item.command = {
                            title: 'Tab to accept',
                            command: '' 
                        };

                        return [item];
                    } catch (error) {
                        console.error('Error getting inline completion:', error);
                        return null;
                    }
                }
            }
        );

        this._context.subscriptions.push(this._inlineCompletionProvider);
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | null> {
        const now = Date.now();
        if (now - this._lastRequestTime < this._cooldownPeriod) {
            return null;
        }

        try {
            const apiKey = await this._geminiApi.getApiKey();
            if (!apiKey) {
                return null;
            }

            const linePrefix = document.lineAt(position.line).text.substring(0, position.character);
            const nextPart = document.lineAt(position.line).text.substring(position.character);
            const prevLines = this._getPreviousLines(document, position, 15);
            const nextLines = this._getNextLines(document, position, 5);
            const contextText = prevLines.join('\n') + linePrefix;

            if (contextText.trim().length < this._minContextLength) {
                return null;
            }

            this._lastRequestTime = now;

            const rawCompletionText = await this._geminiApi.getCodeCompletion(
                document,
                position,
                contextText,
                nextPart,
                nextLines
            );

            if (!rawCompletionText || token.isCancellationRequested) {
                return null;
            }

            const completionText = this._formatCompletionText(
                document,
                position,
                rawCompletionText,
                linePrefix
            );

            const completionItem = new vscode.CompletionItem(
                completionText.split('\n')[0], 
                vscode.CompletionItemKind.Text
            );

            completionItem.insertText = completionText;
            completionItem.detail = 'Gemini suggestion';
            completionItem.documentation = new vscode.MarkdownString('AI-generated code suggestion from Gemini. Press Tab to accept.');
            completionItem.sortText = '0000';
            
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

    private _formatCompletionText(
        document: vscode.TextDocument,
        position: vscode.Position,
        completionText: string,
        linePrefix: string
    ): string {
        const editorConfig = vscode.workspace.getConfiguration('editor', document.uri);
        const useSpaces = editorConfig.get<boolean>('insertSpaces', true);
        const tabSize = editorConfig.get<number>('tabSize', 4);
        
        const currentIndent = this._getIndentation(linePrefix);
        const currentIndentLevel = this._getIndentLevel(currentIndent, tabSize, useSpaces);
        
        const completionLines = completionText.split('\n');
        
        if (completionLines.length === 1) {
            return completionText;
        }
        
        for (let i = 1; i < completionLines.length; i++) {
            let line = completionLines[i];
            if (line.trim().length > 0) {
                const lineIndent = this._getIndentation(line);
                const lineIndentLevel = this._getIndentLevel(lineIndent, tabSize, useSpaces);
                
                const relativeIndentLevel = Math.max(lineIndentLevel, currentIndentLevel);
                
                const properIndent = this._createIndentation(relativeIndentLevel, tabSize, useSpaces);
                completionLines[i] = properIndent + line.trimLeft();
            }
        }
        
        return completionLines.join('\n');
    }

    private _getIndentLevel(indent: string, tabSize: number, useSpaces: boolean): number {
        if (useSpaces) {
            return Math.floor(indent.length / tabSize);
        } else {
            return indent.split('\t').length - 1;
        }
    }

    private _createIndentation(level: number, tabSize: number, useSpaces: boolean): string {
        if (useSpaces) {
            return ' '.repeat(level * tabSize);
        } else {
            return '\t'.repeat(level);
        }
    }

    private _getIndentation(line: string): string {
        const match = line.match(/^(\s*)/);
        return match ? match[1] : '';
    }

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

    private _getNextLines(
        document: vscode.TextDocument,
        position: vscode.Position,
        maxLines: number
    ): string[] {
        const result: string[] = [];
        let currentLine = position.line;
        const lastLine = document.lineCount - 1;

        while (currentLine < lastLine && result.length < maxLines) {
            currentLine++;
            result.push(document.lineAt(currentLine).text);
        }

        return result;
    }
}