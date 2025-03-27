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
              `Given these requirements or comments:\n\n${selectedText}\n\nGenerate code in ${documentLanguage}. Only provide the code, no explanations also no use of \` or use of any language word in your code.`
            );

            const cleanedCode = cleanGeneratedCode(generatedCode, documentLanguage);

            await applyInlineDiff(editor, selection, cleanedCode);

            vscode.window.showInformationMessage('Code generation completed!');
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

// Create decorations for inline diff
async function applyInlineDiff(
  editor: vscode.TextEditor,
  originalSelection: vscode.Selection,
  generatedCode: string
) {
  // Create decoration types
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
    editBuilder.insert(originalSelection.end, `\n\n${generatedCode}`);
  });

  const document = editor.document;
  const insertedCodeStartLine = originalSelection.end.line + 1; 
  const insertedCodeEndLine = insertedCodeStartLine + generatedCode.split('\n').length - 1;

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
    placeHolder: 'What would you like to do with the generated code?'
  });

  if (pick === 'Revert Changes') {
    await editor.edit(editBuilder => {
      const startPos = new vscode.Position(insertedCodeStartLine - 2, document.lineAt(insertedCodeStartLine - 2).text.length);
      const endPos = new vscode.Position(insertedCodeEndLine, document.lineAt(insertedCodeEndLine).text.length);
      editBuilder.delete(new vscode.Range(startPos, endPos));
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