// 键盘监听模块
import readline from 'readline';

/**
 * 键盘监听器类
 * 监听特定键盘组合键并触发回调
 */
class KeyboardListener {
  /**
   * 创建键盘监听器
   */
  constructor() {
    this.callbacks = {};
    this.isListening = false;
    this.rl = null;
  }

  /**
   * 开始监听键盘输入
   */
  startListening() {
    if (this.isListening) return;

    // 创建readline接口
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    
    // 关闭readline的默认行为，使其不打印提示符
    this.rl.setPrompt('');
    this.rl.prompt(false);
    
    // 配置stdin为原始模式，这样可以捕获Ctrl组合键
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // 监听keypress事件
    process.stdin.on('keypress', (str, key) => {
      // 检查是否按下Ctrl+T
      if (key.ctrl && key.name === 't') {
        console.log('\n🔴 检测到 Ctrl+T 组合键，触发中断...');
        
        // 触发注册的回调
        if (this.callbacks['ctrl+t']) {
          this.callbacks['ctrl+t'].forEach(callback => callback());
        }
      }
      
      // 按下Ctrl+C时退出程序
      if (key.ctrl && key.name === 'c') {
        process.emit('SIGINT');
      }
    });
    
    this.isListening = true;
    console.log('⌨️  键盘监听已启动，按 Ctrl+T 可中断 AI 生成');
  }

  /**
   * 停止监听键盘输入
   */
  stopListening() {
    if (!this.isListening) return;
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    
    process.stdin.removeAllListeners('keypress');
    this.isListening = false;
  }

  /**
   * 注册按键回调函数
   * @param {string} key 键名，如 'ctrl+t'
   * @param {Function} callback 回调函数
   */
  registerCallback(key, callback) {
    if (!this.callbacks[key]) {
      this.callbacks[key] = [];
    }
    this.callbacks[key].push(callback);
  }

  /**
   * 取消注册按键回调函数
   * @param {string} key 键名
   * @param {Function} callback 回调函数
   */
  unregisterCallback(key, callback) {
    if (this.callbacks[key]) {
      this.callbacks[key] = this.callbacks[key].filter(cb => cb !== callback);
    }
  }
}

export default KeyboardListener;