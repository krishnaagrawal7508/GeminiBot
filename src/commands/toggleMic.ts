import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GoogleGenAI, Modality, MediaResolution } from '@google/genai';
import { GeminiApi } from '../api/geminiApi';
import NodeMic from 'node-mic';

let isRecording = false;
let micInstance: NodeMic | null = null;
let micInputStream: any = null;
let audioChunks: Buffer[] = [];

// Live voice chat variables
let isLiveChat = false;
let liveSession: any = null;
let responseQueue: any[] = [];
let connected = false;
let audioInput: any = null;

export function registerToggleMicCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand('geminibot.toggleMic', async () => {
    console.log('GeminiBot: toggleMic command triggered!');
    
    // Show options for different mic functionality
    const choice = await vscode.window.showQuickPick([
      '🎤 Record Audio (Save to File)',
      '🗣️ Live Voice Chat with Gemini',
      '⏹️ Stop Current Session'
    ], {
      placeHolder: 'Choose microphone action'
    });
    
    switch (choice) {
      case '🎤 Record Audio (Save to File)':
        if (!isRecording) {
          await startRecording(context);
        } else {
          await stopRecording(context);
        }
        break;
      case '🗣️ Live Voice Chat with Gemini':
        if (!isLiveChat) {
          await startLiveVoiceChat(context);
        } else {
          vscode.window.showWarningMessage('Live voice chat is already active!');
        }
        break;
      case '⏹️ Stop Current Session':
        if (isLiveChat) {
          await stopLiveVoiceChat();
        } else if (isRecording) {
          await stopRecording(context);
        } else {
          vscode.window.showInformationMessage('No active session to stop');
        }
        break;
    }
  });
}

async function startLiveVoiceChat(context: vscode.ExtensionContext) {
  try {
    console.log('🚀 Starting Gemini Live Voice Chat...');
    vscode.window.showInformationMessage('🚀 Starting live voice chat with Gemini...');
    
    // Get API key from the existing GeminiApi
    const geminiApi = new GeminiApi(context);
    const apiKey = await geminiApi.getApiKey();
    
    if (!apiKey) {
      vscode.window.showErrorMessage('Please set your Gemini API key first');
      return;
    }
    
    isLiveChat = true;
    responseQueue = [];
    connected = true;
    
    // Initialize Google GenAI
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const model = 'gemini-2.0-flash-exp';
    const config = {
      responseModalities: [Modality.TEXT],
      systemInstruction: "You are a helpful voice assistant integrated into VS Code. Listen to the user's speech and respond with helpful, concise text responses about coding, development, or general assistance.",
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      contextWindowCompression: {
        triggerTokens: '25600',
        slidingWindow: { targetTokens: '12800' },
      },
    };
    
    // Connect to Gemini Live API
    liveSession = await ai.live.connect({
      model: model,
      callbacks: {
        onopen: function () {
          console.log('🔗 Connected to Gemini Live API');
          vscode.window.showInformationMessage('🔗 Connected to Gemini! Start speaking...');
          logGeminiResponse('CONNECTION', 'Connected to Gemini Live API');
        },
        onmessage: function (message) {
          console.log("📨 Received message from Gemini:", JSON.stringify(message, null, 2));
          logGeminiResponse('MESSAGE', message);
          responseQueue.push(message);
          
          // Process and display responses immediately
          processGeminiResponse(message);
        },
        onerror: function (e) {
          console.log("❌ Gemini API Error: ", e);
          logGeminiResponse('ERROR', e);
          vscode.window.showErrorMessage(`Gemini API Error: ${e.message}`);
          connected = false;
          isLiveChat = false;
        },
        onclose: function (e) {
          console.log("🔌 Gemini connection closed: ", e);
          logGeminiResponse('CLOSE', e);
          vscode.window.showInformationMessage('🔌 Gemini connection closed');
          connected = false;
          isLiveChat = false;
        },
      },
      config: config,
    });
    
    // Send initial greeting
    liveSession.sendClientContent({ 
      turns: 'Hello! I can hear you through the microphone in VS Code. Please start speaking and I will respond with text in the VS Code interface.' 
    });
    
    // Start microphone for live streaming
    await startLiveMicrophone();
    
    vscode.window.showInformationMessage('🎤 Live voice chat active! Speak into your microphone.');
    
    // Keep processing responses
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
    console.log('🎤 Setting up live microphone streaming with node-mic...');
    
    // Create audio input using node-mic for live streaming
    audioInput = new NodeMic({
      rate: 16000,
      channels: 1,
      threshold: 6
    });

    // Get the audio stream
    const audioStream = audioInput.getAudioStream();

    // Handle audio data - stream to Gemini in real-time
    audioStream.on('data', (chunk: Buffer) => {
      if (isLiveChat && connected && liveSession) {
        try {
          // Convert audio data to base64
          const base64Audio = chunk.toString('base64');
          
          // Send audio data to the session
          liveSession.sendRealtimeInput({
            media: {
              data: base64Audio,
              mimeType: "audio/pcm"
            }
          });
          
          console.log(`📡 Streamed ${chunk.length} bytes to Gemini`);
        } catch (error) {
          console.error('Error streaming audio to Gemini:', error);
        }
      }
    });

    // Handle errors
    audioStream.on('error', (error: any) => {
      console.error('🎤 Live microphone error:', error);
      vscode.window.showErrorMessage(`Microphone error: ${error.message}`);
    });

    // Handle live streaming events
    audioStream.on('started', () => {
      console.log('🎤 Live streaming started');
    });

    audioStream.on('stopped', () => {
      console.log('🎤 Live streaming stopped');
    });

    audioStream.on('silence', () => {
      console.log('🔇 Silence detected in live stream');
    });

    audioStream.on('exit', (code: number) => {
      console.log(`🔌 Live microphone exited with code: ${code}`);
    });

    // Start audio input
    audioInput.start();
    console.log('🎤 Live microphone started with node-mic. Listening for audio...');
    
  } catch (error) {
    console.error('Error starting live microphone:', error);
    throw error;
  }
}

async function stopLiveVoiceChat() {
  try {
    console.log('⏹️ Stopping live voice chat...');
    vscode.window.showInformationMessage('⏹️ Stopping live voice chat...');
    
    isLiveChat = false;
    connected = false;
    
    // Stop microphone
    if (audioInput) {
      audioInput.stop();
      audioInput = null;
    }
    
    // Close Gemini session
    if (liveSession) {
      liveSession.close();
      liveSession = null;
    }
    
    // Clear response queue
    responseQueue = [];
    
    vscode.window.showInformationMessage('✅ Live voice chat stopped');
    console.log('✅ Live voice chat session ended');
    
  } catch (error) {
    console.error('Error stopping live voice chat:', error);
    vscode.window.showErrorMessage(`Failed to stop live voice chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function processGeminiResponse(message: any) {
  try {
    if (message.serverContent && message.serverContent.modelTurn) {
      const parts = message.serverContent.modelTurn.parts;
      if (parts) {
        for (const part of parts) {
          if (part.text) {
            console.log('🤖 Gemini Response:', part.text);
            // Show response in VS Code
            vscode.window.showInformationMessage(`🤖 Gemini: ${part.text}`);
            
            // Log detailed response
            logGeminiResponse('AI_RESPONSE', {
              text: part.text,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
    
    // Log turn completion
    if (message.serverContent && message.serverContent.turnComplete) {
      console.log('✅ Turn completed');
      logGeminiResponse('TURN_COMPLETE', message.serverContent);
    }
    
  } catch (error) {
    console.error('Error processing Gemini response:', error);
  }
}

async function processResponseQueue() {
  while (isLiveChat && connected) {
    try {
      if (responseQueue.length > 0) {
        const message = responseQueue.shift();
        if (message) {
          // Additional processing can be done here if needed
          console.log('📋 Processing queued response:', message);
        }
      }
      
      // Small delay to prevent busy waiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error in response queue processing:', error);
    }
  }
}

function logGeminiResponse(type: string, data: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    data: typeof data === 'object' ? JSON.stringify(data, null, 2) : data
  };
  
  console.log(`🔍 [${timestamp}] GEMINI_${type}:`, logEntry.data);
}

// Recording functionality using node-mic
async function startRecording(context: vscode.ExtensionContext) {
  try {
    console.log('Starting microphone recording with node-mic...');
    vscode.window.showInformationMessage('🎤 Starting microphone recording...');
    
    isRecording = true;
    audioChunks = [];
    
    // Create mic instance using node-mic
    micInstance = new NodeMic({
      rate: 16000,
      channels: 1,
      threshold: 6
    });
    
    // Get the audio stream
    micInputStream = micInstance.getAudioStream();
    
    // Handle audio data
    micInputStream.on('data', (data: Buffer) => {
      if (isRecording) {
        audioChunks.push(data);
        console.log(`Audio chunk: ${data.length} bytes (Total: ${audioChunks.length} chunks)`);
        
        if (audioChunks.length % 100 === 0) {
          console.log(`Recording progress: ${audioChunks.length} chunks captured`);
        }
      }
    });
    
    micInputStream.on('error', (err: any) => {
      console.error(`Recording error: ${err.message}`);
      vscode.window.showErrorMessage(`Recording error: ${err.message}`);
      isRecording = false;
    });
    
    micInputStream.on('started', () => {
      console.log('🎤 Recording started');
      vscode.window.showInformationMessage('🎤 Recording started! Speak into your microphone.');
    });
    
    micInputStream.on('stopped', () => {
      console.log('🎤 Recording stopped');
    });
    
    micInputStream.on('paused', () => {
      console.log('🎤 Recording paused');
    });
    
    micInputStream.on('unpaused', () => {
      console.log('🎤 Recording unpaused');
    });
    
    micInputStream.on('silence', () => {
      console.log('🔇 Silence detected');
    });
    
    micInputStream.on('exit', (code: number) => {
      console.log(`🔌 Microphone exited with code: ${code}`);
    });
    
    // Start recording
    micInstance.start();
    
  } catch (error) {
    console.error('Error starting recording:', error);
    vscode.window.showErrorMessage(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    isRecording = false;
  }
}

async function stopRecording(context: vscode.ExtensionContext) {
  try {
    console.log('Stopping microphone recording...');
    vscode.window.showInformationMessage('⏹️ Stopping recording and saving audio...');
    
    isRecording = false;
    
    if (micInstance) {
      micInstance.stop();
      micInstance = null;
      micInputStream = null;
    }
    
    // Save the audio data
    if (audioChunks.length > 0) {
      await saveAudioFile(context);
    } else {
      vscode.window.showWarningMessage('No audio data recorded');
    }
    
  } catch (error) {
    console.error('Error stopping recording:', error);
    vscode.window.showErrorMessage(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    isRecording = false;
  }
}

async function saveAudioFile(context: vscode.ExtensionContext) {
  try {
    // Combine all audio chunks
    const totalAudio = Buffer.concat(audioChunks);
    console.log(`Total audio data: ${totalAudio.length} bytes`);
    
    // Analyze audio quality
    const audioAnalysis = analyzeAudioData(totalAudio);
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `geminibot-recording-${timestamp}.wav`;
    
    // Get storage path
    const storagePath = context.globalStorageUri.fsPath;
    const audioPath = path.join(storagePath, fileName);
    
    // Ensure directory exists
    await vscode.workspace.fs.createDirectory(context.globalStorageUri);
    
    // Create WAV header for the raw audio data
    const wavHeader = createWavHeader(totalAudio.length, 16000, 1, 16);
    const wavFile = Buffer.concat([wavHeader, totalAudio]);
    
    // Save the file
    await vscode.workspace.fs.writeFile(vscode.Uri.file(audioPath), wavFile);
    
    console.log(`Audio saved to: ${audioPath}`);
    const durationSeconds = Math.floor(totalAudio.length / (16000 * 2));
    const fileSizeKB = Math.floor(wavFile.length / 1024);
    
    // Show detailed verification information
    vscode.window.showInformationMessage(`✅ Audio Captured: ${fileName}`);
    vscode.window.showInformationMessage(`📊 ${durationSeconds}s | 16kHz | 16-bit | ${fileSizeKB}KB`);
    vscode.window.showInformationMessage(`🔊 Volume: ${audioAnalysis.volume} | Signal: ${audioAnalysis.hasSignal ? 'DETECTED' : 'SILENT'}`);
    
    // Show verification options
    const action = await vscode.window.showInformationMessage(
      `🎤 Audio Quality Check:
Volume Level: ${audioAnalysis.volume}
Signal Detected: ${audioAnalysis.hasSignal ? 'YES' : 'NO'}
Duration: ${durationSeconds} seconds

What would you like to do?`,
      'Open Folder',
      'View Details',
      'Test Playback Info'
    );
    
    if (action === 'Open Folder') {
      vscode.env.openExternal(vscode.Uri.file(storagePath));
    } else if (action === 'View Details') {
      await showAudioDetails(audioAnalysis, audioPath, durationSeconds);
    } else if (action === 'Test Playback Info') {
      await showPlaybackInstructions(audioPath);
    }
    
    // Clear audio chunks for next recording
    audioChunks = [];
    
  } catch (error) {
    console.error('Error saving audio file:', error);
    vscode.window.showErrorMessage(`Failed to save audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function analyzeAudioData(audioBuffer: Buffer): { volume: string, hasSignal: boolean, peakLevel: number } {
  // Analyze the raw audio data to verify quality
  let maxAmplitude = 0;
  let totalAmplitude = 0;
  let sampleCount = 0;
  
  // Read 16-bit samples
  for (let i = 0; i < audioBuffer.length - 1; i += 2) {
    const sample = audioBuffer.readInt16LE(i);
    const amplitude = Math.abs(sample);
    
    totalAmplitude += amplitude;
    maxAmplitude = Math.max(maxAmplitude, amplitude);
    sampleCount++;
  }
  
  const averageAmplitude = totalAmplitude / sampleCount;
  const peakLevel = maxAmplitude / 32767; // Normalize to 0-1
  const avgLevel = averageAmplitude / 32767;
  
  let volumeDescription = 'SILENT';
  if (avgLevel > 0.001) volumeDescription = 'VERY LOW';
  if (avgLevel > 0.01) volumeDescription = 'LOW';
  if (avgLevel > 0.05) volumeDescription = 'NORMAL';
  if (avgLevel > 0.2) volumeDescription = 'LOUD';
  if (avgLevel > 0.5) volumeDescription = 'VERY LOUD';
  
  return {
    volume: volumeDescription,
    hasSignal: avgLevel > 0.001, // Consider anything above 0.1% as signal
    peakLevel: peakLevel
  };
}

async function showAudioDetails(analysis: any, audioPath: string, duration: number) {
  const details = `
🎤 AUDIO RECORDING ANALYSIS

📄 File: ${path.basename(audioPath)}
📁 Location: ${audioPath}

📊 QUALITY METRICS:
• Duration: ${duration} seconds
• Sample Rate: 16,000 Hz (Voice Quality)
• Bit Depth: 16-bit
• Channels: 1 (Mono)

🔊 SIGNAL ANALYSIS:
• Volume Level: ${analysis.volume}
• Signal Detected: ${analysis.hasSignal ? 'YES' : 'NO'}
• Peak Level: ${(analysis.peakLevel * 100).toFixed(1)}%

✅ VERIFICATION:
${analysis.hasSignal ? '✓ Audio signal captured successfully' : '❌ No audio signal detected - check microphone'}
${analysis.volume !== 'SILENT' ? '✓ Volume levels are adequate' : '❌ Volume too low - speak closer to microphone'}

🎧 TO TEST AUDIO QUALITY:
1. Open the audio file in any media player
2. Compare with your voice - should sound identical
3. Check for clarity and volume levels
`;

  vscode.window.showInformationMessage(details);
}

async function showPlaybackInstructions(audioPath: string) {
  const instructions = `
🎧 HOW TO VERIFY YOUR RECORDING:

1. 📂 OPEN FILE:
   Double-click: ${path.basename(audioPath)}
   
2. 🎵 PLAY & COMPARE:
   • Listen to the recording
   • Compare with your memory of speaking
   • Check if voice sounds natural
   
3. ✅ QUALITY CHECKLIST:
   □ Can you hear your voice clearly?
   □ Volume level sounds right?
   □ No distortion or static?
   □ Sounds like how you remember speaking?
   
4. 🔧 IF AUDIO IS POOR:
   • Speak closer to microphone
   • Check microphone permissions
   • Adjust system microphone volume
   • Try recording again

📁 File location: ${audioPath}
`;

  const action = await vscode.window.showInformationMessage(
    instructions,
    'Open File Location',
    'Record Again'
  );
  
  if (action === 'Open File Location') {
    vscode.env.openExternal(vscode.Uri.file(path.dirname(audioPath)));
  } else if (action === 'Record Again') {
    vscode.commands.executeCommand('geminibot.toggleMic');
  }
}

function createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const header = Buffer.alloc(44);
  
  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  
  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Sub-chunk size
  header.writeUInt16LE(1, 20); // Audio format (1 = PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // Byte rate
  header.writeUInt16LE(channels * bitsPerSample / 8, 32); // Block align
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  
  return header;
}
