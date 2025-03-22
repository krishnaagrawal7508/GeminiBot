import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';

export function registerRefactorCodeCommand(
    context: vscode.ExtensionContext,
    geminiApi: GeminiApi
): vscode.Disposable {
    return vscode.commands.registerCommand('geminibot.refactorCode', async () => {
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

            const documentLanguage = editor.document.languageId;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Refactoring code...',
                    cancellable: false,
                },
                async () => {
                    try {
                        const refactoredCode = await geminiApi.getCompletion(
                            `Refactor the following ${documentLanguage} code to improve readability, performance, and follow best practices. Only provide the refactored code, no explanations:\n\n${selectedText}`
                        );

                        const cleanedCode = cleanGeneratedCode(refactoredCode, documentLanguage);

                        // Replace the selected text with the refactored code
                        await editor.edit(editBuilder => {
                            editBuilder.replace(editor.selection, cleanedCode);
                        });

                        vscode.window.showInformationMessage('Code refactoring completed!');
                    } catch (error) {
                        let errorMessage = 'Error refactoring code';
                        if (error instanceof Error) {
                            errorMessage = error.message;
                        }
                        console.error('Error refactoring code:', error);
                        vscode.window.showErrorMessage(`Failed to refactor code: ${errorMessage}`);
                    }
                }
            );
        } catch (error) {
            console.error('Error in refactorCode command:', error);
            vscode.window.showErrorMessage('An error occurred while refactoring code');
        }
    });
}

function cleanGeneratedCode(code: string, language: string): string {
    let cleanedCode = code.trim();

    // Remove markdown code block syntax with language identifier
    const codeBlockRegex = new RegExp(`^\`\`\`(?:${language}|javascript|typescript|js|ts|html|css|python|java|c#|c\\+\\+|ruby|go|php|rust|swift|kotlin|scala|shell|bash|sql|json|xml|yaml|plaintext)?\\s*\\n?`);
    cleanedCode = cleanedCode.replace(codeBlockRegex, '');

    // Remove trailing code block markers
    cleanedCode = cleanedCode.replace(/\n?```$/g, '');

    // Remove inline code markers
    cleanedCode = cleanedCode.replace(/^`|`$/g, '');

    // Remove lines that just contain the language name (e.g., "javascript" or "typescript")
    const languageLineRegex = new RegExp(`^(?:${language}|javascript|typescript|js|ts|html|css|python|java|c#|c\\+\\+|ruby|go|php|rust|swift|kotlin|scala|shell|bash|sql|json|xml|yaml|plaintext)$`, 'gm');
    cleanedCode = cleanedCode.replace(languageLineRegex, '');

    return cleanedCode;
}