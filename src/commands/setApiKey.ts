import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';

export function registerSetApiKeyCommand(
  context: vscode.ExtensionContext,
  geminiApi: GeminiApi
): vscode.Disposable {
  return vscode.commands.registerCommand('geminibot.setApiKey', async () => {
    console.log('GeminiBot: setApiKey command triggered!');
    
    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Gemini API Key',
      ignoreFocusOut: true,
      password: true,
    });
    
    if (apiKey) {
      await geminiApi.setApiKey(apiKey);
      vscode.window.showInformationMessage('Gemini API Key saved!');
      console.log('Gemini API Key saved successfully!');
    } else {
      console.log('Gemini API Key input was canceled.');
    }
  });
}