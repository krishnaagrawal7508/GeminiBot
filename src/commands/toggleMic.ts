import * as vscode from 'vscode';
import { GoogleGenAI, Modality, MediaResolution } from '@google/genai';
import { GeminiApi } from '../api/geminiApi';
import { ChatPanelProvider } from '../views/chatPanel/chatPanel';
import NodeMic from 'node-mic';

let isLiveChat = false;
let liveSession: any = null;
let responseQueue: any[] = [];
let connected = false;
let audioInput: any = null;
let chatPanelProvider: ChatPanelProvider | null = null;
let currentResponseChunks: string[] = [];
let isAccumulatingResponse = false;

export function registerToggleMicCommand(
  context: vscode.ExtensionContext,
  geminiApi: GeminiApi,
  chatPanel: ChatPanelProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('geminibot.toggleMic', async () => {
    chatPanelProvider = chatPanel;

    if (!isLiveChat) {
      await startLiveVoiceChat(context, geminiApi);
    } else {
      await stopLiveVoiceChat();
    }
  });
}

async function startLiveVoiceChat(context: vscode.ExtensionContext, geminiApi: GeminiApi) {
  try {
    const apiKey = await geminiApi.getApiKey();

    if (!apiKey) {
      vscode.window.showErrorMessage('Please set your Gemini API key first');
      return;
    }

    isLiveChat = true;
    responseQueue = [];
    connected = true;
    currentResponseChunks = [];
    isAccumulatingResponse = false;

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = 'gemini-2.0-flash-exp';
    const config = {
      responseModalities: [Modality.TEXT],
      systemInstruction: "You are a helpful voice assistant integrated into VS Code. Listen to the user's speech and respond with helpful, concise text responses about coding, development, or general assistance. Keep your responses clear and focused. Always acknowledge what the user said before responding.",
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      contextWindowCompression: {
        triggerTokens: '25600',
        slidingWindow: { targetTokens: '12800' },
      },
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Aoede"
          }
        }
      }
    };

    liveSession = await ai.live.connect({
      model: model,
      callbacks: {
        onopen: function () {
          if (chatPanelProvider) {
            chatPanelProvider.addMessage('🎙️ Voice chat started', 'model');
          }
        },
        onmessage: function (message) {
          responseQueue.push(message);

          processGeminiResponse(message);
        },
        onerror: function (e) {
          connected = false;
          isLiveChat = false;
        },
        onclose: function (e) {
          if (chatPanelProvider) {
            chatPanelProvider.addMessage('🎙️ Voice chat ended', 'model');
          }
          connected = false;
          isLiveChat = false;
        },
      },
      config: config,
    });

    await startLiveMicrophone();

    processResponseQueue();

  } catch (error) {
    console.error('❌ Error starting live voice chat:', error);
    vscode.window.showErrorMessage(`Failed to start live voice chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    isLiveChat = false;
    connected = false;
  }
}



async function startLiveMicrophone() {
  try {
    audioInput = new NodeMic({
      rate: 16000,
      channels: 1,
      threshold: 6
    });

    const audioStream = audioInput.getAudioStream();

    audioStream.on('data', (chunk: Buffer) => {
      if (isLiveChat && connected && liveSession) {
        try {
          const base64Audio = chunk.toString('base64');

          liveSession.sendRealtimeInput({
            media: {
              data: base64Audio,
              mimeType: "audio/pcm"
            }
          });
        } catch (error) {
          console.error('Error streaming audio to Gemini:', error);
        }
      }
    });

    audioStream.on('error', (error: any) => {
      console.error('🎤 Live microphone error:', error);
      vscode.window.showErrorMessage(`Microphone error: ${error.message}`);
    });

    audioStream.on('started', () => {
    });

    audioStream.on('stopped', () => {
    });

    audioStream.on('silence', () => {
    });

    audioStream.on('exit', (code: number) => {
    });

    audioInput.start();

  } catch (error) {
    console.error('Error starting live microphone:', error);
    throw error;
  }
}

async function stopLiveVoiceChat() {
  try {
    isLiveChat = false;
    connected = false;

    if (audioInput) {
      audioInput.stop();
      audioInput = null;
    }

    if (liveSession) {
      liveSession.close();
      liveSession = null;
    }

    responseQueue = [];
    currentResponseChunks = [];
    isAccumulatingResponse = false;

  } catch (error) {
    console.error('Error stopping live voice chat:', error);
  }
}

function processGeminiResponse(message: any) {
  try {
    if (!chatPanelProvider) {
      return;
    }

    if (message.serverContent && message.serverContent.modelTurn && message.serverContent.modelTurn.parts) {
      message.serverContent.modelTurn.parts.forEach((part: any, index: number) => {
        if (part.text) {
          if (!isAccumulatingResponse) {
            isAccumulatingResponse = true;
            currentResponseChunks = [];
          }

          currentResponseChunks.push(part.text);
        }
      });
    }

    if (message.serverContent && message.serverContent.turnComplete) {
      if (isAccumulatingResponse && currentResponseChunks.length > 0) {
        const combinedResponse = currentResponseChunks.join('').trim();

        if (combinedResponse) {
          chatPanelProvider.addMessage(combinedResponse, 'model');
        }

        currentResponseChunks = [];
        isAccumulatingResponse = false;
      }
    }

    if (message.setupComplete) {
      if (chatPanelProvider) {
      }
    }

    if (message.serverContent && message.serverContent.interrupted) {
      currentResponseChunks = [];
      isAccumulatingResponse = false;
    }

    if (message.error) {
      console.error('❌ Error in message:', message.error);
      chatPanelProvider.addMessage('❌ Voice chat error occurred', 'model');
    }

  } catch (error) {
    console.error('❌ Error processing Gemini response:', error);
    if (chatPanelProvider) {
      chatPanelProvider.addMessage('❌ Processing error', 'model');
    }
  }
}

async function processResponseQueue() {
  while (isLiveChat && connected) {
    try {
      if (responseQueue.length > 0) {
        const message = responseQueue.shift();
        if (message) {
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error in response queue processing:', error);
    }
  }
}
