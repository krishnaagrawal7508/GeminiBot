import * as vscode from 'vscode';
import * as https from 'https';

export interface GeminiResponse {
    candidates: {
        content: {
            parts: {
                text: string;
            }[];
        };
    }[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export class GeminiApi {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get API key from extension storage
     */
    public async getApiKey(): Promise<string | undefined> {
        return this.context.globalState.get<string>('geminiApiKey');
    }

    /**
     * Save API key to extension storage
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.globalState.update('geminiApiKey', apiKey);
    }

    /**
     * Send prompt to Gemini API and get response
     */
    public async getCompletion(prompt: string): Promise<string> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('API key not set');
        }

        return this.callGeminiApi(apiKey, prompt);
    }

    /**
     * Get code completion suggestions
     */
    public async getCodeCompletion(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: string
    ): Promise<string> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('API key not set');
        }

        const fileExtension = document.fileName.split('.').pop() || '';
        const languageId = document.languageId;

        const prompt = `
    I'm coding in ${languageId} (file extension: ${fileExtension}).
    Here's the code context (previous code followed by cursor position):
    
    ${context}
    
    Provide a single, short completion suggestion for what should come next after the cursor position.
    Only include the completion text itself, no explanations or formatting.
    Keep it brief, max 1-2 lines.
    `;

        return this.callGeminiApi(apiKey, prompt);
    }

    /**
     * Get response for chat conversation
     */
    public async getChatResponse(messages: ChatMessage[]): Promise<string> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('API key not set');
        }

        // Format messages for Gemini
        const conversationContext = messages.map(msg =>
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');

        const prompt = `
    Here's our conversation so far:
    
    ${conversationContext}
    
    Assistant: 
    `;

        return this.callGeminiApi(apiKey, prompt);
    }

    /**
     * Helper function to call Gemini API using native https module
     */
    private callGeminiApi(apiKey: string, prompt: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            });

            const options = {
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = https.request(options, res => {
                let responseData = '';

                res.on('data', chunk => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            const parsedData = JSON.parse(responseData) as GeminiResponse;
                            if (parsedData.candidates && parsedData.candidates.length > 0) {
                                resolve(parsedData.candidates[0].content.parts[0].text);
                            } else {
                                reject(new Error('No response candidates found'));
                            }
                        } else {
                            reject(new Error(`Request failed with status code ${res.statusCode}: ${responseData}`));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', error => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }
}