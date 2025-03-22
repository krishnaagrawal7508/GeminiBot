import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';

export function registerOpenSettingsCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('geminibot.openSettings', async () => {
        await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'GeminiBot'
        );
    });
}