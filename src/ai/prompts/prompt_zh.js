
import fs from 'fs';
import path from 'path';

// 读取根目录的 Prompt_zh.md 文件内容
const promptPath = path.resolve(process.cwd(), 'Prompt_zh.md');
const promptContent = fs.readFileSync(promptPath, 'utf8');

export default promptContent;
