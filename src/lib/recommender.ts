import { recipeIngredientsByRecipeId, recipeVectorsByRecipeId, seedData } from "@/lib/data";
import type {
  AhpWeights,
  FlavorTarget,
  Ingredient,
  RecipeFlavorVector,
  Recommendation,
  VibeValues
} from "@/types";

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const normalizeWeight = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

const normalizeWeightSet = (values: number[]) => {
  const total = values.reduce((sum, value) => sum + normalizeWeight(value), 0);
  if (total <= 0) {
    return values.map(() => 1 / values.length);
  }
  return values.map((value) => normalizeWeight(value) / total);
};

const pointSimilarity = (ax: number, ay: number, bx: number, by: number): number => {
  const maxDistance = Math.sqrt(200 * 200 + 200 * 200);
  const distance = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  return clamp(1 - distance / maxDistance);
};

export const defaultFlavorTarget: FlavorTarget = {
  basic: { x: 10, y: 8 },
  association: { x: 24, y: 10 },
  experience: { x: 34, y: 18 }
};

export const defaultWeights: AhpWeights = {
  cabinet: 40,
  palette: 40,
  vibe: 20,
  basic: 34,
  association: 33,
  experience: 33
};

export const defaultVibes: VibeValues = Object.fromEntries(
  seedData.vibeDimensions.map((dimension) => [dimension.vibe_dimension_id, 15])
);

export const getRecipeVibeVector = (vector: RecipeFlavorVector): VibeValues => {
  const bright = clamp((vector.experience_x_refreshing_minus_heavy + 100) / 2, -100, 100);
  const fresh = clamp((vector.experience_x_refreshing_minus_heavy + vector.basic_x_sweet_minus_sour * -0.35 + 40), -100, 100);
  const adventurous = clamp((-vector.experience_y_smooth_minus_complex * 0.65) + (Math.abs(vector.association_y_herbaceous_minus_creamy) * 0.35), -100, 100);
  const elegant = clamp((vector.experience_y_smooth_minus_complex * 0.45) + (vector.basic_y_bitter_minus_salty * 0.25) + 15, -100, 100);
  const indulgent = clamp((-vector.experience_x_refreshing_minus_heavy * 0.45) + (-vector.association_y_herbaceous_minus_creamy * 0.35) + (vector.basic_x_sweet_minus_sour * 0.25), -100, 100);

  return {
    bright_mellow: bright,
    cozy_fresh: fresh,
    easy_adventurous: adventurous,
    casual_elegant: elegant,
    light_indulgent: indulgent
  };
};

export const inferVibeNudges = (freeText: string): VibeValues => {
  const text = freeText.toLowerCase();
  const nudges: VibeValues = {};
  const add = (key: string, value: number) => {
    nudges[key] = (nudges[key] ?? 0) + value;
  };

  if (/(sun|lawn|patio|pool|beach|picnic|brunch|bright|refresh|summer)/.test(text)) {
    add("bright_mellow", 28);
    add("cozy_fresh", 32);
    add("light_indulgent", -18);
  }
  if (/(cozy|rain|fire|nightcap|winter|warm|comfort)/.test(text)) {
    add("cozy_fresh", -30);
    add("light_indulgent", 22);
  }
  if (/(weird|funky|surprise|adventurous|complex|bold|interesting)/.test(text)) {
    add("easy_adventurous", 36);
  }
  if (/(simple|easy|safe|classic|familiar|crowd)/.test(text)) {
    add("easy_adventurous", -28);
  }
  if (/(date|dinner|elegant|fancy|polished|formal)/.test(text)) {
    add("casual_elegant", 34);
  }
  if (/(casual|game|hang|backyard|low key)/.test(text)) {
    add("casual_elegant", -24);
  }
  if (/(dessert|creamy|rich|decadent|sweet|treat)/.test(text)) {
    add("light_indulgent", 38);
  }

  return nudges;
};

export const mergeVibesWithText = (vibes: VibeValues, freeText: string): VibeValues => {
  const nudges = inferVibeNudges(freeText);
  return Object.fromEntries(
    seedData.vibeDimensions.map((dimension) => {
      const key = dimension.vibe_dimension_id;
      return [key, clamp((vibes[key] ?? 0) + (nudges[key] ?? 0), -100, 100)];
    })
  );
};

const getPaletteScore = (
  vector: RecipeFlavorVector,
  target: FlavorTarget,
  weights: AhpWeights
): number => {
  const [basicWeight, associationWeight, experienceWeight] = normalizeWeightSet([
    weights.basic,
    weights.association,
    weights.experience
  ]);

  const basic = pointSimilarity(
    vector.basic_x_sweet_minus_sour,
    vector.basic_y_bitter_minus_salty,
    target.basic.x,
    target.basic.y
  );
  const association = pointSimilarity(
    vector.association_x_fruity_minus_mineral,
    vector.association_y_herbaceous_minus_creamy,
    target.association.x,
    target.association.y
  );
  const experience = pointSimilarity(
    vector.experience_x_refreshing_minus_heavy,
    vector.experience_y_smooth_minus_complex,
    target.experience.x,
    target.experience.y
  );

  return basic * basicWeight + association * associationWeight + experience * experienceWeight;
};

const getVibeScore = (vector: RecipeFlavorVector, targetVibes: VibeValues): number => {
  const recipeVibes = getRecipeVibeVector(vector);
  const similarities = seedData.vibeDimensions.map((dimension) => {
    const key = dimension.vibe_dimension_id;
    const distance = Math.abs((targetVibes[key] ?? 0) - (recipeVibes[key] ?? 0));
    return clamp(1 - distance / 200);
  });
  return similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
};

export const getRecommendations = ({
  selectedIngredients,
  target,
  vibes,
  freeText,
  weights
}: {
  selectedIngredients: Ingredient[];
  target: FlavorTarget;
  vibes: VibeValues;
  freeText: string;
  weights: AhpWeights;
}): Recommendation[] => {
  const selectedIngredientIds = new Set(selectedIngredients.map((ingredient) => ingredient.canonical_ingredient_id));
  const selectedGroups = new Set(selectedIngredients.map((ingredient) => ingredient.substitute_group_id));
  const textAdjustedVibes = mergeVibesWithText(vibes, freeText);
  const [cabinetWeight, paletteWeight, vibeWeight] = normalizeWeightSet([
    weights.cabinet,
    weights.palette,
    weights.vibe
  ]);

  return seedData.recipes
    .map((recipe) => {
      const recipeIngredients = recipeIngredientsByRecipeId.get(recipe.recipe_id) ?? [];
      const requiredIngredients = recipeIngredients.filter((ingredient) => !ingredient.is_optional);
      const vector = recipeVectorsByRecipeId.get(recipe.recipe_id);
      if (!vector) {
        return null;
      }

      const missing = requiredIngredients.filter(
        (ingredient) =>
          !selectedIngredientIds.has(ingredient.canonical_ingredient_id) &&
          !selectedGroups.has(ingredient.substitute_group_id)
      );
      const missingGroups = Array.from(new Set(missing.map((ingredient) => ingredient.substitute_group_id)));
      const missingNames = Array.from(new Set(missing.map((ingredient) => ingredient.canonical_ingredient_name)));
      const requiredCount = requiredIngredients.length;
      const availableCount = requiredCount - missing.length;
      const missingPenalty = missingGroups.length === 0 ? 0 : missingGroups.length === 1 ? 0.18 : missingGroups.length === 2 ? 0.36 : 0.7;
      const cabinetScore = clamp(1 - missingPenalty);
      const paletteScore = getPaletteScore(vector, target, weights);
      const vibeScore = getVibeScore(vector, textAdjustedVibes);
      const totalScore = cabinetScore * cabinetWeight + paletteScore * paletteWeight + vibeScore * vibeWeight;

      return {
        recipe,
        ingredients: recipeIngredients,
        vector,
        missingGroups,
        missingNames,
        availableCount,
        requiredCount,
        cabinetScore,
        paletteScore,
        vibeScore,
        totalScore,
        label: missingGroups.length === 0 ? "ready" : missingGroups.length <= 2 ? "grocery" : "stretch"
      } satisfies Recommendation;
    })
    .filter((recommendation): recommendation is Recommendation => recommendation !== null)
    .sort((a, b) => b.totalScore - a.totalScore);
};

export const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;
