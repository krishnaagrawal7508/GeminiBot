import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GeminiApi, ChatMessage } from '../../api/geminiApi';

export class ChatPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'geminibotChatView';

    private _view?: vscode.WebviewView;
    private _geminiApi: GeminiApi;
    private _context: vscode.ExtensionContext;
    private _chatHistory: ChatMessage[] = [];

    constructor(context: vscode.ExtensionContext, geminiApi: GeminiApi) {
        this._context = context;
        this._geminiApi = geminiApi;
        console.log('ChatPanelProvider Initialized !'); 
    }
    
    public resolveWebviewView(
        webviewView: vscode.WebviewView
    ) {
        console.log('resolveWebviewView called'); 
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this._context.extensionPath, 'media')),
                vscode.Uri.file(path.join(this._context.extensionPath, 'src', 'views', 'chatPanel'))
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message:', message); // Debugging log
            switch (message.command) {
                case 'sendMessage':
                    await this.handleUserMessage(message.text);
                    break;
                case 'checkApiKey':
                    await this.checkApiKey();
                    break;
                case 'setApiKey':
                    await this.promptForApiKey();
                    break;
            }
        });

        // Initial load - check API key
        this._view.webview.postMessage({ command: 'checkApiKey' });
    }

    public async clearChat() {
        this._chatHistory = [];
        if (this._view) {
            this._view.webview.postMessage({ command: 'clearChat' });
        }
    }

    private async handleUserMessage(text: string) {
        if (!this._view) {
            return;
        }

        // Add user message to history
        this._chatHistory.push({ role: 'user', content: text });

        try {
            this._view.webview.postMessage({
                command: 'startLoading'
            });

            // Get response from Gemini
            const response = await this._geminiApi.getChatResponse(this._chatHistory);

            // Add response to history
            this._chatHistory.push({ role: 'model', content: response });

            // Send response to webview
            // Send response to webview
            this._view.webview.postMessage({
                command: 'receiveMessage',
                message: response,
                role: 'model'
            });
        } catch (error) {
            let errorMessage = 'Failed to get response';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            this._view.webview.postMessage({
                command: 'error',
                message: errorMessage
            });
        } finally {
            this._view.webview.postMessage({
                command: 'stopLoading'
            });
        }
    }

    private async checkApiKey() {
        if (!this._view) {
            return;
        }

        try {
            const apiKey = await this._geminiApi.getApiKey();
            this._view.webview.postMessage({
                command: 'apiKeyStatus',
                exists: !!apiKey
            });
        } catch (error) {
            console.error('Error checking API key:', error);
        }
    }

    private async promptForApiKey() {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your Gemini API Key',
            ignoreFocusOut: true,
            password: true
        });

        if (apiKey) {
            await this._geminiApi.setApiKey(apiKey);
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'apiKeyStatus',
                    exists: true
                });
                vscode.window.showInformationMessage('Gemini API Key saved!');
            }
        }
    }

    private _getHtmlForWebview() {
        const htmlPath = path.join(this._context.extensionPath, 'src', 'views', 'chatPanel', 'chatView.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Replace ${webview.cspSource} with actual content security policy
        html = html.replace(
            '${webview.cspSource}',
            this._view?.webview.cspSource || 'none'
        );

        return html;
    }
}