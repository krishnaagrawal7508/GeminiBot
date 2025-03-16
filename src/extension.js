"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
async function activate(context) {
    console.log("GeminiBot extension activated successfully!");
    // Command to set API key
    let setApiKeyCommand = vscode.commands.registerCommand("geminibot.setApiKey", async () => {
        console.log("GeminiBot: setApiKey command triggered!");
        const apiKey = await vscode.window.showInputBox({
            prompt: "Enter your Gemini API Key",
            ignoreFocusOut: true,
            password: true,
        });
        if (apiKey) {
            await context.globalState.update("geminiApiKey", apiKey);
            vscode.window.showInformationMessage("Gemini API Key saved!");
            console.log("Gemini API Key saved successfully!");
        }
        else {
            console.log("Gemini API Key input was canceled.");
        }
    });
    // Command to explain selected code
    let explainCodeCommand = vscode.commands.registerCommand("geminibot.explainCode", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
        }
        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText) {
            vscode.window.showErrorMessage("No code selected");
            return;
        }
        const apiKey = context.globalState.get("geminiApiKey");
        if (!apiKey) {
            vscode.window.showErrorMessage("Gemini API key not set. Use 'Set Gemini API Key' command first.");
            return;
        }
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Explaining code...",
            cancellable: false,
        }, async () => {
            try {
                const explanation = await getGeminiResponse(apiKey, `Explain the following code in detail:\n\n${selectedText}`);
                // Show explanation in a webview
                showResultInWebview(explanation, "Code Explanation");
            }
            catch (error) {
                console.error("Error explaining code:", error);
                vscode.window.showErrorMessage("Failed to explain code. Check console for details.");
            }
        });
    });
    // Command to generate code from comments
    let generateCodeCommand = vscode.commands.registerCommand("geminibot.generateCode", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
        }
        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText) {
            vscode.window.showErrorMessage("No comments selected");
            return;
        }
        const apiKey = context.globalState.get("geminiApiKey");
        if (!apiKey) {
            vscode.window.showErrorMessage("Gemini API key not set. Use 'Set Gemini API Key' command first.");
            return;
        }
        const documentLanguage = editor.document.languageId;
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating code...",
            cancellable: false,
        }, async () => {
            try {
                const generatedCode = await getGeminiResponse(apiKey, `Given these requirements or comments:\n\n${selectedText}\n\nGenerate code in ${documentLanguage}. Only provide the code, no explanations.`);
                // Create a new document with the generated code
                const document = await vscode.workspace.openTextDocument({
                    content: generatedCode,
                    language: documentLanguage
                });
                await vscode.window.showTextDocument(document);
            }
            catch (error) {
                console.error("Error generating code:", error);
                vscode.window.showErrorMessage("Failed to generate code. Check console for details.");
            }
        });
    });
    // Command to refactor selected code
    let refactorCodeCommand = vscode.commands.registerCommand("geminibot.refactorCode", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
        }
        const selectedText = editor.document.getText(editor.selection);
        if (!selectedText) {
            vscode.window.showErrorMessage("No code selected");
            return;
        }
        const apiKey = context.globalState.get("geminiApiKey");
        if (!apiKey) {
            vscode.window.showErrorMessage("Gemini API key not set. Use 'Set Gemini API Key' command first.");
            return;
        }
        const documentLanguage = editor.document.languageId;
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Refactoring code...",
            cancellable: false,
        }, async () => {
            try {
                const refactoredCode = await getGeminiResponse(apiKey, `Refactor the following ${documentLanguage} code to improve readability, performance, and follow best practices. Only provide the refactored code, no explanations:\n\n${selectedText}`);
                // Replace the selected text with the refactored code
                editor.edit(editBuilder => {
                    editBuilder.replace(editor.selection, refactoredCode);
                });
            }
            catch (error) {
                console.error("Error refactoring code:", error);
                vscode.window.showErrorMessage("Failed to refactor code. Check console for details.");
            }
        });
    });
    // Helper function to show results in webview
    function showResultInWebview(content, title) {
        const panel = vscode.window.createWebviewPanel("geminiResult", title, vscode.ViewColumn.Beside, { enableScripts: true });
        panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          pre { background-color: var(--vscode-editor-background); padding: 10px; border-radius: 5px; overflow: auto; }
        </style>
      </head>
      <body>
        ${content.replace(/\n/g, "<br>")}
      </body>
      </html>
    `;
    }
    // Helper function to call Gemini API
    async function getGeminiResponse(apiKey, prompt) {
        try {
            const response = await axios_1.default.post("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", {
                contents: [{ parts: [{ text: prompt }] }],
            }, {
                params: { key: apiKey },
                headers: { "Content-Type": "application/json" },
            });
            const data = response.data;
            return data.candidates[0].content.parts[0].text;
        }
        catch (error) {
            console.error("Error calling Gemini API:", error);
            throw new Error("Failed to get response from Gemini API");
        }
    }
    context.subscriptions.push(setApiKeyCommand);
    context.subscriptions.push(explainCodeCommand);
    context.subscriptions.push(generateCodeCommand);
    context.subscriptions.push(refactorCodeCommand);
}
function deactivate() {
    console.log("Extension deactivated. Cleaning up resources.");
}
