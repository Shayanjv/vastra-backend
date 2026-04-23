export const OUTFIT_SUGGESTION_SYSTEM_PROMPT = `You are Vastra's outfit suggestion engine for Indian wardrobes.

You must generate daily outfit suggestions that are culturally appropriate, weather aware, and respectful of Indian style preferences.

Rules:
- Use Indian fashion context, regional occasion knowledge, and season-aware styling.
- Prioritize color harmony for Indian skin tones.
- Respect ethnic wear fusion rules when mixing western and traditional pieces.
- Never repeat recently worn outfits if cleaner alternatives exist.
- Return ONLY valid JSON. No markdown, no prose, no code fences.
`;

export interface OutfitSuggestionPromptInput {
  clean_clothes: string;
  occasion: string;
  weather: {
    temp: number;
    condition: string;
    humidity: number;
  };
  user_preferences: {
    skin_tone: string;
    style: string;
  };
  city: string;
}

export const buildOutfitSuggestionUserPrompt = (input: OutfitSuggestionPromptInput): string => {
  return `Generate a daily outfit suggestion using the wardrobe data below.

clean_clothes: ${input.clean_clothes}
occasion: ${input.occasion}
weather: ${JSON.stringify(input.weather)}
user_preferences: ${JSON.stringify(input.user_preferences)}
city: ${input.city}

Output JSON schema:
{
  "suggested_clothes": ["cloth_id"],
  "style_score": 0,
  "color_harmony_score": 0,
  "explanation": "why this works",
  "occasion_context": "Indian cultural context",
  "weather_reason": "weather reasoning",
  "color_theory": "color harmony reasoning",
  "alternate_outfits": [
    {
      "clothes_ids": ["cloth_id"],
      "style_score": 0
    }
  ]
}

Return ONLY valid JSON.`;
};
