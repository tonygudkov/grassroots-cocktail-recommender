# Supabase Seed Import Order

Use Supabase Table Editor CSV import or `psql` copy in this order:

1. `data/processed/source_registry.csv`
2. `data/processed/substitute_groups.csv`
3. `data/processed/ingredients.csv`
4. `data/processed/ingredient_flavor_vectors.csv`
5. `data/processed/recipes.csv`
6. `data/processed/recipe_ingredients.csv`
7. `data/processed/recipe_flavor_vectors.csv`
8. `data/processed/vibe_dimensions.csv`

The user tables are not seeded. They are populated by Supabase Auth and the app after users save cabinets or preferences.
