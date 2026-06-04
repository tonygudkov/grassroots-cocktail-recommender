# Data Foundation

This package consolidates the current Grassroots Cocktail Recommender data into one auditable place before app development. The processed tables live in `data/processed`, and the repeatable build script is `scripts/Build-DataFoundation.ps1`.

## Current Build

- Ingredient flavor vectors: 100
- Canonical ingredients: 104
- Starter recipes: 41
- Recipe ingredient rows: 147
- Cocktail-level flavor vectors: 41
- Recipe-only ingredients still needing flavor vectors: 4
- Substitute groups: 64 generated from ingredient aliases and category heuristics

The four recipe-only ingredients are `coconut cream`, `cola`, `fresh ginger`, and `white peach puree`. They are intentionally flagged instead of being forced into inaccurate flavor profiles.

## Source Registry

The source registry is stored in `data/processed/source_registry.csv`.

| Source ID | Role | Current Use |
| --- | --- | --- |
| `user_workbook_quantitative_profiles` | Starter ingredient flavor map | Imported 100 ingredient profiles, ranks, categories, confidence fields, source notes, and map coordinates from the supplied Excel workbook. |
| `diffords_top_100_pdf` | Ingredient-frequency provenance | Used only indirectly through the workbook/PDF for the top-100 ingredient order. No Difford recipe text or recipes are imported. |
| `iba_starter_recipe_seed` | Starter cocktail recipes | Imported factual recipe names, categories, ingredient names, and amounts from an IBA-oriented starter seed. No method prose is stored. |
| `mixology_tools_candidate` | Future recipe/taxonomy expansion | Not imported yet. Strong candidate because it advertises open data, a free public API, hierarchy/taxonomy, inventory-like search, and similarity analytics. |
| `thecocktaildb_candidate` | Optional recipe/API expansion | Not imported yet. Useful for prototyping, but production-key and usage rules need review before public deployment. |
| `flavordb_reference` | Future flavor-descriptor enrichment | Referenced by the workbook source notes; not bulk imported yet. |
| `mdpi_spirits_ml_reference` | Spirit-category descriptor calibration | Referenced by the workbook source notes; useful for upgrading spirit profiles. |
| `usda_fdc_reference` | Future composition enrichment | Referenced by the workbook source notes; useful for sugar, fat, acid, sodium, and grocery-friction features. |

## Merge Keys

The system uses three ingredient identifiers:

1. `canonical_ingredient_id`: a stable slug generated from the canonical ingredient name, such as `lime_juice_freshly_squeezed`.
2. `normalized_name`: the lowercase punctuation-stripped ingredient text used for exact and alias matching.
3. `substitute_group_id`: the practical cabinet-matching group, such as `liqueur_orange`, `spirit_whiskey`, or `citrus_juice_lime`.

Recipe ingredients first match through `data/manual/ingredient_aliases_seed.csv`. If no alias exists, the build script checks for an exact normalized profile name. If neither exists, the ingredient is kept as recipe-only and appears in `unmatched_recipe_ingredients.csv`.

## Substitution Logic

Availability should be evaluated in layers:

1. Exact canonical ingredient match.
2. Substitute group match.
3. Missing ingredient count for Grocery Run.

This means a user with `Cointreau` can satisfy recipes asking for `Triple Sec`, and a user with rye or bourbon can satisfy an American-whiskey recipe. Exact style can still be used later as a quality boost, but it should not block discovery.

## Flavor Vectors

The workbook already defines three two-axis maps:

- Basic flavor: `sweet - sour` and `bitter - salty`
- Flavor association: `fruity - mineral` and `herbaceous - creamy`
- Drinking experience: `refreshing - heavy` and `smooth - complex`

`recipe_flavor_vectors.csv` computes each cocktail's coordinates from the weighted average of its profiled ingredients. Amounts are converted to approximate milliliters where possible. Dashes, bar spoons, teaspoons, pieces, leaves, and top-ups use simple documented approximations in the build script.

Important caveat: the workbook percentages are normalized relative weights, not lab-measured intensity. They are useful for similarity ranking, but the app should show confidence lightly or use it internally.

## Vibe Layer

`vibe_dimensions.csv` defines five first-pass sliders:

- `Mellow` to `Bright`
- `Cozy` to `Fresh`
- `Easy` to `Adventurous`
- `Casual` to `Elegant`
- `Light` to `Indulgent`

The free-text vibe box should map user language into these dimensions and optional tags. For privacy and low maintenance, the app can avoid storing raw vibe text unless the user explicitly saves a preference.

## AHP Fit

The data supports an AHP-style ranking flow:

1. User assigns top-level weights to `Cabinet fit`, `Palette Pairing`, and `Today's Tone`.
2. Palette Pairing has subweights for `Basic flavor`, `Flavor association`, and `Drinking experience`.
3. The system computes similarity on each flavor map and combines the scores using the user weights.
4. Cabinet fit uses exact/substitute matches and missing ingredient count.
5. Today's Tone uses slider similarity plus optional free-text inference.

Recommended first scoring shape:

```text
overall_score =
  cabinet_weight * cabinet_score +
  palette_weight * (
    basic_weight * basic_similarity +
    association_weight * association_similarity +
    experience_weight * experience_similarity
  ) +
  vibe_weight * vibe_similarity
```

Grocery Run should not be a separate recipe database. It is a view over the same recipes where the user's cabinet misses one or two substitute groups.

## Responsible Use Notes

- Do not scrape or redistribute Difford recipe content without permission.
- Keep the workbook-derived flavor profiles traceable and marked with confidence.
- Treat Mixology Tools as the preferred next expansion candidate only after confirming terms and import stability.
- Treat TheCocktailDB as optional unless production API requirements are acceptable.
- Use FlavorDB, USDA FoodData Central, and the MDPI spirits paper as enrichment/reference sources rather than silently copied black-box data.
