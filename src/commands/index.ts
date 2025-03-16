import * as vscode from 'vscode';
import { GeminiApi } from '../api/geminiApi';
import { ChatPanelProvider } from '../views/chatPanel/chatPanel';
import { registerExplainCodeCommand } from './explainCode';
import { registerGenerateCodeCommand } from './generateCode';
import { registerRefactorCodeCommand } from './refractorCode';
import { registerSetApiKeyCommand } from './setApiKey';

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
    
    // Register clear chat command
    vscode.commands.registerCommand('geminibot.clearChat', () => {
      chatPanelProvider.clearChat();
    })
  );
}