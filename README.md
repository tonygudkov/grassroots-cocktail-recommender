# Grassroots Cocktail Recommender

A Vercel-ready Next.js app for cabinet-aware cocktail recommendations, flavor-map matching, and vibe matching.

The app has two recommendation modes:

- `Create a known cocktail`: ranks known recipes against the user's cabinet, flavor target, and vibe target.
- `Create a new cocktail for me`: generates original recipes from classic cocktail templates, cabinet ingredients, and transparent flavor-synergy rules.

## Run Locally

```powershell
npm install
npm run dev
```

The local app uses `data/processed/app_seed.json` as its starter recipe and flavor database.

## Supabase Setup

1. Create a Supabase project.
2. Run `database/schema.sql` in the Supabase SQL editor.
3. Import the seed CSVs from `data/processed` in this order:
   - `source_registry.csv`
   - `substitute_groups.csv`
   - `ingredients.csv`
   - `ingredient_flavor_vectors.csv`
   - `recipes.csv`
   - `recipe_ingredients.csv`
   - `recipe_flavor_vectors.csv`
   - `vibe_dimensions.csv`
4. Add these environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Without Supabase env vars, the app runs in browser-only demo mode and stores the cabinet in local storage.

## Method Docs

- `docs/data-foundation.md`
- `docs/cocktail-creation-engine.md`
- `docs/final-presentation-technical-documentation.md`
- `docs/github-vercel-handoff.md`

## Deploy

Import this folder into Vercel as a Next.js project. Vercel will run:

```powershell
npm run build
```

For a teammate handoff, use `docs/github-vercel-handoff.md`. The project is designed to be pushed to GitHub first, then imported into Vercel from the GitHub repository.
