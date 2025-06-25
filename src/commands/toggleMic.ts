import * as vscode from 'vscode';
import { GoogleGenAI, Modality, MediaResolution } from '@google/genai';
import { GeminiApi } from '../api/geminiApi';
import { ChatPanelProvider } from '../views/chatPanel/chatPanel';
import NodeMic from 'node-mic';
import screenshotDesktop from 'screenshot-desktop';

let isLiveChat = false;
let liveSession: any = null;
let responseQueue: any[] = [];
let connected = false;
let audioInput: any = null;
let chatPanelProvider: ChatPanelProvider | null = null;
let currentResponseChunks: string[] = [];
let isAccumulatingResponse = false;
let currentScreenshot: string | null = null;
let screenshotInterval: NodeJS.Timeout | null = null;

async function captureScreenshot(): Promise<string | null> {
  try {
    const img = await screenshotDesktop();
    
    const base64Image = img.toString('base64');
    
    return base64Image;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
}

function startContinuousScreenshare() {
  // Send screenshots at 5 FPS (every 200ms)
  screenshotInterval = setInterval(async () => {
    if (!isLiveChat || !connected || !liveSession) {
      return;
    }

    try {
      const screenshot = await captureScreenshot();
      
      if (screenshot) {
        liveSession.sendRealtimeInput({
          media: {
            data: screenshot,
            mimeType: "image/jpeg"
          }
        });
      }
    } catch (error) {
      console.error('Error in continuous screenshare:', error);
    }
  }, 200);
}

function stopContinuousScreenshare() {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
}

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

    if (chatPanelProvider) {
      chatPanelProvider.addMessage('🚀 Starting live screenshare...', 'model');
    }

    const screenshotPromise = captureScreenshot();

    isLiveChat = true;
    responseQueue = [];
    connected = true;
    currentResponseChunks = [];
    isAccumulatingResponse = false;

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = 'gemini-2.0-flash-exp';
    const config = {
      responseModalities: [Modality.TEXT],
      systemInstruction: "You are a helpful voice assistant with live screenshare capability integrated into VS Code. You are receiving the user's screen at 5 frames per second in real-time and can hear their voice simultaneously. You can see live updates of their screen as they work. Analyze the current visual context and respond to their spoken questions about what they're seeing right now. Help with coding, debugging, explaining code, navigating the interface, or any development tasks. Always reference what you can currently see on their screen. Keep responses clear and actionable.",
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
        },
        onmessage: function (message) {
          responseQueue.push(message);

          processGeminiResponse(message);
        },
        onerror: function (e) {
          connected = false;
          isLiveChat = false;
          stopContinuousScreenshare();
        },
        onclose: function (e) {
          if (chatPanelProvider) {
            chatPanelProvider.addMessage('🎙️ Live screenshare ended', 'model');
          }
          connected = false;
          isLiveChat = false;
          stopContinuousScreenshare();
        },
      },
      config: config,
    });

    await Promise.all([
      (async () => {
        try {
          currentScreenshot = await screenshotPromise;
          
          if (currentScreenshot && liveSession) {
            liveSession.sendRealtimeInput({
              media: {
                data: currentScreenshot,
                mimeType: "image/jpeg"
              }
            });
          }
        } catch (error) {
          console.error('Error sending initial screenshot to Gemini:', error);
        }
      })(),
      
      startLiveMicrophone()
    ]);

    startContinuousScreenshare();

    if (chatPanelProvider) {
      chatPanelProvider.addMessage('🎙️📺 Live screenshare at 5 FPS ready - ask anything!', 'model');
    }
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

    stopContinuousScreenshare();

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
    currentScreenshot = null;

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
