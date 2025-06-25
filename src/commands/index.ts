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
import { registerToggleLiveAPICommand } from './toggleLiveAPI';

export function registerCommands(
  context: vscode.ExtensionContext,
  geminiApi: GeminiApi,
  chatPanelProvider: ChatPanelProvider
) {
  try {
    console.log('Registering extension commands...');

    const commands = [
      registerSetApiKeyCommand(context, geminiApi),
      registerExplainCodeCommand(context, geminiApi),
      registerGenerateCodeCommand(context, geminiApi),
      registerRefactorCodeCommand(context, geminiApi),
      registerRemoveApiKeyCommand(context, geminiApi),
      registerOpenSettingsCommand(),  
      registerOpenPanelCommand(),   
      registerToggleLiveAPICommand(context, geminiApi, chatPanelProvider),
      
      vscode.commands.registerCommand('geminibot.clearChat', () => {
        try {
          console.log('Clearing chat...');
          chatPanelProvider.clearChat();
        } catch (error) {
          console.error('Error clearing chat:', error);
          vscode.window.showErrorMessage('Failed to clear chat');
        }
      })
    ];

    context.subscriptions.push(...commands);

    console.log('All commands registered successfully');
  } catch (error) {
    console.error('Failed to register commands:', error);
    vscode.window.showErrorMessage('GeminiBot: Failed to register commands');
  }
}