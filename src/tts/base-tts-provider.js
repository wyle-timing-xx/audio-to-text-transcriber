// 语音合成基类
// 定义所有TTS提供商需要实现的通用接口

/**
 * 语音合成提供商基类
 * 定义所有语音合成提供商需要实现的接口
 */
class BaseTTSProvider {
  /**
   * 创建语音合成提供商实例
   * @param {Object} config 全局配置
   */
  constructor(config) {
    this.config = config;
    
    if (new.target === BaseTTSProvider) {
      throw new TypeError("Cannot instantiate BaseTTSProvider directly");
    }
  }

  /**
   * 获取提供商名称
   * @returns {string} 提供商名称
   */
  getName() {
    throw new Error("Method 'getName()' must be implemented");
  }

  /**
   * 初始化语音合成提供商
   */
  initialize() {
    throw new Error("Method 'initialize()' must be implemented");
  }

  /**
   * 文本转语音
   * @param {string} text 要转换的文本
   * @param {Object} options 可选配置参数，例如语音ID、情感等
   * @returns {Promise<void>} 完成语音合成的承诺
   */
  async textToSpeech(text, options = {}) {
    throw new Error("Method 'textToSpeech()' must be implemented");
  }

  /**
   * 停止当前的语音合成
   */
  stop() {
    throw new Error("Method 'stop()' must be implemented");
  }

  /**
   * 获取可用的声音列表
   * @returns {Promise<Array>} 可用声音列表
   */
  async getVoices() {
    throw new Error("Method 'getVoices()' must be implemented");
  }
}

export default BaseTTSProvider;