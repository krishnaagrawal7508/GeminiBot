import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { ChatPanelProvider } from './views/chatPanel/chatPanel';
import { GeminiCompletionProvider } from './providers/completionProvider';
import { GeminiApi } from './api/geminiApi';

export async function activate(context: vscode.ExtensionContext) {
	try {
		console.log('GeminiBot extension activated successfully!');

		const geminiApi = new GeminiApi(context);

		const chatPanelProvider = new ChatPanelProvider(context, geminiApi);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(
				ChatPanelProvider.viewType,
				chatPanelProvider
			)
		);
		registerCommands(context, geminiApi, chatPanelProvider);

		const config = vscode.workspace.getConfiguration('geminibot');
		if (config.get<boolean>('enableAutoComplete')) {

			const completionProvider = new GeminiCompletionProvider(geminiApi, context);

			context.subscriptions.push(
				vscode.languages.registerCompletionItemProvider(
					['javascript', 'typescript', 'python', 'java', 'html', 'css', 'text', 'rust', 'go'],
					completionProvider,
				)
			);
		}

		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration('geminibot.enableAutoComplete')) {
					vscode.window.showInformationMessage(
						'GeminiBot: Reload window to apply auto-complete configuration changes'
					);
				}
			})
		);
	} catch (error) {
        console.error('Extension activation failed:', error);
        vscode.window.showErrorMessage(`GeminiBot failed to activate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function deactivate() {
	console.log('Extension deactivated. Cleaning up resources.');
}