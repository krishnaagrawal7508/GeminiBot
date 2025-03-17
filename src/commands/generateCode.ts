import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';

export function registerGenerateCodeCommand(
    context: vscode.ExtensionContext,
    geminiApi: GeminiApi
): vscode.Disposable {
    return vscode.commands.registerCommand('geminibot.generateCode', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText) {
            vscode.window.showErrorMessage('No comments selected');
            return;
        }

        try {
            const apiKey = await geminiApi.getApiKey();
            if (!apiKey) {
                vscode.window.showErrorMessage('Gemini API key not set. Use \'Set Gemini API Key\' command first.');
                return;
            }

            const documentLanguage = editor.document.languageId;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating code...',
                    cancellable: false,
                },
                async () => {
                    try {
                        const generatedCode = await geminiApi.getCompletion(
                            `Given these requirements or comments:\n\n${selectedText}\n\nGenerate code in ${documentLanguage}. Only provide the code, 
                            no explanations also no use of \` or use of any language word in your code.`
                        );

                        // Insert code below the selected comment
                        editor.edit(editBuilder => {
                            editBuilder.insert(selection.end, `\n\n${generatedCode}`);
                        });

                    } catch (error) {
                        let errorMessage = 'Error generating code';
                        if (error instanceof Error) {
                            errorMessage = error.message;
                        }
                        console.error('Error generating code:', error);
                        vscode.window.showErrorMessage(`Failed to generate code: ${errorMessage}`);
                    }
                }
            );
        } catch (error) {
            console.error('Error in generateCode command:', error);
            vscode.window.showErrorMessage('An error occurred while generating code');
        }
    });
}
