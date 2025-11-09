// 英文系统提示词 - 从文件读取
import fs from 'fs';
import path from 'path';

// 读取 Markdown 文件内容
const promptPath = path.resolve(process.cwd(), 'transcription_prompts/Prompt_en.md');
const promptContent = fs.readFileSync(promptPath, 'utf8');

export default promptContent;