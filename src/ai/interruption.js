// 中断控制器

/**
 * 可中断控制器类
 * 封装 AbortController 并提供中断状态管理
 */
class InterruptibleController {
  /**
   * 创建一个可中断控制器
   */
  constructor() {
    this.controller = new AbortController();
    this.interrupted = false;
  }

  /**
   * 中断当前操作
   */
  abort() {
    this.interrupted = true;
    this.controller.abort();
  }

  /**
   * 获取 AbortSignal
   * @returns {AbortSignal} 中断信号
   */
  get signal() {
    return this.controller.signal;
  }

  /**
   * 检查是否已被中断
   * @returns {boolean} 是否已被中断
   */
  isInterrupted() {
    return this.interrupted;
  }

  /**
   * 重置控制器状态
   */
  reset() {
    this.controller = new AbortController();
    this.interrupted = false;
  }
}

export default InterruptibleController;