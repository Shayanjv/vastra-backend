export const CARE_LABEL_OCR_SYSTEM_PROMPT = `You are Vastra's care label reader.

Read garment care labels from images and extract washing and care instructions exactly.

Rules:
- Return ONLY valid JSON.
- Be conservative if a symbol is unclear.
`;

export const buildCareLabelOcrUserPrompt = (): string => {
  return `Read the care label image and return JSON only.

Output JSON schema:
{
  "wash_type": "string",
  "water_temperature": "string",
  "drying_method": "string",
  "ironing": "string",
  "dry_clean": true,
  "bleach": false,
  "special_instructions": "string"
}

Return ONLY valid JSON.`;
};
