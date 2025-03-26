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

            // Clean the generated code
            const cleanedCode = cleanGeneratedCode(generatedCode, documentLanguage);

            // Apply inline diff and generate decorations
            await applyInlineDiff(editor, selection, cleanedCode);
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
    // Insert the generated code below the selected text
    editBuilder.insert(originalSelection.end, `\n\n${generatedCode}`);
  });

  // Get the range of inserted code
  const document = editor.document;
  const insertedCodeStartLine = originalSelection.end.line + 1; // +2 to skip two newlines
  const insertedCodeEndLine = insertedCodeStartLine + generatedCode.split('\n').length - 1;

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
    placeHolder: 'What would you like to do with the generated code?'
  });

  // Handle user selection
  if (pick === 'Revert Changes') {
    // Remove the inserted code
    await editor.edit(editBuilder => {
      const startPos = new vscode.Position(insertedCodeStartLine - 2, document.lineAt(insertedCodeStartLine - 2).text.length);
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

  // Remove markdown code block syntax
  const codeBlockRegex = new RegExp(`^\`\`\`(?:${language}|javascript|typescript|js|ts|html|css|python|java|c#|c\\+\\+|ruby|go|php|rust|swift|kotlin|scala|shell|bash|sql|json|xml|yaml|plaintext)?\\s*\\n?`);
  cleanedCode = cleanedCode.replace(codeBlockRegex, '');
  
  // Remove trailing code block markers
  cleanedCode = cleanedCode.replace(/\n?```$/g, '');
  
  // Remove inline code markers
  cleanedCode = cleanedCode.replace(/^`|`$/g, '');
  
  // Remove lines that just contain the language name
  const languageLineRegex = new RegExp(`^(?:${language}|javascript|typescript|js|ts|html|css|python|java|c#|c\\+\\+|ruby|go|php|rust|swift|kotlin|scala|shell|bash|sql|json|xml|yaml|plaintext)$`, 'gm');
  cleanedCode = cleanedCode.replace(languageLineRegex, '');

  return cleanedCode;
}