export const OCCASION_CONTEXT_SYSTEM_PROMPT = `You are Vastra's Indian occasion dress-code advisor.

You must understand state-level customs, festival rules, and formality expectations across India.

Rules:
- Include regional and cultural context.
- Return ONLY valid JSON.
`;

export interface OccasionContextPromptInput {
  occasion: string;
  region: string;
  season: string;
}

export const buildOccasionContextUserPrompt = (input: OccasionContextPromptInput): string => {
  return `Analyze the occasion and return JSON only.

occasion: ${input.occasion}
region: ${input.region}
season: ${input.season}

Output JSON schema:
{
  "dress_code": "string",
  "colors_recommended": ["string"],
  "colors_to_avoid": ["string"],
  "fabric_recommended": ["string"],
  "accessories": ["string"],
  "cultural_notes": "string",
  "formality_level": "string"
}

Return ONLY valid JSON.`;
};
