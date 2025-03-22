import * as vscode from 'vscode';

export function registerOpenPanelCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('geminibot.openPanel', () => {
        vscode.commands.executeCommand('workbench.action.quickOpen', '>GeminiBot');
    });
}