export type LaundryQueueStatus = "overdue" | "due" | "soon";

export interface FabricCareTips {
  fabric_type: string;
  recommended_wash_methods: string[];
  water_temperature_guidance: string;
  indian_specific_tips: string[];
  monsoon_drying_tips: string[];
  care_tips: string[];
}

export const LAUNDRY_QUEUE_DUE_WEAR_THRESHOLD = 4;
export const LAUNDRY_QUEUE_DUE_DAYS_THRESHOLD = 8;

export const LAUNDRY_QUEUE_SOON_WEAR_THRESHOLD = 3;
export const LAUNDRY_QUEUE_SOON_DAYS_THRESHOLD = 7;

export const LAUNDRY_QUEUE_OVERDUE_WEAR_THRESHOLD = 5;
export const LAUNDRY_QUEUE_OVERDUE_DAYS_THRESHOLD = 10;

export const LAUNDRY_QUEUE_STATUS_WEIGHT: Record<LaundryQueueStatus, number> = {
  overdue: 300,
  due: 200,
  soon: 100
};

export const LAUNDRY_DEFAULT_FABRIC_KEY = "OTHER";

export const LAUNDRY_FABRIC_CARE_TIPS: Record<string, FabricCareTips> = {
  COTTON: {
    fabric_type: "COTTON",
    recommended_wash_methods: ["Machine wash", "Hand wash"],
    water_temperature_guidance: "Use cool to lukewarm water, ideally 20C to 35C.",
    indian_specific_tips: [
      "Separate dark cotton kurtas and jeans to prevent color bleed.",
      "Use mild detergent for printed cotton sarees and dupattas.",
      "Dry cotton garments inside out to preserve festive colors."
    ],
    monsoon_drying_tips: [
      "Use a fan plus cross-ventilation for faster indoor drying.",
      "Avoid leaving damp cotton in washing machine to prevent odor.",
      "Sun-dry when possible during monsoon breaks to avoid mildew."
    ],
    care_tips: [
      "Do not overload machine drum for better rinse quality.",
      "Use medium spin to reduce wrinkles.",
      "Iron slightly damp cotton for cleaner finish."
    ]
  },
  SILK: {
    fabric_type: "SILK",
    recommended_wash_methods: ["Hand wash", "Dry clean"],
    water_temperature_guidance: "Use cold water below 25C only.",
    indian_specific_tips: [
      "Prefer dry clean for heavy silk sarees and zari work.",
      "Use silk-safe liquid detergent for light silk garments.",
      "Do not wring silk dupattas; press water out with towel."
    ],
    monsoon_drying_tips: [
      "Dry flat in shade and avoid direct harsh sunlight.",
      "Keep silica gel sachets in wardrobe for moisture control.",
      "Ensure complete drying before storing to avoid fungus marks."
    ],
    care_tips: [
      "Test detergent on hidden seam before full wash.",
      "Never use bleach on silk.",
      "Store with breathable cotton cover."
    ]
  },
  WOOL: {
    fabric_type: "WOOL",
    recommended_wash_methods: ["Hand wash", "Dry clean"],
    water_temperature_guidance: "Use cold water up to 25C and avoid temperature shocks.",
    indian_specific_tips: [
      "Use wool-safe detergent for sweaters and shawls.",
      "Avoid strong brushing on pashmina blends.",
      "Fold and store woolens with neem or cedar blocks."
    ],
    monsoon_drying_tips: [
      "Dry flat on towel and reshape while damp.",
      "Avoid hanging heavy wool garments to prevent stretching.",
      "Use dehumidified room for thicker winter wear in monsoon."
    ],
    care_tips: [
      "Do not tumble dry.",
      "Rinse thoroughly to remove detergent residue.",
      "Air garments between wears to reduce frequent washing."
    ]
  },
  DENIM: {
    fabric_type: "DENIM",
    recommended_wash_methods: ["Machine wash", "Hand wash"],
    water_temperature_guidance: "Use cold water up to 30C for color retention.",
    indian_specific_tips: [
      "Turn jeans inside out before wash to reduce fading.",
      "Wash indigo denim separately from light kurtas and shirts.",
      "Avoid excessive detergent to keep fabric texture intact."
    ],
    monsoon_drying_tips: [
      "Use strong spin cycle for thick denim during monsoon.",
      "Dry near moving air; denim retains moisture longer.",
      "Do not store partially dry denim in closed wardrobe."
    ],
    care_tips: [
      "Limit wash frequency when not visibly soiled.",
      "Use mild stain spot-cleaning between full washes.",
      "Avoid high heat iron directly on stretch denim."
    ]
  },
  LINEN: {
    fabric_type: "LINEN",
    recommended_wash_methods: ["Machine wash", "Hand wash"],
    water_temperature_guidance: "Use cool water up to 30C.",
    indian_specific_tips: [
      "Use gentle cycle for linen kurtas to reduce fiber stress.",
      "Do not mix with heavy garments during wash.",
      "Steam iron helps maintain crisp look for office wear."
    ],
    monsoon_drying_tips: [
      "Hang in airy space to avoid stale smell.",
      "Sun exposure between rain spells helps sanitize linen.",
      "Store only after fully dry to prevent mildew spots."
    ],
    care_tips: [
      "Avoid strong bleach.",
      "Remove promptly from washer to control wrinkles.",
      "Use medium heat ironing with slight moisture."
    ]
  },
  RAYON: {
    fabric_type: "RAYON",
    recommended_wash_methods: ["Hand wash", "Machine wash gentle"],
    water_temperature_guidance: "Use cold water below 30C.",
    indian_specific_tips: [
      "Use mesh bag for rayon kurtis in machine wash.",
      "Avoid twisting rayon to prevent shape distortion.",
      "Dry away from direct sun to reduce shrinkage risk."
    ],
    monsoon_drying_tips: [
      "Use hanger spacing for airflow around rayon garments.",
      "Avoid stacked drying; rayon needs good ventilation.",
      "Use indoor fan drying when humidity is high."
    ],
    care_tips: [
      "Read care label before first wash.",
      "Use low spin settings.",
      "Iron on low heat with cloth barrier."
    ]
  },
  KHADI: {
    fabric_type: "KHADI",
    recommended_wash_methods: ["Hand wash"],
    water_temperature_guidance: "Use cold water below 30C.",
    indian_specific_tips: [
      "Use mild natural detergent to protect handspun texture.",
      "Do not scrub aggressively on handwoven areas.",
      "Dry khadi in shade to preserve natural dye tones."
    ],
    monsoon_drying_tips: [
      "Dry flat or on broad hanger to avoid stretching.",
      "Use airy balcony drying whenever rain stops.",
      "Store with moisture absorbents during humid weeks."
    ],
    care_tips: [
      "Wash separately for first few washes.",
      "Do not bleach khadi fabrics.",
      "Iron at medium heat while slightly damp."
    ]
  },
  OTHER: {
    fabric_type: "OTHER",
    recommended_wash_methods: ["Hand wash", "Machine wash gentle"],
    water_temperature_guidance: "Use cool water up to 30C unless label states otherwise.",
    indian_specific_tips: [
      "Always check care label before first wash.",
      "Separate heavy festive wear from daily garments.",
      "Use color-safe detergent for mixed wardrobes."
    ],
    monsoon_drying_tips: [
      "Maximize airflow indoors for faster drying.",
      "Avoid overnight damp storage.",
      "Use periodic sun exposure to prevent odors."
    ],
    care_tips: [
      "Prefer mild detergent.",
      "Avoid very hot water unless care label allows.",
      "Store only when completely dry."
    ]
  }
};
