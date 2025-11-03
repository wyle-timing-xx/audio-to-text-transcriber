import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const AUDIO_DEVICE = process.env.AUDIO_DEVICE || 'BlackHole 2ch:1';

console.log('🔍 Testing audio device configuration...');
console.log(`📡 Device: ${AUDIO_DEVICE}`);
console.log('\n⏱️  Recording for 5 seconds...\n');

// 列出可用的音频设备
const listDevices = spawn('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', '']);

listDevices.stderr.on('data', (data) => {
  console.log(data.toString());
});

listDevices.on('exit', () => {
  console.log('\n\n🎯 Starting test recording...');
  
  // 测试录音
  const testRecord = spawn('ffmpeg', [
    '-f', 'avfoundation',
    '-i', `:${AUDIO_DEVICE}`,
    '-t', '5',  // 录制 5 秒
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    'test-output.wav'
  ]);

  testRecord.stderr.on('data', (data) => {
    const message = data.toString();
    if (!message.includes('size=') && !message.includes('time=')) {
      console.log(message);
    }
  });

  testRecord.on('exit', (code) => {
    if (code === 0) {
      console.log('\n✅ Test successful! Audio device is working.');
      console.log('📁 Test file saved as: test-output.wav');
    } else {
      console.log('\n❌ Test failed. Please check your audio device configuration.');
    }
  });
});
