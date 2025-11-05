// AI 提供商工厂

import OpenAIProvider from './openai.js';
import ClaudeProvider from './claude.js';
import DeepseekProvider from './deepseek.js';

/**
 * 创建 AI 提供商
 * 
 * @param {string} provider 提供商类型
 * @param {Object} config AI 配置
 * @returns {Object} AI 提供商实例
 * @throws {Error} 如果提供商类型无效
 */
export function createProvider(provider, config) {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    case 'deepseek':
      return new DeepseekProvider(config);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export { OpenAIProvider, ClaudeProvider, DeepseekProvider };