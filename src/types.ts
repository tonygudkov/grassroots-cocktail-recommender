export type Ingredient = {
  canonical_ingredient_id: string;
  ingredient_name: string;
  normalized_name: string;
  ingredient_category: string;
  substitute_group_id: string;
  has_flavor_profile: boolean;
  flavor_profile_confidence: string;
  source_rank: number | null;
  data_origin: string;
  review_status: string;
};

export type IngredientFlavorVector = {
  canonical_ingredient_id: string;
  ingredient_name: string;
  normalized_name: string;
  substitute_group_id: string;
  rank: number | null;
  category: string;
  source_level: string;
  confidence: string;
  basic_x_sweet_minus_sour: number;
  basic_y_bitter_minus_salty: number;
  association_x_fruity_minus_mineral: number;
  association_y_herbaceous_minus_creamy: number;
  experience_x_refreshing_minus_heavy: number;
  experience_y_smooth_minus_complex: number;
  top_basic: string;
  top_association: string;
  top_experience: string;
};

export type Recipe = {
  recipe_id: string;
  recipe_name: string;
  source_id: string;
  source_recipe_id: string;
  source_url: string;
  category: string;
  alcoholic: boolean;
  iba_status: string;
  notes: string;
};

export type RecipeIngredient = {
  recipe_id: string;
  recipe_name: string;
  line_no: number;
  source_ingredient_name: string;
  canonical_ingredient_id: string;
  canonical_ingredient_name: string;
  substitute_group_id: string;
  quantity: number | null;
  unit: string;
  amount_ml_approx: number | null;
  is_optional: boolean;
  match_status: string;
  flavor_profile_status: string;
  source_id: string;
};

export type RecipeFlavorVector = {
  recipe_id: string;
  recipe_name: string;
  profiled_weight_ml_approx: number;
  total_weight_ml_approx: number;
  flavor_profile_coverage_ratio: number;
  basic_x_sweet_minus_sour: number;
  basic_y_bitter_minus_salty: number;
  association_x_fruity_minus_mineral: number;
  association_y_herbaceous_minus_creamy: number;
  experience_x_refreshing_minus_heavy: number;
  experience_y_smooth_minus_complex: number;
};

export type VibeDimension = {
  vibe_dimension_id: string;
  left_label: string;
  right_label: string;
  default_weight_pct: number;
  notes: string;
};

export type SeedData = {
  generatedAt: string;
  ingredients: Ingredient[];
  ingredientFlavorVectors: IngredientFlavorVector[];
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  recipeFlavorVectors: RecipeFlavorVector[];
  vibeDimensions: VibeDimension[];
};

export type Point = {
  x: number;
  y: number;
};

export type FlavorTarget = {
  basic: Point;
  association: Point;
  experience: Point;
};

export type AhpWeights = {
  cabinet: number;
  palette: number;
  vibe: number;
  basic: number;
  association: number;
  experience: number;
};

export type VibeValues = Record<string, number>;

export type Recommendation = {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  vector: RecipeFlavorVector;
  missingGroups: string[];
  missingNames: string[];
  availableCount: number;
  requiredCount: number;
  cabinetScore: number;
  paletteScore: number;
  vibeScore: number;
  totalScore: number;
  label: "ready" | "grocery" | "stretch";
};

export type GeneratedIngredientLine = {
  ingredientId: string;
  ingredientName: string;
  substituteGroupId: string;
  amount: string;
  role: "base" | "acid" | "sweetener" | "modifier" | "lengthener" | "accent" | "texture";
  isInCabinet: boolean;
};

export type GeneratedCocktail = {
  id: string;
  name: string;
  template: string;
  style: string;
  score: number;
  missingNames: string[];
  lines: GeneratedIngredientLine[];
  method: string[];
  rationale: string[];
};
