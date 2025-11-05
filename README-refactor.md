# 项目重构：模块化架构与中断功能

本次提交包含了对项目的完整重构，将单文件结构转换为模块化架构，并改进了 AI 回答中断功能。

## 主要变更

### 1. 模块化架构
- 将单文件应用拆分为多个专注于特定功能的模块
- 创建了清晰的接口边界和依赖注入模式
- 改进了配置管理和验证

### 2. 中断功能改进
- 创建专门的 InterruptibleController 类来管理中断状态
- 改进中断检测和处理逻辑
- 提供可配置的中断敏感度

### 3. 开发工具支持
- 添加 Jest 测试框架
- 配置 ESLint 和 Prettier
- 创建 Docker 支持

### 4. 文档与指南
- 创建详细的使用指南和开发文档
- 添加贡献指南和更新日志

## 新的目录结构

```
src/
├── index.js                   # 主入口文件
├── config/                    # 配置模块
│   ├── index.js               # 配置加载和验证
│   └── defaults.js            # 默认配置值
├── transcription/             # 转录模块
│   ├── index.js               # 转录模块导出
│   ├── audio-transcriber.js   # 音频转录器
│   └── deepgram-client.js     # Deepgram API 客户端封装
├── ai/                        # AI 模块
│   ├── index.js               # AI 模块导出
│   ├── ai-manager.js          # AI 对话管理
│   ├── interruption.js        # 中断控制器
│   └── providers/             # AI 提供商实现
│       ├── index.js           # 提供商导出和工厂
│       ├── base-provider.js   # AI 提供商基类
│       ├── openai.js          # OpenAI 实现
│       ├── claude.js          # Claude 实现
│       └── deepseek.js        # Deepseek 实现
└── utils/                     # 工具模块
    ├── index.js               # 工具函数导出
    ├── logger.js              # 日志记录
    ├── file-storage.js        # 文件存储
    └── stream-utils.js        # 流处理工具
```

## 测试与文档

添加了单元测试和详细文档：
- `__tests__/` - 测试文件
- `docs/` - 项目文档

## 未来计划

此次重构为未来的改进奠定了基础：
- TypeScript 迁移
- Web 界面开发
- 语音合成集成