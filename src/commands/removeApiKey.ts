import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';

export function registerRemoveApiKeyCommand(
    context: vscode.ExtensionContext,
    geminiApi: GeminiApi
): vscode.Disposable {
    return vscode.commands.registerCommand('geminibot.removeApiKey', async () => {
        console.log('GeminiBot: removeApiKey command triggered!');

        const apiKey = await geminiApi.getApiKey();
        if (apiKey == undefined) {
            vscode.window.showInformationMessage('No Gemini API Key Found!');
            console.log('Gemini API Key removed successfully!');
        }
        else {
            await geminiApi.setApiKey(undefined);
            vscode.window.showInformationMessage('No Gemini API Key Found!');
            console.log('Gemini API Key removed successfully!');
        } 
    });
}