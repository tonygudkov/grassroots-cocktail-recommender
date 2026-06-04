import seedJson from "../../data/processed/app_seed.json";
import type {
  Ingredient,
  IngredientFlavorVector,
  Recipe,
  RecipeFlavorVector,
  RecipeIngredient,
  SeedData,
  VibeDimension
} from "@/types";

type LooseRecord = Record<string, unknown>;

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  return String(value).toLowerCase() === "true";
};

const rawSeed = seedJson as unknown as {
  generatedAt: string;
  ingredients: LooseRecord[];
  ingredientFlavorVectors: LooseRecord[];
  recipes: LooseRecord[];
  recipeIngredients: LooseRecord[];
  recipeFlavorVectors: LooseRecord[];
  vibeDimensions: LooseRecord[];
};

const normalizeIngredient = (row: LooseRecord): Ingredient => ({
  canonical_ingredient_id: String(row.canonical_ingredient_id),
  ingredient_name: String(row.ingredient_name),
  normalized_name: String(row.normalized_name),
  ingredient_category: String(row.ingredient_category ?? ""),
  substitute_group_id: String(row.substitute_group_id),
  has_flavor_profile: toBoolean(row.has_flavor_profile),
  flavor_profile_confidence: String(row.flavor_profile_confidence ?? ""),
  source_rank: toNumber(row.source_rank),
  data_origin: String(row.data_origin ?? ""),
  review_status: String(row.review_status ?? "")
});

const normalizeFlavorVector = (row: LooseRecord): IngredientFlavorVector => ({
  canonical_ingredient_id: String(row.canonical_ingredient_id),
  ingredient_name: String(row.ingredient_name),
  normalized_name: String(row.normalized_name),
  substitute_group_id: String(row.substitute_group_id),
  rank: toNumber(row.rank),
  category: String(row.category ?? ""),
  source_level: String(row.source_level ?? ""),
  confidence: String(row.confidence ?? ""),
  basic_x_sweet_minus_sour: toNumber(row.basic_x_sweet_minus_sour) ?? 0,
  basic_y_bitter_minus_salty: toNumber(row.basic_y_bitter_minus_salty) ?? 0,
  association_x_fruity_minus_mineral: toNumber(row.association_x_fruity_minus_mineral) ?? 0,
  association_y_herbaceous_minus_creamy: toNumber(row.association_y_herbaceous_minus_creamy) ?? 0,
  experience_x_refreshing_minus_heavy: toNumber(row.experience_x_refreshing_minus_heavy) ?? 0,
  experience_y_smooth_minus_complex: toNumber(row.experience_y_smooth_minus_complex) ?? 0,
  top_basic: String(row.top_basic ?? ""),
  top_association: String(row.top_association ?? ""),
  top_experience: String(row.top_experience ?? "")
});

const normalizeRecipe = (row: LooseRecord): Recipe => ({
  recipe_id: String(row.recipe_id),
  recipe_name: String(row.recipe_name),
  source_id: String(row.source_id ?? ""),
  source_recipe_id: String(row.source_recipe_id ?? ""),
  source_url: String(row.source_url ?? ""),
  category: String(row.category ?? ""),
  alcoholic: toBoolean(row.alcoholic),
  iba_status: String(row.iba_status ?? ""),
  notes: String(row.notes ?? "")
});

const normalizeRecipeIngredient = (row: LooseRecord): RecipeIngredient => ({
  recipe_id: String(row.recipe_id),
  recipe_name: String(row.recipe_name),
  line_no: toNumber(row.line_no) ?? 0,
  source_ingredient_name: String(row.source_ingredient_name),
  canonical_ingredient_id: String(row.canonical_ingredient_id),
  canonical_ingredient_name: String(row.canonical_ingredient_name),
  substitute_group_id: String(row.substitute_group_id),
  quantity: toNumber(row.quantity),
  unit: String(row.unit ?? ""),
  amount_ml_approx: toNumber(row.amount_ml_approx),
  is_optional: toBoolean(row.is_optional),
  match_status: String(row.match_status ?? ""),
  flavor_profile_status: String(row.flavor_profile_status ?? ""),
  source_id: String(row.source_id ?? "")
});

const normalizeRecipeVector = (row: LooseRecord): RecipeFlavorVector => ({
  recipe_id: String(row.recipe_id),
  recipe_name: String(row.recipe_name),
  profiled_weight_ml_approx: toNumber(row.profiled_weight_ml_approx) ?? 0,
  total_weight_ml_approx: toNumber(row.total_weight_ml_approx) ?? 0,
  flavor_profile_coverage_ratio: toNumber(row.flavor_profile_coverage_ratio) ?? 0,
  basic_x_sweet_minus_sour: toNumber(row.basic_x_sweet_minus_sour) ?? 0,
  basic_y_bitter_minus_salty: toNumber(row.basic_y_bitter_minus_salty) ?? 0,
  association_x_fruity_minus_mineral: toNumber(row.association_x_fruity_minus_mineral) ?? 0,
  association_y_herbaceous_minus_creamy: toNumber(row.association_y_herbaceous_minus_creamy) ?? 0,
  experience_x_refreshing_minus_heavy: toNumber(row.experience_x_refreshing_minus_heavy) ?? 0,
  experience_y_smooth_minus_complex: toNumber(row.experience_y_smooth_minus_complex) ?? 0
});

const normalizeVibeDimension = (row: LooseRecord): VibeDimension => ({
  vibe_dimension_id: String(row.vibe_dimension_id),
  left_label: String(row.left_label),
  right_label: String(row.right_label),
  default_weight_pct: toNumber(row.default_weight_pct) ?? 20,
  notes: String(row.notes ?? "")
});

export const seedData: SeedData = {
  generatedAt: rawSeed.generatedAt,
  ingredients: rawSeed.ingredients.map(normalizeIngredient),
  ingredientFlavorVectors: rawSeed.ingredientFlavorVectors.map(normalizeFlavorVector),
  recipes: rawSeed.recipes.map(normalizeRecipe),
  recipeIngredients: rawSeed.recipeIngredients.map(normalizeRecipeIngredient),
  recipeFlavorVectors: rawSeed.recipeFlavorVectors.map(normalizeRecipeVector),
  vibeDimensions: rawSeed.vibeDimensions.map(normalizeVibeDimension)
};

export const ingredientsById = new Map(
  seedData.ingredients.map((ingredient) => [ingredient.canonical_ingredient_id, ingredient])
);

export const recipeIngredientsByRecipeId = new Map<string, RecipeIngredient[]>();
for (const ingredient of seedData.recipeIngredients) {
  const existing = recipeIngredientsByRecipeId.get(ingredient.recipe_id) ?? [];
  existing.push(ingredient);
  recipeIngredientsByRecipeId.set(ingredient.recipe_id, existing);
}

export const recipeVectorsByRecipeId = new Map(
  seedData.recipeFlavorVectors.map((vector) => [vector.recipe_id, vector])
);
