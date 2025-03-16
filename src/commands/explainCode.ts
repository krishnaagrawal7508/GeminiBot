import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';
import { showResultInWebview } from '../views/webviewUtils';

export function registerExplainCodeCommand(
    context: vscode.ExtensionContext,
    geminiApi: GeminiApi
): vscode.Disposable {
    return vscode.commands.registerCommand('geminibot.explainCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText) {
            vscode.window.showErrorMessage('No code selected');
            return;
        }

        try {
            const apiKey = await geminiApi.getApiKey();
            if (!apiKey) {
                vscode.window.showErrorMessage('Gemini API key not set. Use \'Set Gemini API Key\' command first.');
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Explaining code...',
                    cancellable: false,
                },
                async () => {
                    try {
                        const explanation = await geminiApi.getCompletion(
                            `Explain the following code in detail:\n\n${selectedText}`
                        );

                        // Show explanation in a webview
                        showResultInWebview(explanation, 'Code Explanation');
                    } catch (error) {
                        let errorMessage = 'Error explaining code';
                        if (error instanceof Error) {
                            errorMessage = error.message;
                        }
                        console.error('Error explaining code:', error);
                        vscode.window.showErrorMessage(`Failed to explain code: ${errorMessage}`);
                    }
                }
            );
        } catch (error) {
            console.error('Error in explainCode command:', error);
            vscode.window.showErrorMessage('An error occurred while explaining code');
        }
    });
}