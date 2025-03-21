import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { ChatPanelProvider } from './views/chatPanel/chatPanel';
import { GeminiCompletionProvider } from './providers/completionProvider';
import { GeminiApi } from './api/geminiApi';

export async function activate(context: vscode.ExtensionContext) {
	console.log('GeminiBot extension activated successfully!');

	// Initialize the API client
	const geminiApi = new GeminiApi(context);

	// Register chat panel view
	const chatPanelProvider = new ChatPanelProvider(context, geminiApi);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatPanelProvider.viewType,
			chatPanelProvider
		)
	);

	// Register all commands
	registerCommands(context, geminiApi, chatPanelProvider);

	// Register completion provider for all languages
	const config = vscode.workspace.getConfiguration('geminibot');
	if (config.get<boolean>('enableAutoComplete')) {

		const completionProvider = new GeminiCompletionProvider(geminiApi, context);

		context.subscriptions.push(
			vscode.languages.registerCompletionItemProvider(
				['javascript', 'typescript', 'python', 'java', 'html', 'css'],
				completionProvider,
			)
		);
	}

	// Listen for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('geminibot.enableAutoComplete')) {
				vscode.window.showInformationMessage(
					'GeminiBot: Reload window to apply auto-complete configuration changes'
				);
			}
		})
	);
}

export function deactivate() {
	console.log('Extension deactivated. Cleaning up resources.');
}