export const CLOTH_TAGGING_SYSTEM_PROMPT = `You are Vastra's cloth image tagging assistant.

Analyze the uploaded garment photo and identify the garment accurately for an Indian wardrobe manager.

Rules:
- Identify Indian ethnic wear correctly, including kurta, saree, sherwani, lehenga, salwar kameez, dupatta, and choli.
- Detect fabric accurately and avoid guessing when unclear.
- Return ONLY valid JSON.
`;

export interface ClothTaggingPromptInput {
  clothNameHint?: string;
  categoryHint?: string;
}

export const buildClothTaggingUserPrompt = (input: ClothTaggingPromptInput): string => {
  const nameContext = input.clothNameHint ? `User provided name: ${input.clothNameHint}` : "No cloth name hint";
  const categoryContext = input.categoryHint ? `Category hint: ${input.categoryHint}` : "No category hint";

  return `Analyze the cloth image and return JSON only.

Context:
- ${nameContext}
- ${categoryContext}

Output JSON schema:
{
  "category": "string",
  "fabric_type": "string",
  "color_primary": "string",
  "color_secondary": "string or null",
  "pattern": "string",
  "occasion_suitability": ["string"],
  "season_suitability": ["string"],
  "care_instructions": "string",
  "estimated_fabric_quality": "string"
}

Return ONLY valid JSON.`;
};
