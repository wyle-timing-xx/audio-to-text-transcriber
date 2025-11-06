// TTS提供商工厂

import ElevenLabsProvider from './elevenlabs.js';

/**
 * 创建语音合成提供商
 * 
 * @param {string} provider 提供商类型
 * @param {Object} config 配置对象
 * @returns {Object} 语音合成提供商实例
 * @throws {Error} 如果提供商类型无效
 */
export function createTTSProvider(provider, config) {
  switch (provider.toLowerCase()) {
    case 'elevenlabs':
      return new ElevenLabsProvider(config);
    // 可以在此处添加其他TTS提供商，例如:
    // case 'amazon':
    //   return new AmazonPollyProvider(config);
    // case 'google':
    //   return new GoogleTTSProvider(config);
    default:
      throw new Error(`Unknown TTS provider: ${provider}`);
  }
}

export { ElevenLabsProvider };