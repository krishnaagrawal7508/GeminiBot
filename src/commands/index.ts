import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';
import { ChatPanelProvider } from '../views/chatPanel/chatPanel';
import { registerExplainCodeCommand } from './explainCode';
import { registerGenerateCodeCommand } from './generateCode';
import { registerRefactorCodeCommand } from './refractorCode';
import { registerSetApiKeyCommand } from './setApiKey';
import { registerRemoveApiKeyCommand } from './removeApiKey';
import { registerOpenSettingsCommand } from './openSettings';
import { registerOpenPanelCommand } from './openPanel';

export function registerCommands(
  context: vscode.ExtensionContext,
  geminiApi: GeminiApi,
  chatPanelProvider: ChatPanelProvider
) {
  // Register all commands
  context.subscriptions.push(
    registerSetApiKeyCommand(context, geminiApi),
    registerExplainCodeCommand(context, geminiApi),
    registerGenerateCodeCommand(context, geminiApi),
    registerRefactorCodeCommand(context, geminiApi),
    registerRemoveApiKeyCommand(context, geminiApi),
    registerOpenSettingsCommand(),
    registerOpenPanelCommand(),
    
    // Register clear chat command
    vscode.commands.registerCommand('geminibot.clearChat', () => {
      chatPanelProvider.clearChat();
    })
  );
}