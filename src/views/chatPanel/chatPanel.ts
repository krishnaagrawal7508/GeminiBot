import * as vscode from 'vscode';
import * as path from 'path';
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

        this._getHtmlForWebview().then(html => {
            webviewView.webview.html = html;
        }).catch(error => {
            console.error("Failed to load webview HTML:", error);
            webviewView.webview.html = `<h2 style="color: red;">Failed to load chat panel</h2>`;
        });
        
        if (!this._view) {
            console.error("Webview not initialized");
            return;
        }

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
                case 'getWorkspaceFiles':
                    await this.getWorkspaceFiles(message.query);
                    break;
                case 'getFileContent':
                    await this.getFileContent(message.filePath);
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

        // Process file references in the message
        const processedMessage = await this.processFileReferences(text);

        // Add user message to history
        this._chatHistory.push({ role: 'user', content: processedMessage });

        try {
            this._view.webview.postMessage({
                command: 'startLoading'
            });

            // Get response from Gemini
            const response = await this._geminiApi.getChatResponse(this._chatHistory);

            // Add response to history
            this._chatHistory.push({ role: 'model', content: response });

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

    private async processFileReferences(text: string): Promise<string> {
        // Regular expression to match @file_path patterns
        const taggedFileRegex = /@([^\s]+)/g;
        let match;
        let processedText = text;

        while ((match = taggedFileRegex.exec(text)) !== null) {
            const taggedFilePath = match[1];
            try {
                // Get the file content
                const fileContent = await this.getFileContentFromPath(taggedFilePath);

                // Replace the @file_path with a comment indicating the file was included
                processedText = processedText.replace(
                    match[0],
                    `[File: ${taggedFilePath}]\n\`\`\`\n${fileContent}\n\`\`\``
                );
            } catch (error) {
                console.error(`Error processing file reference ${taggedFilePath}:`, error);
            }
        }

        return processedText;
    }

    private async getFileContentFromPath(relativeFilePath: string): Promise<string> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder is open');
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const fileUri = vscode.Uri.file(path.join(workspacePath, relativeFilePath));

        try {
            const fileData = await vscode.workspace.fs.readFile(fileUri);
            return Buffer.from(fileData).toString('utf8');
        } catch (error) {
            throw new Error(`Could not read file ${relativeFilePath}`);
        }
    }

    private async getWorkspaceFiles(query: string) {
        if (!this._view || !vscode.workspace.workspaceFolders) {
            return;
        }

        try {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const files = await vscode.workspace.findFiles('**/*');

            // Filter files based on the query and convert to relative paths
            const filteredFiles = files
                .filter(file => {
                    const relativePath = path.relative(workspaceRoot, file.fsPath);
                    return relativePath.toLowerCase().includes(query.toLowerCase());
                })
                .map(file => {
                    const relativePath = path.relative(workspaceRoot, file.fsPath);
                    return {
                        path: relativePath,
                        name: path.basename(file.fsPath)
                    };
                })
                .slice(0, 10); // Limit results

            this._view.webview.postMessage({
                command: 'workspaceFiles',
                files: filteredFiles
            });
        } catch (error) {
            console.error('Error fetching workspace files:', error);
        }
    }

    private async getFileContent(filePath: string) {
        if (!this._view) {
            return;
        }

        try {
            const content = await this.getFileContentFromPath(filePath);
            this._view.webview.postMessage({
                command: 'fileContent',
                path: filePath,
                content: content
            });
        } catch (error) {
            console.error('Error fetching file content:', error);
            this._view.webview.postMessage({
                command: 'error',
                message: `Could not read file ${filePath}`
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

    private async _getHtmlForWebview(): Promise<string> {
        const htmlUri = vscode.Uri.file(path.join(this._context.extensionPath, 'src', 'views', 'chatPanel', 'chatView.html'));
        try {
            const fileData = await vscode.workspace.fs.readFile(htmlUri);
            let html = Buffer.from(fileData).toString('utf8');

            // Replace ${webview.cspSource} with actual CSP value
            if (this._view) {
                html = html.replace('${webview.cspSource}', this._view.webview.cspSource);
            }

            return html;
        } catch (error) {
            throw new Error('Failed to load chatView.html');
        }
    }
}