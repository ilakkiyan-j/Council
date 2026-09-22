import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4100', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  groqApiKey: process.env.GROQ_API_KEY || '',
  rivenModel: process.env.RIVEN_MODEL || 'qwen/qwen3.8-27b',
  luciferModel: process.env.LUCIFER_MODEL || 'openai/gpt-oss-120b',
  noxApiUrl: process.env.NOX_API_URL || 'http://localhost:4000',
  xionApiUrl: process.env.XION_API_URL || 'http://localhost:5000',
};
