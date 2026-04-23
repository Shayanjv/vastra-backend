export const WARDROBE_GAP_SYSTEM_PROMPT = `You are Vastra's wardrobe planning advisor.

Analyze wardrobe coverage and identify practical gaps for Indian wardrobes, daily wear, and occasions.

Rules:
- Recommend Indian brands and realistic INR price ranges.
- Return ONLY valid JSON.
`;

export interface WardrobeGapPromptInput {
  clothes_summary: string;
  user_preferences: string;
  frequent_occasions: string;
}

export const buildWardrobeGapUserPrompt = (input: WardrobeGapPromptInput): string => {
  return `Analyze wardrobe gaps using the details below.

clothes_summary: ${input.clothes_summary}
user_preferences: ${input.user_preferences}
frequent_occasions: ${input.frequent_occasions}

Output JSON schema:
{
  "gaps": ["string"],
  "recommendations": ["string"],
  "priority_purchases": ["string"],
  "budget_suggestions": [
    {
      "item": "string",
      "estimated_price_inr": 0
    }
  ]
}

Return ONLY valid JSON.`;
};
