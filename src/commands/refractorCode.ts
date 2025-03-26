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
                        await applyInlineDiff(editor, editor.selection, cleanedCode)

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

// Create decorations for inline diff
async function applyInlineDiff(
    editor: vscode.TextEditor,
    originalSelection: vscode.Selection,
    generatedCode: string
) {
    // Create decoration types
    const addedLineDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(46, 164, 79, 0.15)', // Light green background
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(46, 164, 79, 0.4)', // Green border
    });

    const diffAdditionDecorationType = vscode.window.createTextEditorDecorationType({
        before: {
            contentText: '+',
            color: 'rgba(46, 164, 79, 0.7)', // Green '+' symbol
            margin: '0 5px 0 0'
        }
    });

    // Prepare the edit
    await editor.edit(editBuilder => {
        editBuilder.replace(originalSelection, `\n\n${generatedCode}`);
    });

    // Get the range of inserted code
    const document = editor.document;
    const insertedCodeStartLine = originalSelection.start.line;
    const insertedCodeEndLine = insertedCodeStartLine + generatedCode.split('\n').length;

    // Create ranges for decorations
    const addedLineRanges = [];
    const diffAdditionRanges = [];

    for (let lineNum = insertedCodeStartLine; lineNum <= insertedCodeEndLine; lineNum++) {
        const lineRange = document.lineAt(lineNum).range;
        addedLineRanges.push(lineRange);
        diffAdditionRanges.push(lineRange);
    }

    // Apply decorations
    editor.setDecorations(addedLineDecorationType, addedLineRanges);
    editor.setDecorations(diffAdditionDecorationType, diffAdditionRanges);

    // Create quick pick for accepting or reverting changes
    const pick = await vscode.window.showQuickPick(['Accept Changes', 'Revert Changes'], {
        placeHolder: 'What would you like to do with the refracted code?'
    });

    // Handle user selection
    if (pick === 'Revert Changes') {
        // Remove the inserted code
        await editor.edit(editBuilder => {
            const startPos = new vscode.Position(insertedCodeStartLine, document.lineAt(insertedCodeStartLine).text.length);
            const endPos = new vscode.Position(insertedCodeEndLine, document.lineAt(insertedCodeEndLine).text.length);
            editBuilder.delete(new vscode.Range(startPos, endPos));
        });
    }

    // Clear decorations after action
    editor.setDecorations(addedLineDecorationType, []);
    editor.setDecorations(diffAdditionDecorationType, []);
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