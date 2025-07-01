import * as vscode from 'vscode';
import { GoogleGenAI, Modality, MediaResolution } from '@google/genai';
import { GeminiApi } from '../api/geminiApi';
import { ChatPanelProvider } from '../views/chatPanel/chatPanel';
import NodeMic from 'node-mic';
import screenshotDesktop from 'screenshot-desktop';

// Live API session state
let isLiveAPIActive = false;
let liveSession: any = null;
let responseQueue: any[] = [];
let connected = false;

// Audio streaming components
let audioInput: any = null;

// Video streaming components  
let screenshotInterval: NodeJS.Timeout | null = null;
let currentScreenshot: string | null = null;

// Chat integration
let chatPanelProvider: ChatPanelProvider | null = null;
let currentResponseChunks: string[] = [];
let isAccumulatingResponse = false;

// ====== AUDIO STREAMING FUNCTIONS ======

async function startAudioStreaming() {
  try {
    audioInput = new NodeMic({
      rate: 16000,
      channels: 1,
      threshold: 6
    });

    const audioStream = audioInput.getAudioStream();

    audioStream.on('data', (chunk: Buffer) => {
      if (isLiveAPIActive && connected && liveSession) {
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
      console.error('Audio streaming error:', error);
      vscode.window.showErrorMessage(`Audio error: ${error.message}`);
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
    console.error('Error starting audio streaming:', error);
    throw error;
  }
}

function stopAudioStreaming() {
  if (audioInput) {
    audioInput.stop();
    audioInput = null;
  }
}

// ====== VIDEO STREAMING FUNCTIONS ======

async function captureScreen(): Promise<string | null> {
  try {
    const img = await screenshotDesktop();
    const base64Image = img.toString('base64');
    return base64Image;
  } catch (error) {
    console.error('Error capturing screen:', error);
    return null;
  }
}

function startVideoStreaming() {
  screenshotInterval = setInterval(async () => {
    if (!isLiveAPIActive || !connected || !liveSession) {
      return;
    }

    try {
      const screenshot = await captureScreen();

      if (screenshot) {
        liveSession.sendRealtimeInput({
          media: {
            data: screenshot,
            mimeType: "image/jpeg"
          }
        });
      }
    } catch (error) {
      console.error('Error in video streaming:', error);
    }
  }, 200);
}

function stopVideoStreaming() {
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
}

// ====== LIVE API SESSION MANAGEMENT ======

async function startLiveAPISession(context: vscode.ExtensionContext, geminiApi: GeminiApi) {
  try {
    const apiKey = await geminiApi.getApiKey();

    if (!apiKey) {
      vscode.window.showErrorMessage('Please set your Gemini API key first');
      return;
    }

    const screenshotPromise = captureScreen();

    isLiveAPIActive = true;
    responseQueue = [];
    connected = true;
    currentResponseChunks = [];
    isAccumulatingResponse = false;

    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = 'gemini-2.0-flash-exp';
    const config = {
      responseModalities: [Modality.TEXT],
      systemInstruction: `You are a live AI assistant with real-time audio and video capabilities integrated into VS Code. 
        IMPORTANT: You must ALWAYS follow this EXACT format for EVERY response:
        1. First line must ALWAYS start with "transcription: " followed by the transcribed audio
        2. Second line must be a blank line
        3. Third line onwards will be your response
        
        Example format:
        transcription: <exact transcribed audio>

        <your response>

        You will respond to the user's screen as they work and their spoken questions in real-time. Help with coding, debugging, explaining code, navigating interfaces, or any development tasks. 
        Always reference what you can currently see and hear. Keep responses clear and actionable.`,
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
          isLiveAPIActive = false;
          stopVideoStreaming();
          stopAudioStreaming();
        },
        onclose: function (e) {
          if (chatPanelProvider) {
            chatPanelProvider.addMessage('🎙️ Live API session ended', 'model');
          }
          connected = false;
          isLiveAPIActive = false;
          stopVideoStreaming();
          stopAudioStreaming();
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

      startAudioStreaming()
    ]);

    startVideoStreaming();

    if (chatPanelProvider) {
      chatPanelProvider.addMessage('🎙️📺 Live API ready - audio + Screenshare streaming', 'model');
    }
    processResponseQueue();

  } catch (error) {
    console.error('Error starting live API session:', error);
    vscode.window.showErrorMessage(`Failed to start live API session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    isLiveAPIActive = false;
    connected = false;
  }
}

async function stopLiveAPISession() {
  try {
    isLiveAPIActive = false;
    connected = false;

    stopVideoStreaming();
    stopAudioStreaming();

    if (liveSession) {
      liveSession.close();
      liveSession = null;
    }

    responseQueue = [];
    currentResponseChunks = [];
    isAccumulatingResponse = false;
    currentScreenshot = null;

  } catch (error) {
    console.error('Error stopping live API session:', error);
  }
}

// ====== RESPONSE PROCESSING ======

function processGeminiResponse(message: any) {
  try {
    if (!chatPanelProvider) {
      return;
    }

    if (message.serverContent && message.serverContent.modelTurn && message.serverContent.modelTurn.parts) {
      message.serverContent.modelTurn.parts.forEach((part: any) => {
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
          if (combinedResponse.startsWith('🎙️')) {
            chatPanelProvider.addMessage(combinedResponse, 'model');
          } else {
            const parts = combinedResponse.split(/transcription:\s*/i);
            
            if (parts.length > 1) {
              const content = parts[1];
              const [transcription, ...responseParts] = content.split('\n\n');
              
              if (transcription) {
                chatPanelProvider.addMessage(transcription.trim(), 'user');
                const response = responseParts.join('\n\n').trim();
                if (response) {
                  chatPanelProvider.addMessage(response, 'model');
                }
              }
            } else {
              chatPanelProvider.addMessage(combinedResponse, 'model');
            }
          }
        }

        currentResponseChunks = [];
        isAccumulatingResponse = false;
      }
    }

    if (message.serverContent && message.serverContent.interrupted) {
      currentResponseChunks = [];
      isAccumulatingResponse = false;
    }

    if (message.error) {
      console.error('Error in message:', message.error);
      chatPanelProvider.addMessage('❌ Live API error occurred', 'model');
    }

  } catch (error) {
    console.error('Error processing Gemini response:', error);
    if (chatPanelProvider) {
      chatPanelProvider.addMessage('❌ Processing error', 'model');
    }
  }
}

async function processResponseQueue() {
  while (isLiveAPIActive && connected) {
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

// ====== COMMAND REGISTRATION ======

export function registerToggleLiveAPICommand(
  context: vscode.ExtensionContext,
  geminiApi: GeminiApi,
  chatPanel: ChatPanelProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('geminibot.toggleLiveAPI', async () => {
    chatPanelProvider = chatPanel;

    if (!isLiveAPIActive) {
      await startLiveAPISession(context, geminiApi);
    } else {
      await stopLiveAPISession();
    }
  });
}
