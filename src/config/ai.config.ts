import { OpenAI } from "openai";
import environment from "./environment";

export const AIConfig = {
  mistral: {
    apiKey: environment.MISTRAL_API_KEY,
    baseURL: environment.MISTRAL_BASE_URL,
    model: environment.MISTRAL_MODEL,
    maxTokens: 2000,
    temperature: 0.7
  },
  gemma: {
    apiKey: environment.NVIDIA_GEMMA_API_KEY,
    baseURL: environment.NVIDIA_BASE_URL,
    model: environment.NVIDIA_GEMMA_MODEL,
    maxTokens: 1000,
    temperature: 0.3
  },
  fallback: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000
  }
} as const;

export const mistralClient = new OpenAI({
  apiKey: AIConfig.mistral.apiKey,
  baseURL: AIConfig.mistral.baseURL,
  defaultHeaders: {
    "User-Agent": "vastra-backend/1.0.0"
  }
});

export const gemmaClient = new OpenAI({
  apiKey: AIConfig.gemma.apiKey,
  baseURL: AIConfig.gemma.baseURL,
  defaultHeaders: {
    "User-Agent": "vastra-backend/1.0.0"
  }
});

export const getAiClient = (provider: "mistral" | "gemma"): OpenAI => {
  return provider === "gemma" ? gemmaClient : mistralClient;
};

export default AIConfig;
