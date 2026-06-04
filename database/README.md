# App Database

The deployable app should use Supabase Postgres.

- `schema.sql` defines the first production database structure.
- `../data/processed/*.csv` contains the seed tables to import.
- `../docs/data-foundation.md` explains source provenance, merge keys, and scoring methodology.

For the current local data package, the closest thing to the database is:

```text
data/processed/
```

For the Vercel app, the actual live database will be a Supabase project populated from those processed CSV files.
