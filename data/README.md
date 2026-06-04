# Grassroots Cocktail Data Foundation

This folder is the single local data home for the recommender prototype.

## Manual Seeds

- `manual/iba_starter_recipes.json` contains 41 starter cocktail recipes with factual ingredient names and amounts only.
- `manual/ingredient_aliases_seed.csv` maps recipe ingredient wording to canonical ingredient profiles and substitute groups.

## Processed Tables

- `processed/ingredient_flavor_vectors.csv` is the normalized 100-ingredient flavor map from the supplied workbook.
- `processed/ingredients.csv` is the canonical ingredient table used by the app.
- `processed/recipes.csv` is the starter recipe table.
- `processed/recipe_ingredients.csv` links recipes to canonical ingredients, substitute groups, quantities, and match status.
- `processed/recipe_flavor_vectors.csv` aggregates ingredient flavor vectors into cocktail-level flavor coordinates.
- `processed/substitute_groups.csv` lists the substitute families used by cabinet matching.
- `processed/unmatched_recipe_ingredients.csv` flags recipe ingredients that still need flavor profiles.
- `processed/source_registry.csv` records where each imported or candidate source came from and how it is used.
- `processed/vibe_dimensions.csv` defines the first-pass vibe sliders.
- `processed/app_seed.json` bundles the app-facing seed data for the Vercel frontend.

Regenerate the processed files with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Build-DataFoundation.ps1
```
