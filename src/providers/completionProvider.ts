import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';
// You might want to import a formatter library like prettier
// import * as prettier from 'prettier';

export class GeminiCompletionProvider implements vscode.CompletionItemProvider {
    private _geminiApi: GeminiApi;
    private _lastRequestTime: number = 0;
    private _cooldownPeriod: number = 20; // Further reduced to 20ms for more frequent suggestions
    private _inlineCompletionProvider?: vscode.Disposable;
    private _context: vscode.ExtensionContext;
    private _minContextLength: number = 1; // Reduced to 1 character for more suggestions

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
                        const nextPart = document.lineAt(position.line).text.substring(position.character);
                        const prevLines = this._getPreviousLines(document, position, 15); // Increased context
                        const nextLines = this._getNextLines(document, position, 5); // Get following lines too
                        const contextText = prevLines.join('\n') + linePrefix;

                        // Skip if we don't have enough context
                        if (contextText.trim().length < this._minContextLength) {
                            return null;
                        }

                        this._lastRequestTime = now;

                        // Get completion suggestion from Gemini
                        const rawCompletionText = await this._geminiApi.getCodeCompletion(
                            document,
                            position,
                            contextText,
                            nextPart, // Pass next part of current line
                            nextLines  // Pass next lines
                        );

                        if (!rawCompletionText || token.isCancellationRequested) {
                            return null;
                        }

                        // Format the completion text to match current indentation
                        const completionText = this._formatCompletionText(
                            document,
                            position,
                            rawCompletionText,
                            linePrefix
                        );

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
            const nextPart = document.lineAt(position.line).text.substring(position.character);
            const prevLines = this._getPreviousLines(document, position, 15);
            const nextLines = this._getNextLines(document, position, 5);
            const contextText = prevLines.join('\n') + linePrefix;

            // Skip if we don't have enough context
            if (contextText.trim().length < this._minContextLength) {
                return null;
            }

            this._lastRequestTime = now;

            // Get completion suggestion from Gemini
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

            // Format the completion text to match current indentation
            const completionText = this._formatCompletionText(
                document,
                position,
                rawCompletionText,
                linePrefix
            );

            // Create completion item
            const completionItem = new vscode.CompletionItem(
                completionText.split('\n')[0], // Only use first line for label
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

    // Format completion text to match indentation and code style
    private _formatCompletionText(
        document: vscode.TextDocument,
        position: vscode.Position,
        completionText: string,
        linePrefix: string
    ): string {
        // Get editor configuration for indentation
        const editorConfig = vscode.workspace.getConfiguration('editor', document.uri);
        const useSpaces = editorConfig.get<boolean>('insertSpaces', true);
        const tabSize = editorConfig.get<number>('tabSize', 4);
        
        // Get current line indentation
        const currentIndent = this._getIndentation(linePrefix);
        const currentIndentLevel = this._getIndentLevel(currentIndent, tabSize, useSpaces);
        
        // Split the completion into lines
        const completionLines = completionText.split('\n');
        
        // If there's only one line, return it as is
        if (completionLines.length === 1) {
            return completionText;
        }
        
        // Format each line with proper indentation
        for (let i = 1; i < completionLines.length; i++) {
            let line = completionLines[i];
            if (line.trim().length > 0) {
                // Calculate proper indentation for this line
                const lineIndent = this._getIndentation(line);
                const lineIndentLevel = this._getIndentLevel(lineIndent, tabSize, useSpaces);
                
                // Calculate relative indentation
                const relativeIndentLevel = Math.max(lineIndentLevel, currentIndentLevel);
                
                // Apply proper indentation using editor settings
                const properIndent = this._createIndentation(relativeIndentLevel, tabSize, useSpaces);
                completionLines[i] = properIndent + line.trimLeft();
            }
        }
        
        // Here you could integrate with a code formatter like Prettier if desired
        // return this._formatWithPrettier(completionLines.join('\n'), document);
        
        // Join lines back together
        return completionLines.join('\n');
    }

    // Calculate indent level based on spaces/tabs
    private _getIndentLevel(indent: string, tabSize: number, useSpaces: boolean): number {
        if (useSpaces) {
            return Math.floor(indent.length / tabSize);
        } else {
            return indent.split('\t').length - 1;
        }
    }

    // Create proper indentation based on editor settings
    private _createIndentation(level: number, tabSize: number, useSpaces: boolean): string {
        if (useSpaces) {
            return ' '.repeat(level * tabSize);
        } else {
            return '\t'.repeat(level);
        }
    }

    // Get the indentation (whitespace) from the beginning of a line
    private _getIndentation(line: string): string {
        const match = line.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    // Use a formatter library like Prettier (commented out)
    /*
    private _formatWithPrettier(code: string, document: vscode.TextDocument): string {
        try {
            // You would need to install and configure prettier
            // const formatted = prettier.format(code, {
            //     parser: this._getParserForDocument(document),
            //     tabWidth: vscode.workspace.getConfiguration('editor').get('tabSize', 4),
            //     useTabs: !vscode.workspace.getConfiguration('editor').get('insertSpaces', true)
            // });
            // return formatted;
            return code; // Return original code until prettier is implemented
        } catch (error) {
            console.error('Error formatting code:', error);
            return code;
        }
    }

    private _getParserForDocument(document: vscode.TextDocument): string {
        // Map language ID to prettier parser
        const languageId = document.languageId;
        switch (languageId) {
            case 'javascript':
            case 'typescript':
            case 'typescriptreact':
            case 'javascriptreact':
                return 'typescript';
            case 'html':
                return 'html';
            case 'css':
                return 'css';
            case 'json':
                return 'json';
            default:
                return 'babel';
        }
    }
    */

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