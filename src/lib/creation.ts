import { seedData } from "@/lib/data";
import { mergeVibesWithText } from "@/lib/recommender";
import type {
  AhpWeights,
  FlavorTarget,
  GeneratedCocktail,
  GeneratedIngredientLine,
  Ingredient,
  VibeValues
} from "@/types";

type IngredientChoice = {
  group: string;
  amount: string;
  role: GeneratedIngredientLine["role"];
  preferredNames?: string[];
};

type Template = {
  id: string;
  label: string;
  style: string;
  baseAmount: string;
  choices: IngredientChoice[];
  method: string[];
};

const templates: Template[] = [
  {
    id: "sour",
    label: "Bright Sour",
    style: "shaken, citrus-forward",
    baseAmount: "2 oz",
    choices: [
      { group: "citrus_juice_lime", amount: "3/4 oz", role: "acid" },
      { group: "citrus_juice_lemon", amount: "3/4 oz", role: "acid" },
      { group: "sweetener_simple_syrup", amount: "1/2 oz", role: "sweetener" },
      { group: "sweetener_honey", amount: "1/2 oz", role: "sweetener" },
      { group: "foamer_egg_white", amount: "optional", role: "texture" }
    ],
    method: ["Shake hard with ice.", "Strain into a chilled coupe or over fresh ice.", "Garnish with citrus."]
  },
  {
    id: "highball",
    label: "Lawn Highball",
    style: "tall, crisp, refreshing",
    baseAmount: "1 1/2 oz",
    choices: [
      { group: "mixer_soda_water", amount: "3 oz", role: "lengthener" },
      { group: "mixer_ginger", amount: "3 oz", role: "lengthener" },
      { group: "citrus_juice_lime", amount: "1/2 oz", role: "acid" },
      { group: "citrus_juice_grapefruit", amount: "1 oz", role: "modifier" },
      { group: "fresh_herb_mint", amount: "6 leaves", role: "accent" }
    ],
    method: ["Build in a tall glass over ice.", "Stir briefly.", "Top with bubbles and garnish fresh."]
  },
  {
    id: "daisy",
    label: "Garden Daisy",
    style: "citrus, orange, lightly playful",
    baseAmount: "2 oz",
    choices: [
      { group: "liqueur_orange", amount: "3/4 oz", role: "modifier" },
      { group: "citrus_juice_lime", amount: "3/4 oz", role: "acid" },
      { group: "citrus_juice_lemon", amount: "3/4 oz", role: "acid" },
      { group: "sweetener_agave", amount: "1/4 oz", role: "sweetener" },
      { group: "sweetener_simple_syrup", amount: "1/4 oz", role: "sweetener" }
    ],
    method: ["Shake with ice.", "Strain into a coupe or rocks glass.", "Finish with a citrus wheel."]
  },
  {
    id: "spritz",
    label: "Porch Spritz",
    style: "low-lift, bubbly, aperitif",
    baseAmount: "1 1/2 oz",
    choices: [
      { group: "wine_sparkling", amount: "3 oz", role: "lengthener" },
      { group: "mixer_soda_water", amount: "1 oz", role: "lengthener" },
      { group: "liqueur_bitter_aperitivo", amount: "1 oz", role: "modifier" },
      { group: "vermouth_sweet", amount: "1 oz", role: "modifier" },
      { group: "citrus_juice_orange", amount: "1/2 oz", role: "accent" }
    ],
    method: ["Build over ice in a wine glass.", "Stir gently.", "Garnish with citrus."]
  },
  {
    id: "stirred",
    label: "Evening Stirred",
    style: "spirit-forward, smooth, complex",
    baseAmount: "2 oz",
    choices: [
      { group: "vermouth_sweet", amount: "3/4 oz", role: "modifier" },
      { group: "vermouth_dry", amount: "1/2 oz", role: "modifier" },
      { group: "bitters_aromatic", amount: "2 dashes", role: "accent" },
      { group: "liqueur_bitter_aperitivo", amount: "1/2 oz", role: "modifier" },
      { group: "liqueur_maraschino", amount: "1/4 oz", role: "accent" }
    ],
    method: ["Stir with ice until cold.", "Strain into a chilled coupe or rocks glass.", "Express citrus oil if available."]
  },
  {
    id: "creamy",
    label: "Velvet Treat",
    style: "creamy, sweet, dessert-leaning",
    baseAmount: "1 1/2 oz",
    choices: [
      { group: "dairy_or_cream", amount: "1 oz", role: "texture" },
      { group: "liqueur_cacao", amount: "3/4 oz", role: "modifier" },
      { group: "liqueur_coffee", amount: "3/4 oz", role: "modifier" },
      { group: "sweetener_simple_syrup", amount: "1/4 oz", role: "sweetener" },
      { group: "coffee_espresso", amount: "1 oz", role: "modifier" }
    ],
    method: ["Shake with ice until very cold.", "Strain into a small chilled glass.", "Dust with spice if you have it."]
  }
];

const clamp = (value: number, min = -100, max = 100) => Math.min(max, Math.max(min, value));

const baseGroups = [
  "spirit_gin",
  "spirit_vodka",
  "spirit_rum_sugarcane",
  "spirit_tequila",
  "spirit_mezcal",
  "spirit_whiskey",
  "spirit_brandy"
];

const synergy: Record<string, string[]> = {
  spirit_gin: ["citrus_juice_lemon", "citrus_juice_lime", "fresh_herb_mint", "liqueur_elderflower", "vermouth_dry", "liqueur_maraschino"],
  spirit_vodka: ["citrus_juice_lime", "fruit_juice_cranberry", "mixer_ginger", "coffee_espresso", "liqueur_coffee"],
  spirit_rum_sugarcane: ["citrus_juice_lime", "tropical_juice_pineapple", "sweetener_orgeat", "mixer_ginger", "dairy_or_cream"],
  spirit_tequila: ["citrus_juice_lime", "citrus_juice_grapefruit", "liqueur_orange", "sweetener_agave"],
  spirit_mezcal: ["citrus_juice_lime", "citrus_juice_grapefruit", "liqueur_bitter_aperitivo", "liqueur_chartreuse"],
  spirit_whiskey: ["citrus_juice_lemon", "sweetener_honey", "produce_ginger", "vermouth_sweet", "bitters_aromatic"],
  spirit_brandy: ["liqueur_orange", "dairy_or_cream", "vermouth_sweet", "wine_sparkling", "sweetener_simple_syrup"]
};

const groupDisplayName = (group: string) =>
  group
    .replace(/^spirit_/, "")
    .replace(/^citrus_juice_/, "")
    .replace(/^sweetener_/, "")
    .replace(/^liqueur_/, "")
    .replace(/_/g, " ");

const findIngredientForGroup = (group: string, selected: Ingredient[]) => {
  const fromCabinet = selected.find((ingredient) => ingredient.substitute_group_id === group);
  if (fromCabinet) {
    return { ingredient: fromCabinet, isInCabinet: true };
  }
  const profiled = seedData.ingredients.find(
    (ingredient) => ingredient.substitute_group_id === group && ingredient.has_flavor_profile
  );
  const fallback = profiled ?? seedData.ingredients.find((ingredient) => ingredient.substitute_group_id === group);
  return fallback ? { ingredient: fallback, isInCabinet: false } : null;
};

const chooseBases = (selected: Ingredient[]) => {
  const cabinetBases = selected.filter((ingredient) => baseGroups.includes(ingredient.substitute_group_id));
  if (cabinetBases.length > 0) {
    return cabinetBases.slice(0, 4);
  }
  return seedData.ingredients
    .filter((ingredient) => baseGroups.includes(ingredient.substitute_group_id))
    .slice(0, 4);
};

const templateFit = (template: Template, flavorTarget: FlavorTarget, vibeValues: VibeValues) => {
  let score = 0.5;
  if (template.id === "highball" || template.id === "spritz") {
    score += (vibeValues.cozy_fresh ?? 0) / 260;
    score += flavorTarget.experience.x / 300;
  }
  if (template.id === "sour" || template.id === "daisy") {
    score += Math.max(0, -flavorTarget.basic.x) / 260;
    score += Math.max(0, flavorTarget.experience.x) / 360;
  }
  if (template.id === "stirred") {
    score += Math.max(0, -(vibeValues.easy_adventurous ?? 0)) / 500;
    score += Math.max(0, -flavorTarget.experience.y) / 260;
  }
  if (template.id === "creamy") {
    score += Math.max(0, vibeValues.light_indulgent ?? 0) / 220;
    score += Math.max(0, -flavorTarget.association.y) / 260;
  }
  return Math.max(0, Math.min(1, score));
};

const makeName = (template: Template, base: Ingredient, vibeValues: VibeValues) => {
  const baseName = groupDisplayName(base.substitute_group_id);
  const mood =
    (vibeValues.cozy_fresh ?? 0) > 35
      ? "Sunny"
      : (vibeValues.light_indulgent ?? 0) > 35
        ? "Velvet"
        : (vibeValues.easy_adventurous ?? 0) > 35
          ? "Wild"
          : (vibeValues.casual_elegant ?? 0) > 35
            ? "Evening"
            : "Grassroots";
  const labelWords = template.label.split(" ");
  return `${mood} ${baseName} ${labelWords[labelWords.length - 1]}`;
};

export const createNewCocktails = ({
  selectedIngredients,
  flavorTarget,
  vibes,
  freeText,
  weights
}: {
  selectedIngredients: Ingredient[];
  flavorTarget: FlavorTarget;
  vibes: VibeValues;
  freeText: string;
  weights: AhpWeights;
}): GeneratedCocktail[] => {
  const textAdjustedVibes = mergeVibesWithText(vibes, freeText);
  const bases = chooseBases(selectedIngredients);

  const ideas = bases.flatMap((base) =>
    templates.map((template) => {
      const baseLine: GeneratedIngredientLine = {
        ingredientId: base.canonical_ingredient_id,
        ingredientName: base.ingredient_name,
        substituteGroupId: base.substitute_group_id,
        amount: template.baseAmount,
        role: "base",
        isInCabinet: selectedIngredients.some(
          (ingredient) => ingredient.canonical_ingredient_id === base.canonical_ingredient_id
        )
      };

      const chosenGroups = new Set([base.substitute_group_id]);
      const baseSynergies = synergy[base.substitute_group_id] ?? [];
      const lines = [baseLine];

      for (const choice of template.choices) {
        if (chosenGroups.has(choice.group)) {
          continue;
        }
        const matched = findIngredientForGroup(choice.group, selectedIngredients);
        const isSynergy = baseSynergies.includes(choice.group);
        const isCabinet = Boolean(matched?.isInCabinet);
        if (!matched || (!isSynergy && !isCabinet && lines.length >= 4)) {
          continue;
        }
        lines.push({
          ingredientId: matched.ingredient.canonical_ingredient_id,
          ingredientName: matched.ingredient.ingredient_name,
          substituteGroupId: matched.ingredient.substitute_group_id,
          amount: choice.amount,
          role: choice.role,
          isInCabinet: matched.isInCabinet
        });
        chosenGroups.add(choice.group);
        if (lines.length >= 5) {
          break;
        }
      }

      const missingNames = lines.filter((line) => !line.isInCabinet).map((line) => line.ingredientName);
      const cabinetFit = 1 - Math.min(0.65, missingNames.length * 0.16);
      const synergyScore =
        lines.filter((line) => baseSynergies.includes(line.substituteGroupId)).length / Math.max(1, lines.length - 1);
      const fit = templateFit(template, flavorTarget, textAdjustedVibes);
      const totalWeight = weights.palette + weights.vibe + weights.cabinet || 100;
      const score =
        (fit * weights.palette + cabinetFit * weights.cabinet + (0.6 + synergyScore * 0.4) * weights.vibe) /
        totalWeight;

      return {
        id: `${template.id}_${base.canonical_ingredient_id}`,
        name: makeName(template, base, textAdjustedVibes),
        template: template.label,
        style: template.style,
        score,
        missingNames,
        lines,
        method: template.method,
        rationale: [
          `${template.label} gives the drink a proven structure instead of a random mix.`,
          `${base.ingredient_name} pairs best with ${baseSynergies.map(groupDisplayName).slice(0, 3).join(", ")}.`,
          missingNames.length === 0
            ? "Everything is already in the cabinet."
            : `Grocery Run: ${missingNames.slice(0, 2).join(", ")}${missingNames.length > 2 ? " plus one more" : ""}.`
        ]
      } satisfies GeneratedCocktail;
    })
  );

  return ideas
    .filter((idea) => idea.lines.length >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
};
