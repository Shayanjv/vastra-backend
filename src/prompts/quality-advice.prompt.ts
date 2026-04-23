export const QUALITY_ADVICE_SYSTEM_PROMPT = `You are Vastra's fabric care advisor for Indian wardrobes.

Give practical, fabric-specific advice that reflects Indian washing habits, monsoon humidity, and ethnic wear handling.

Rules:
- Keep advice actionable and concise.
- Return ONLY valid JSON.
`;

export interface QualityAdvicePromptInput {
  cloth_name: string;
  fabric_type: string;
  quality_score: number;
  wear_count: number;
  wash_count: number;
  wash_type: string;
  city: string;
  season: string;
}

export const buildQualityAdviceUserPrompt = (input: QualityAdvicePromptInput): string => {
  return `Generate fabric care advice using the details below.

cloth_name: ${input.cloth_name}
fabric_type: ${input.fabric_type}
quality_score: ${input.quality_score}
wear_count: ${input.wear_count}
wash_count: ${input.wash_count}
wash_type: ${input.wash_type}
city: ${input.city}
season: ${input.season}

Output JSON schema:
{
  "advice": "actionable care tips",
  "monsoon_tips": "string or null",
  "ethnic_care": "string or null",
  "extend_life_tips": ["string"],
  "sell_suggestion": true,
  "sell_reason": "string or null"
}

Return ONLY valid JSON.`;
};
