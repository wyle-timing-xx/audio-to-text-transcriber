import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { dirname } from 'path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 配置项
const CONFIG = {
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  audioDevice: process.env.AUDIO_DEVICE || ':1',
  language: process.env.LANGUAGE || 'zh',
  model: process.env.MODEL || 'nova-2',
  smartFormat: process.env.SMART_FORMAT === 'true',
  punctuate: process.env.PUNCTUATE === 'true',
  outputFile: process.env.OUTPUT_FILE || 'transcripts/output.txt',
  saveToFile: process.env.SAVE_TO_FILE !== 'false',
  logToConsole: process.env.LOG_TO_CONSOLE !== 'false'
};

// 验证必需配置
if (!CONFIG.deepgramApiKey) {
  console.error('❌ Error: DEEPGRAM_API_KEY is not set in .env file');
  console.error('Please copy .env.example to .env and add your API key');
  process.exit(1);
}

// 创建输出目录
if (CONFIG.saveToFile) {
  const outputDir = dirname(CONFIG.outputFile);
  mkdirSync(outputDir, { recursive: true });
}

class AudioTranscriber {
  constructor(config) {
    this.config = config;
    this.deepgramClient = null;
    this.deepgramConnection = null;
    this.ffmpegProcess = null;
    this.fileStream = null;
    this.isRunning = false;
  }

  /**
   * 初始化 Deepgram 客户端
   */
  initDeepgram() {
    this.deepgramClient = createClient(this.config.deepgramApiKey);
    console.log('✅ Deepgram client initialized');
  }

  /**
   * 创建 Deepgram 实时转录连接
   */
  createDeepgramConnection() {
    this.deepgramConnection = this.deepgramClient.listen.live({
      language: this.config.language,
      model: this.config.model,
      smart_format: this.config.smartFormat,
      punctuate: this.config.punctuate,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1
    });

    // 监听连接打开事件
    this.deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram connection opened');
      console.log('🎙️  Listening to audio...');
    });

    // 监听转录结果
    this.deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      
      if (transcript && transcript.trim().length > 0) {
        const timestamp = new Date().toISOString();
        const output = `[${timestamp}] ${transcript}\n`;

        // 输出到控制台
        if (this.config.logToConsole) {
          console.log(`${transcript}`);
        }

        // 保存到文件
        if (this.config.saveToFile && this.fileStream) {
          this.fileStream.write(output);
        }
      }
    });

    // 监听元数据
    this.deepgramConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
      console.log('📊 Metadata:', data);
    });

    // 监听错误
    this.deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('❌ Deepgram error:', error);
    });

    // 监听连接关闭
    this.deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('⚠️  Deepgram connection closed');
    });

    console.log('✅ Deepgram connection created');
  }

  /**
   * 启动 FFmpeg 音频捕获进程
   */
  startFFmpegCapture() {
    // FFmpeg 命令参数
    const ffmpegArgs = [
      '-f', 'avfoundation',           // macOS 音频输入格式
      '-i', `:${this.config.audioDevice}`,  // 音频设备（BlackHole）
      '-acodec', 'pcm_s16le',         // 16位 PCM 编码
      '-ar', '16000',                 // 采样率 16kHz
      '-ac', '1',                     // 单声道
      '-f', 's16le',                  // 输出格式
      '-'                             // 输出到 stdout
    ];

    console.log('🚀 Starting FFmpeg audio capture...');
    console.log(`📡 Audio device: ${this.config.audioDevice}`);

    // 启动 FFmpeg 进程
    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    // 将音频数据流式传输到 Deepgram
    this.ffmpegProcess.stdout.on('data', (audioData) => {
      if (this.deepgramConnection && this.isRunning) {
        this.deepgramConnection.send(audioData);
      }
    });

    // 监听 FFmpeg 错误输出
    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();
      // 只记录错误信息，忽略常规日志
      if (message.includes('Error') || message.includes('error')) {
        console.error('⚠️  FFmpeg:', message);
      }
    });

    // 监听进程退出
    this.ffmpegProcess.on('exit', (code) => {
      console.log(`⚠️  FFmpeg process exited with code ${code}`);
      this.stop();
    });

    console.log('✅ FFmpeg capture started');
  }

  /**
   * 创建文件写入流
   */
  createFileStream() {
    if (this.config.saveToFile) {
      this.fileStream = createWriteStream(this.config.outputFile, { flags: 'a' });
      const timestamp = new Date().toISOString();
      this.fileStream.write(`\n\n=== Transcription Session Started: ${timestamp} ===\n\n`);
      console.log(`✅ Saving transcripts to: ${this.config.outputFile}`);
    }
  }

  /**
   * 启动转录服务
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Transcription is already running');
      return;
    }

    console.log('\n🎯 Starting Audio to Text Transcriber...');
    console.log('=' .repeat(50));

    try {
      this.isRunning = true;

      // 初始化组件
      this.initDeepgram();
      this.createDeepgramConnection();
      this.createFileStream();
      this.startFFmpegCapture();

      console.log('=' .repeat(50));
      console.log('✅ Transcription service started successfully!');
      console.log('Press Ctrl+C to stop\n');

    } catch (error) {
      console.error('❌ Failed to start transcription service:', error);
      this.stop();
    }
  }

  /**
   * 停止转录服务
   */
  stop() {
    if (!this.isRunning) return;

    console.log('\n⏹️  Stopping transcription service...');
    this.isRunning = false;

    // 关闭 FFmpeg 进程
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
      console.log('✅ FFmpeg process stopped');
    }

    // 关闭 Deepgram 连接
    if (this.deepgramConnection) {
      this.deepgramConnection.finish();
      this.deepgramConnection = null;
      console.log('✅ Deepgram connection closed');
    }

    // 关闭文件流
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

// 创建转录器实例
const transcriber = new AudioTranscriber(CONFIG);

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received interrupt signal...');
  transcriber.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  transcriber.stop();
  process.exit(0);
});

// 启动服务
transcriber.start();
