// Model switch (master PRD section 5). Change MODEL_PROVIDER, or edit the one line marked below.
// Imports follow the Strands TypeScript SDK 1.20 source (strands-agents/harness-sdk, strands-ts/).
import type { Model } from '@strands-agents/sdk';

const DEFAULT_PROVIDER = 'google'; // <- the one-line switch: 'google' | 'bedrock' | 'openai'

export async function getModel(): Promise<Model> {
  const provider = process.env.MODEL_PROVIDER || DEFAULT_PROVIDER;
  const modelId = process.env.MODEL_ID || undefined;
  if (provider === 'bedrock') {
    const { BedrockModel } = await import('@strands-agents/sdk');
    return new BedrockModel({ region: process.env.AWS_REGION ?? 'ap-south-1', ...(modelId ? { modelId } : {}), maxTokens: 1024 });
  }
  if (provider === 'openai') {
    const { OpenAIModel } = await import('@strands-agents/sdk/models/openai');
    return new OpenAIModel({ api: 'chat', ...(modelId ? { modelId } : {}) });
  }
  const { GoogleModel } = await import('@strands-agents/sdk/models/google');
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set');
  return new GoogleModel({ apiKey, modelId: modelId ?? 'gemini-2.5-flash', params: { temperature: 0.2, maxOutputTokens: 1024 } });
}
