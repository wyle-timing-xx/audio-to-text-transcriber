// AI 提供商基类

/**
 * AI 提供商基类
 * 定义所有 AI 提供商需要实现的接口
 */
class BaseProvider {
  /**
   * 创建 AI 提供商实例
   * @param {Object} config AI 配置
   * @param {Object} logger 日志记录器
   * @param {Object} fileStorage 文件存储工具
   */
  constructor(config, logger, fileStorage) {
    this.config = config;
    this.logger = logger;
    this.fileStorage = fileStorage;
    
    if (new.target === BaseProvider) {
      throw new TypeError("Cannot instantiate BaseProvider directly");
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
   * 初始化 AI 提供商
   */
  initialize() {
    throw new Error("Method 'initialize()' must be implemented");
  }

  /**
   * 发送部分转录片段（可选实现）
   * @param {string} text 部分转录文本
   * @returns {Promise<void>}
   */
  async notifyPartial(text) {
    // 默认空实现，子类可以覆盖
    return Promise.resolve();
  }

  /**
   * 流式获取问题的回答
   * @param {Object[]} messages 消息数组
   * @param {Object} controller 中断控制器
   * @returns {Promise<string>} 完整回答
   */
  async streamCompletion(messages, controller) {
    throw new Error("Method 'streamCompletion()' must be implemented");
  }
}

export default BaseProvider;