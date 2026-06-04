create extension if not exists pgcrypto;

create table public.source_registry (
  source_id text primary key,
  source_name text not null,
  source_url text,
  license_or_use_note text,
  imported_data text,
  production_use text
);

create table public.substitute_groups (
  substitute_group_id text primary key,
  display_name text not null,
  notes text
);

create table public.ingredients (
  canonical_ingredient_id text primary key,
  ingredient_name text not null,
  normalized_name text not null,
  ingredient_category text,
  substitute_group_id text not null,
  has_flavor_profile boolean not null default false,
  flavor_profile_confidence text,
  source_rank numeric,
  data_origin text,
  review_status text,
  created_at timestamptz not null default now()
);

create index ingredients_substitute_group_idx
  on public.ingredients (substitute_group_id);

create index ingredients_normalized_name_idx
  on public.ingredients (normalized_name);

create table public.ingredient_flavor_vectors (
  canonical_ingredient_id text primary key references public.ingredients(canonical_ingredient_id),
  ingredient_name text not null,
  normalized_name text not null,
  substitute_group_id text not null,
  rank numeric,
  category text,
  source_level text,
  confidence text,
  basic_sour_pct numeric,
  basic_bitter_pct numeric,
  basic_sweet_pct numeric,
  basic_salty_pct numeric,
  association_fruity_pct numeric,
  association_herbaceous_pct numeric,
  association_creamy_pct numeric,
  association_mineral_pct numeric,
  experience_smooth_pct numeric,
  experience_refreshing_pct numeric,
  experience_complex_pct numeric,
  experience_heavy_pct numeric,
  basic_x_sweet_minus_sour numeric,
  basic_y_bitter_minus_salty numeric,
  association_x_fruity_minus_mineral numeric,
  association_y_herbaceous_minus_creamy numeric,
  experience_x_refreshing_minus_heavy numeric,
  experience_y_smooth_minus_complex numeric,
  top_basic text,
  top_association text,
  top_experience text,
  primary_source_key text,
  evidence_urls text,
  notes text
);

create table public.recipes (
  recipe_id text primary key,
  recipe_name text not null,
  source_id text references public.source_registry(source_id),
  source_recipe_id text,
  source_url text,
  category text,
  alcoholic boolean,
  iba_status text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  recipe_id text not null references public.recipes(recipe_id) on delete cascade,
  line_no integer not null,
  recipe_name text not null,
  source_ingredient_name text not null,
  canonical_ingredient_id text not null references public.ingredients(canonical_ingredient_id),
  canonical_ingredient_name text not null,
  substitute_group_id text not null,
  quantity numeric,
  unit text,
  amount_ml_approx numeric,
  is_optional boolean not null default false,
  match_status text,
  flavor_profile_status text,
  source_id text,
  primary key (recipe_id, line_no)
);

create index recipe_ingredients_canonical_ingredient_idx
  on public.recipe_ingredients (canonical_ingredient_id);

create index recipe_ingredients_substitute_group_idx
  on public.recipe_ingredients (substitute_group_id);

create table public.recipe_flavor_vectors (
  recipe_id text primary key references public.recipes(recipe_id) on delete cascade,
  recipe_name text not null,
  profiled_weight_ml_approx numeric,
  total_weight_ml_approx numeric,
  flavor_profile_coverage_ratio numeric,
  basic_x_sweet_minus_sour numeric,
  basic_y_bitter_minus_salty numeric,
  association_x_fruity_minus_mineral numeric,
  association_y_herbaceous_minus_creamy numeric,
  experience_x_refreshing_minus_heavy numeric,
  experience_y_smooth_minus_complex numeric
);

create table public.vibe_dimensions (
  vibe_dimension_id text primary key,
  left_label text not null,
  right_label text not null,
  default_weight_pct numeric not null,
  notes text
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.user_cabinet_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  canonical_ingredient_id text not null references public.ingredients(canonical_ingredient_id),
  substitute_group_id text not null,
  display_name text not null,
  quantity_note text,
  created_at timestamptz not null default now(),
  primary key (user_id, canonical_ingredient_id)
);

create index user_cabinet_items_user_group_idx
  on public.user_cabinet_items (user_id, substitute_group_id);

create table public.user_preference_sets (
  preference_set_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Default',
  basic_weight_pct numeric not null default 34,
  association_weight_pct numeric not null default 33,
  experience_weight_pct numeric not null default 33,
  flavor_weight_pct numeric not null default 50,
  vibe_weight_pct numeric not null default 50,
  target_basic_x numeric,
  target_basic_y numeric,
  target_association_x numeric,
  target_association_y numeric,
  target_experience_x numeric,
  target_experience_y numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_vibe_preferences (
  preference_set_id uuid not null references public.user_preference_sets(preference_set_id) on delete cascade,
  vibe_dimension_id text not null references public.vibe_dimensions(vibe_dimension_id),
  value numeric not null check (value >= -100 and value <= 100),
  weight_pct numeric not null default 20,
  primary key (preference_set_id, vibe_dimension_id)
);

alter table public.source_registry enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_flavor_vectors enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_flavor_vectors enable row level security;
alter table public.vibe_dimensions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_cabinet_items enable row level security;
alter table public.user_preference_sets enable row level security;
alter table public.user_vibe_preferences enable row level security;

create policy "Public read source registry"
  on public.source_registry for select using (true);

create policy "Public read ingredients"
  on public.ingredients for select using (true);

create policy "Public read ingredient flavor vectors"
  on public.ingredient_flavor_vectors for select using (true);

create policy "Public read recipes"
  on public.recipes for select using (true);

create policy "Public read recipe ingredients"
  on public.recipe_ingredients for select using (true);

create policy "Public read recipe flavor vectors"
  on public.recipe_flavor_vectors for select using (true);

create policy "Public read vibe dimensions"
  on public.vibe_dimensions for select using (true);

create policy "Users read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users manage own cabinet"
  on public.user_cabinet_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own preference sets"
  on public.user_preference_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own vibe preferences"
  on public.user_vibe_preferences for all
  using (
    exists (
      select 1 from public.user_preference_sets ps
      where ps.preference_set_id = user_vibe_preferences.preference_set_id
        and ps.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_preference_sets ps
      where ps.preference_set_id = user_vibe_preferences.preference_set_id
        and ps.user_id = auth.uid()
    )
  );
