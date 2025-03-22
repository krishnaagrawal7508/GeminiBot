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
        console.log(this.context.globalState.get<string>('geminiApiKey'));
        return this.context.globalState.get<string>('geminiApiKey');
    }

    /**
     * Save API key to extension storage
     */
    public async setApiKey(apiKey: string | undefined): Promise<void> {
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
     * Get code completion suggestions with proper formatting
    */
    public async getCodeCompletion(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: string,
        nextText: string = '',
        nextLines: string[] = []
    ): Promise<string> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('API key not set');
        }

        // Get editor configuration
        const editorConfig = vscode.workspace.getConfiguration('editor', document.uri);
        const useSpaces = editorConfig.get<boolean>('insertSpaces', true);
        const tabSize = editorConfig.get<number>('tabSize', 4);
        const indentType = useSpaces ? 'spaces' : 'tabs';

        const fileExtension = document.fileName.split('.').pop() || '';
        const languageId = document.languageId;

        // Get the current line's indentation
        const currentLine = document.lineAt(position.line).text;
        const indentMatch = currentLine.match(/^(\s*)/);
        const currentIndent = indentMatch ? indentMatch[1] : '';

        // Additional code context after cursor
        const afterCursorContext = nextText.length > 0 || nextLines.length > 0 ?
            `\nText after cursor on current line: ${nextText}\nFollowing lines:\n${nextLines.join('\n')}` : '';

        const prompt = `
            I'm coding in ${languageId} (file extension: ${fileExtension}).
            Editor settings: Using ${indentType} with tabSize=${tabSize}.
            Here's the code context (previous code followed by cursor position, marked with |):
            ${context}|${afterCursorContext}
            Provide a single code completion suggestion for what should come immediately after the cursor position.
            Important formatting rules:
            1. Respect the current indentation level
            2. If adding new lines, maintain proper indentation based on code structure
            3. Use ${indentType} for indentation (${tabSize} ${useSpaces ? 'spaces' : 'tab characters'} per level)
            4. Follow standard ${languageId} code style and formatting conventions
            5. For multi-line completions, each line should have appropriate indentation
            Only include the completion text itself, no explanations or comments.
            Keep it concise but complete, maximum 10 lines.
        `;

        try {
            const completion = await this.callGeminiApi(apiKey, prompt);

            // Clean up any extraneous text that might have been included
            return this.cleanCompletionText(completion);
        } catch (error) {
            console.error('Error getting completion from Gemini:', error);
            throw error;
        }
    }

    /**
     * Clean completion text to ensure it's properly formatted
     */
    private cleanCompletionText(text: string): string {
        // Remove markdown code blocks if present
        text = text.replace(/```(?:\w+)?\n([\s\S]*?)\n```/g, '$1');

        // Remove any "Here's a completion" type of text
        text = text.replace(/^(?:here(?:'s| is)(?: a| the)? (?:completion|suggestion)(?::)?|I suggest:)\s*/i, '');

        // Remove trailing "Hope this helps" type of text
        text = text.replace(/\n(?:hope this helps|let me know if you need anything else).*$/i, '');

        return text.trim();
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

        const prompt = `Here's our conversation so far:
            ${conversationContext}
        Assistant: `;

        return this.callGeminiApi(apiKey, prompt);
    }

    /**
     * Helper function to call Gemini API using native https module
     */
    private callGeminiApi(apiKey: string, prompt: string): Promise<string> {

        const config = vscode.workspace.getConfiguration('GeminiBot');

        const model = config.get<string>('model');
        const temperature = config.get<number>('temperature');
        const topK = config.get<number>('top_k');
        const topP = config.get<number>('top_p');

        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: temperature,
                    topP: topP,
                    topK: topK,
                }
            });

            const options = {
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
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