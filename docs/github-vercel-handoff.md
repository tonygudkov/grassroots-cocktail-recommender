# GitHub and Vercel Handoff

This project is ready to live in a GitHub repository and then be imported into Vercel as a Next.js app.

## Recommended Repository Setup

Suggested repository name:

```text
grassroots-cocktail-recommender
```

Recommended visibility:

- Use a private repository while the class team is still revising data and presentation material.
- Switch to public later only after confirming that no private notes, credentials, or unlicensed source files were added.

## What Should Be Uploaded to GitHub

Upload these project folders and files:

- `data`
- `database`
- `docs`
- `scripts`
- `src`
- `.env.example`
- `.eslintrc.json`
- `.gitignore`
- `next.config.mjs`
- `next-env.d.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `tsconfig.json`
- `vercel.json`

Do not upload these local-only files or folders:

- `.env`
- `.next`
- `node_modules`
- `dev-server.err.log`
- `dev-server.out.log`
- `.vercel`

The existing `.gitignore` already excludes the most important local-only folders and environment files.

## Option A: Upload with GitHub Desktop

This is the easiest option on a computer without command-line Git.

1. Install GitHub Desktop.
2. Choose `File > Add local repository`.
3. Select this project folder.
4. If GitHub Desktop asks to initialize a repository, allow it.
5. Review the changed files and confirm `.env`, `.next`, and `node_modules` are not selected.
6. Commit with a message like:

```text
Initial Grassroots Vercel app
```

7. Publish the repository to GitHub.

## Option B: Upload with Command-Line Git

If Git is installed, run these commands from the project folder:

```powershell
git init
git add .
git commit -m "Initial Grassroots Vercel app"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/grassroots-cocktail-recommender.git
git push -u origin main
```

Replace `YOUR_ACCOUNT` with the GitHub username or organization that will own the project.

## Option C: Upload the GitHub-Ready Zip

The project archive `Grassroots-Cocktail-Recommender-github-ready.zip` is intended for web upload or teammate handoff. It excludes local build output, dependencies, and environment files.

After extracting the zip, upload the extracted contents to GitHub using GitHub Desktop, command-line Git, or GitHub's web upload flow.

## Vercel Import

After the project is on GitHub:

1. Open Vercel.
2. Choose `Add New > Project`.
3. Import the GitHub repository.
4. Keep the framework preset as `Next.js`.
5. Use the default build command:

```text
npm run build
```

6. Add Supabase environment variables when the team is ready for account-based saved cabinets:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Without these variables, the app still runs in demo mode using the bundled seed data and browser local storage.

## Supabase Setup

Use `database/schema.sql` to create the database schema. Then import the CSV files from `data/processed` in the order listed in `database/import-order.md`.

The app uses Supabase only for low-maintenance account features:

- User login
- Saved cabinet items
- Saved preference sets
- Saved vibe preferences

The public cocktail, ingredient, flavor-vector, and source tables can be read by the app without user-specific permissions. User-specific tables are protected by Row Level Security.

## Pre-Public Checklist

Before making the repository public:

- Confirm `.env` was not uploaded.
- Confirm no API keys or Supabase service-role keys are present.
- Confirm the source registry and documentation are included.
- Confirm the team is comfortable publishing the starter recipe and ingredient data files.
- Confirm the README clearly states that Difford recipe data was not scraped or redistributed.
