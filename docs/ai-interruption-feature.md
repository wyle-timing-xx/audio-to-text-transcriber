# AI 回答中断功能实现文档

## 功能概述

AI 回答中断功能允许用户在 AI 正在回答问题时，通过说话来中断当前的回答，从而实现更自然流畅的对话体验。这个功能模拟了人类对话中的打断行为，使语音交互更加人性化。

## 核心实现原理

1. **语音检测**：在 AI 回答过程中，系统继续监听用户的语音输入
2. **中断触发**：检测到新的语音输入时，启动中断检测计时器
3. **中断确认**：经过短暂等待（默认 300 毫秒）确认用户确实在说话而不是环境噪音
4. **停止响应**：使用 AbortController 中断当前正在进行的 AI 流式响应
5. **状态切换**：标记当前回答为"已中断"并准备处理新的用户输入

## 技术实现细节

### 1. InterruptibleController 类

创建了一个可中断控制器类来封装 AbortController，提供更好的中断状态管理：

```javascript
class InterruptibleController {
  constructor() {
    this.controller = new AbortController();
    this.interrupted = false;
  }

  abort() {
    this.interrupted = true;
    this.controller.abort();
  }

  get signal() {
    return this.controller.signal;
  }

  isInterrupted() {
    return this.interrupted;
  }

  reset() {
    this.controller = new AbortController();
    this.interrupted = false;
  }
}
```

### 2. 中断检测逻辑

在 AIManager 类中实现了中断检测和处理逻辑：

```javascript
// 准备中断 AI 回答
_prepareInterruption() {
  // 清除之前的中断计时器
  if (this.interruptionTimer) {
    clearTimeout(this.interruptionTimer);
  }

  // 设置新的中断计时器
  this.interruptionTimer = setTimeout(() => {
    // 如果计时器触发，且在检测时间内没有新的输入，则执行中断
    if (Date.now() - this.lastUserInputTime >= this.config.interruptionDetectionMs) {
      this._interruptAIResponse();
    }
  }, this.config.interruptionDetectionMs);
}

// 中断 AI 回答
_interruptAIResponse() {
  if (!this.isProcessing || !this.hasNewUserInput) return;
  
  console.log("\n\n🔄 检测到新输入，中断当前 AI 回答...\n");
  if (this.config.saveToFile) {
    appendFileSync(this.config.qaOutputFile, "\n\n[中断：检测到新输入]\n\n");
  }

  // 中断当前的 AI 响应
  this.currentController.abort();
  
  // 重置状态以准备处理新的用户输入
  this.hasNewUserInput = false;
}
```

### 3. 流式响应适配

修改了所有 AI 提供商的流式响应处理方法，使其支持中断：

1. **通用流处理方法**: `_processStream` 方法添加了中断检测
2. **OpenAI 流式实现**: `_streamOpenAI` 方法增加了 AbortController 支持
3. **Claude 流式实现**: `_streamClaude` 方法增加了 AbortController 支持
4. **Deepseek 流式实现**: `_streamDeepseekWithSDK` 方法增加了 AbortController 支持

所有流处理都添加了：
- 检测是否被中断的逻辑
- 当检测到中断时取消请求的逻辑
- 优雅处理中断异常的逻辑

### 4. 配置选项

增加了两个关键配置项：

```
# 中断功能配置
ALLOW_INTERRUPTION=true       # 是否允许中断 AI 回答
INTERRUPTION_DETECTION_MS=300 # 中断检测时间（毫秒）
```

- `ALLOW_INTERRUPTION`: 控制是否启用中断功能
- `INTERRUPTION_DETECTION_MS`: 控制中断检测的敏感度，值越小越敏感但可能误触发

## 流程图

```
用户说话 → 语音转文字 → 检测到用户静默 → 发送问题给 AI → AI 开始回答
                                                     ↓
用户再次说话 → 语音转文字 → 更新最后输入时间 → 启动中断检测计时器
                                           ↓
                                     等待 300ms
                                           ↓
                               仍有新的语音输入? → 否 → 执行中断
                                           ↓ 是
                                     继续等待新输入
```

## 使用说明

### 1. 配置中断功能

在 `.env` 文件中添加以下配置：

```
ALLOW_INTERRUPTION=true       # 启用中断功能
INTERRUPTION_DETECTION_MS=300 # 中断检测时间（毫秒）
```

可根据需要调整 `INTERRUPTION_DETECTION_MS` 的值：
- 较小的值（如 200ms）：更快响应中断，但可能对环境噪音更敏感
- 较大的值（如 500ms）：减少误触发，但中断响应稍慢

### 2. 使用中断功能

1. 正常使用语音助手，问一个需要较长回答的问题
2. 在 AI 回答过程中，直接开始说话（无需特殊命令）
3. 系统会检测到你的语音输入，并中断当前 AI 回答
4. AI 的回答会被标记为"[回答被中断]"并保存到会话历史
5. 系统会等待你完成新的问题，然后发送给 AI

## 技术注意事项

1. **AbortController 兼容性**: 确保使用 Node.js 18+ 以获得完整的 AbortController 支持
2. **流式处理**: 所有 AI 提供商的流式处理都已统一，使用相同的中断处理方式
3. **中断状态管理**: 中断后的状态管理很重要，特别是确保新问题不会丢失
4. **环境变量检查**: 代码会检查环境变量来决定是否启用中断功能
5. **依赖版本**: 确保使用最新版本的 OpenAI SDK 以获得完整的 AbortController 支持

## 潜在改进空间

1. **更精确的 VAD**: 集成真实的语音活动检测（Voice Activity Detection）以减少误触发
2. **用户可配置的中断词**: 允许设置特定的触发词（如"停止"）来中断 AI
3. **上下文感知中断**: 根据对话上下文智能判断是否应该中断
4. **中断后继续**: 允许 AI 在被中断后，稍后继续之前的回答
5. **视觉反馈**: 在 Web 界面中添加中断状态的视觉指示器