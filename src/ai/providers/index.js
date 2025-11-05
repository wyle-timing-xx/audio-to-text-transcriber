// AI 提供商工厂

import OpenAIProvider from './openai.js';
import ClaudeProvider from './claude.js';
import DeepseekProvider from './deepseek.js';

/**
 * 创建 AI 提供商
 * 
 * @param {string} provider 提供商类型
 * @param {Object} config AI 配置
 * @param {Object} logger 日志记录器
 * @param {Object} fileStorage 文件存储工具
 * @returns {Object} AI 提供商实例
 * @throws {Error} 如果提供商类型无效
 */
export function createProvider(provider, config, logger, fileStorage) {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(config, logger, fileStorage);
    case 'claude':
      return new ClaudeProvider(config, logger, fileStorage);
    case 'deepseek':
      return new DeepseekProvider(config, logger, fileStorage);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export { OpenAIProvider, ClaudeProvider, DeepseekProvider };