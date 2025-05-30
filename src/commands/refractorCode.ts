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

                        await applyInlineDiff(editor, editor.selection, cleanedCode, selectedText)

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

async function applyInlineDiff(
    editor: vscode.TextEditor,
    originalSelection: vscode.Selection,
    generatedCode: string,
    selectedText: string
) {
    const addedLineDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(46, 164, 79, 0.15)', 
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(46, 164, 79, 0.4)', 
    });

    const diffAdditionDecorationType = vscode.window.createTextEditorDecorationType({
        before: {
            contentText: '+',
            color: 'rgba(46, 164, 79, 0.7)', 
            margin: '0 5px 0 0'
        }
    });

    await editor.edit(editBuilder => {
        editBuilder.replace(originalSelection, `${generatedCode}`);
    });

    const document = editor.document;
    const insertedCodeStartLine = originalSelection.start.line;
    const insertedCodeEndLine = insertedCodeStartLine + generatedCode.split('\n').length;

    const addedLineRanges = [];
    const diffAdditionRanges = [];

    for (let lineNum = insertedCodeStartLine; lineNum <= insertedCodeEndLine; lineNum++) {
        const lineRange = document.lineAt(lineNum).range;
        addedLineRanges.push(lineRange);
        diffAdditionRanges.push(lineRange);
    }

    editor.setDecorations(addedLineDecorationType, addedLineRanges);
    editor.setDecorations(diffAdditionDecorationType, diffAdditionRanges);

    const pick = await vscode.window.showQuickPick(['Accept Changes', 'Revert Changes'], {
        placeHolder: 'What would you like to do with the refracted code?'
    });

    if (pick === 'Revert Changes') {
        await editor.edit(editBuilder => {
            editBuilder.replace(originalSelection, `\n${selectedText}`);
        });
    }

    editor.setDecorations(addedLineDecorationType, []);
    editor.setDecorations(diffAdditionDecorationType, []);
    
    await vscode.commands.executeCommand('editor.action.formatDocument');
}

function cleanGeneratedCode(code: string, language: string): string {
    let cleanedCode = code.trim();
    const codeBlockRegex = new RegExp(`^\`\`\`(?:${language}|javascript|typescript|js|ts|html|css|python|java|c#|c\\+\\+|ruby|go|php|rust|swift|kotlin|scala|shell|bash|sql|json|xml|yaml|plaintext)?\\s*\\n?`);
    cleanedCode = cleanedCode.replace(codeBlockRegex, '');
    cleanedCode = cleanedCode.replace(/\n?```$/g, '');

    cleanedCode = cleanedCode.replace(/^`|`$/g, '');
    const languageLineRegex = new RegExp(`^(?:${language}|javascript|typescript|js|ts|html|css|python|java|c#|c\\+\\+|ruby|go|php|rust|swift|kotlin|scala|shell|bash|sql|json|xml|yaml|plaintext)$`, 'gm');
    cleanedCode = cleanedCode.replace(languageLineRegex, '');

    return cleanedCode;
}