import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import { AIConfig, gemmaClient, mistralClient } from "../config/ai.config";
import logger from "./logger.util";

const delay = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const extractMessageContent = (content: string | null | undefined): string => {
  if (!content || typeof content !== "string") {
    throw new Error("AI returned an empty response");
  }

  return content.trim();
};

export function validateJSON(response: string): unknown {
  try {
    return JSON.parse(response);
  } catch {
    throw new Error("AI response is not valid JSON");
  }
}

export function parseAIResponse<T>(response: string, schema: z.ZodType<T>): T {
  const parsed = validateJSON(response);
  return schema.parse(parsed);
}

export function handleAIError(error: unknown): {
  retryable: boolean;
  useFallback: boolean;
  message: string;
} {
  const message = error instanceof Error ? error.message : "Unknown AI error";
  const loweredMessage = message.toLowerCase();

  const retryable =
    loweredMessage.includes("timeout") ||
    loweredMessage.includes("429") ||
    loweredMessage.includes("503") ||
    loweredMessage.includes("rate limit") ||
    loweredMessage.includes("quota") ||
    loweredMessage.includes("temporarily unavailable");

  const useFallback =
    loweredMessage.includes("quota") ||
    loweredMessage.includes("429") ||
    loweredMessage.includes("rate limit");

  return {
    retryable,
    useFallback,
    message
  };
}

async function callWithRetries(
  client: typeof mistralClient | typeof gemmaClient,
  messages: ChatCompletionMessageParam[],
  maxTokens: number,
  temperature: number,
  model: string,
  label: string
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= AIConfig.fallback.maxRetries; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" }
      });

      return extractMessageContent(response.choices[0]?.message?.content);
    } catch (error) {
      lastError = error;
      const aiError = handleAIError(error);

      logger.warn(`${label} AI call failed`, {
        attempt,
        retryable: aiError.retryable,
        useFallback: aiError.useFallback,
        error: aiError.message,
        timestamp: new Date().toISOString()
      });

      if (!aiError.retryable || attempt === AIConfig.fallback.maxRetries) {
        break;
      }

      await delay(AIConfig.fallback.retryDelay * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to call ${label} AI model`);
}

export async function callMistral(prompt: string, systemPrompt: string): Promise<string> {
  return callWithRetries(
    mistralClient,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    AIConfig.mistral.maxTokens,
    AIConfig.mistral.temperature,
    AIConfig.mistral.model,
    "Mistral"
  );
}

export async function callGemmaVision(imageBase64: string, prompt: string): Promise<string> {
  const imageDataUrl = imageBase64.startsWith("http://") || imageBase64.startsWith("https://")
    ? imageBase64
    : imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

  return callWithRetries(
    gemmaClient,
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl
            }
          }
        ]
      }
    ],
    AIConfig.gemma.maxTokens,
    AIConfig.gemma.temperature,
    AIConfig.gemma.model,
    "Gemma vision"
  );
}
