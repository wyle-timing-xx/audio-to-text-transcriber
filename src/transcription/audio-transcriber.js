// 音频转录器模块
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import AIManager from '../ai/ai-manager.js';

class AudioTranscriber {
  constructor(config) {
    this.config = config;
    this.deepgramClient = null;
    this.deepgramConnection = null;
    this.ffmpegProcess = null;
    this.fileStream = null;
    this.isRunning = false;
    this.aiManager = new AIManager(config);
  }

  initDeepgram() {
    this.deepgramClient = createClient(this.config.deepgram.apiKey);
    console.log('✅ Deepgram client initialized');
  }

  createDeepgramConnection() {
    this.deepgramConnection = this.deepgramClient.listen.live({
      language: this.config.deepgram.language,
      model: this.config.deepgram.model,
      smart_format: this.config.deepgram.smartFormat,
      punctuate: this.config.deepgram.punctuate,
      encoding: this.config.audio.encoding,
      sample_rate: this.config.audio.sampleRate,
      channels: this.config.audio.channels
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram connection opened');
      console.log('🎙️  Listening to audio...');
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript && transcript.trim().length > 0) {
        const timestamp = new Date().toISOString();
        const output = `[${timestamp}] ${transcript}\n`;

        // 输出到控制台
        if (this.config.output.logToConsole) {
          console.log(`${transcript}`);
        }

        // 保存到文件
        if (this.config.output.saveToFile && this.fileStream) {
          this.fileStream.write(output);
        }

        // 把文本片段推给 AI manager（流式/增量）
        try {
          await this.aiManager.pushTranscriptFragment(transcript);
        } catch (e) {
          console.error('⚠️ AI push error:', e.message || e);
        }
      }
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
      console.log('📊 Metadata:', data);
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('❌ Deepgram error:', error);
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('⚠️  Deepgram connection closed');
    });

    console.log('✅ Deepgram connection created');
  }

  startFFmpegCapture() {
    const ffmpegArgs = [
      '-f', 'avfoundation',
      '-i', `:${this.config.audio.device}`,
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-f', 's16le',
      '-'
    ];

    console.log('🚀 Starting FFmpeg audio capture...');
    console.log(`📡 Audio device: ${this.config.audio.device}`);

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    this.ffmpegProcess.stdout.on('data', (audioData) => {
      if (this.deepgramConnection && this.isRunning) {
        this.deepgramConnection.send(audioData);
      }
    });

    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('Error') || message.includes('error')) {
        console.error('⚠️  FFmpeg:', message);
      }
    });

    this.ffmpegProcess.on('exit', (code) => {
      console.log(`⚠️  FFmpeg process exited with code ${code}`);
      this.stop();
    });

    console.log('✅ FFmpeg capture started');
  }

  createFileStream() {
    if (this.config.output.saveToFile) {
      this.fileStream = createWriteStream(this.config.output.transcriptFile, { flags: 'a' });
      const timestamp = new Date().toISOString();
      this.fileStream.write(`\n\n=== Transcription Session Started: ${timestamp} ===\n\n`);
      console.log(`✅ Saving transcripts to: ${this.config.output.transcriptFile}`);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Transcription is already running');
      return;
    }

    console.log('\n🎯 Starting Audio to Text Transcriber...');
    console.log('='.repeat(50));

    try {
      this.isRunning = true;

      // 创建输出目录
      if (this.config.output.saveToFile) {
        mkdirSync(dirname(this.config.output.transcriptFile), { recursive: true });
        mkdirSync(dirname(this.config.output.qaOutputFile), { recursive: true });
      }

      // 初始化组件
      this.initDeepgram();
      this.createDeepgramConnection();
      this.createFileStream();
      this.startFFmpegCapture();

      console.log('='.repeat(50));
      console.log('✅ Transcription service started successfully!');
      console.log(`🤖 AI Provider: ${this.config.ai.provider.toUpperCase()}`);
      if (this.config.interruption.enabled) {
        console.log(`⚡ 中断功能已启用: 在 AI 回答时说话可以打断 AI`);
      }
      console.log('Press Ctrl+C to stop\n');

    } catch (error) {
      console.error('❌ Failed to start transcription service:', error);
      this.stop();
    }
  }

  stop() {
    if (!this.isRunning) return;

    console.log('\n⏹️  Stopping transcription service...');
    this.isRunning = false;

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
      console.log('✅ FFmpeg process stopped');
    }

    if (this.deepgramConnection) {
      // finish() might be async; call safely
      try {
        this.deepgramConnection.finish();
      } catch (e) {}
      this.deepgramConnection = null;
      console.log('✅ Deepgram connection closed');
    }

    if (this.fileStream) {
      const timestamp = new Date().toISOString();
      this.fileStream.write(`\n=== Transcription Session Ended: ${timestamp} ===\n`);
      this.fileStream.end();
      this.fileStream = null;
      console.log('✅ Output file closed');
    }

    console.log('👋 Transcription service stopped\n');
  }
}

export default AudioTranscriber;