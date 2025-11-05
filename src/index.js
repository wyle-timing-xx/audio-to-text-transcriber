// src/index.js
import { loadConfig } from './config/index.js';
import { AudioTranscriber } from './transcription/index.js';

// 创建配置
const CONFIG = loadConfig();

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