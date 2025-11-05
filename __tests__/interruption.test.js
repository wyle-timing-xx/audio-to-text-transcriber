// 中断控制器测试
import InterruptibleController from '../src/ai/interruption.js';

describe('InterruptibleController', () => {
  let controller;

  beforeEach(() => {
    controller = new InterruptibleController();
  });

  test('初始状态应该是未中断', () => {
    expect(controller.isInterrupted()).toBe(false);
  });

  test('调用 abort() 后状态应变为已中断', () => {
    controller.abort();
    expect(controller.isInterrupted()).toBe(true);
  });

  test('调用 reset() 后应重置状态为未中断', () => {
    controller.abort();
    expect(controller.isInterrupted()).toBe(true);
    
    controller.reset();
    expect(controller.isInterrupted()).toBe(false);
  });

  test('应提供 signal 属性', () => {
    expect(controller.signal).toBeDefined();
    expect(controller.signal instanceof AbortSignal).toBe(true);
  });

  test('中断后应创建新的 signal', () => {
    const originalSignal = controller.signal;
    controller.abort();
    controller.reset();
    const newSignal = controller.signal;
    
    expect(originalSignal).not.toBe(newSignal);
  });

  test('使用 fetch API 中断示例', async () => {
    // 模拟 fetch
    global.fetch = jest.fn(() => 
      new Promise(resolve => {
        // 模拟异步操作
        setTimeout(() => resolve({ ok: true }), 100);
      })
    );
    
    // 开始请求
    const fetchPromise = fetch('https://example.com', { 
      signal: controller.signal 
    });
    
    // 立即中断
    controller.abort();
    
    // 应该被拒绝
    await expect(fetchPromise).rejects.toThrow();
  });
});