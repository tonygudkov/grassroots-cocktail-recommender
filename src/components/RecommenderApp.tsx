"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Plus,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Wine,
  X
} from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { FlavorPad } from "@/components/FlavorPad";
import { createNewCocktails } from "@/lib/creation";
import { ingredientsById, seedData } from "@/lib/data";
import {
  defaultFlavorTarget,
  defaultVibes,
  defaultWeights,
  formatPercent,
  getRecommendations
} from "@/lib/recommender";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { AhpWeights, FlavorTarget, GeneratedCocktail, Ingredient, Recommendation, VibeValues } from "@/types";

const cabinetStorageKey = "grassroots-cabinet-v1";

const clampWeight = (value: number) => Math.min(100, Math.max(0, value));

const normalizedWeightLabel = (weights: number[], index: number) => {
  const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  return `${Math.round((Math.max(0, weights[index]) / total) * 100)}%`;
};

function FieldSlider({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
  left,
  right
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  left?: string;
  right?: string;
}) {
  return (
    <label className="slider-row">
      <span className="slider-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {left && right ? (
        <span className="slider-ends">
          <span>{left}</span>
          <span>{right}</span>
        </span>
      ) : null}
    </label>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="score-pill">
      {label} <strong>{formatPercent(value)}</strong>
    </span>
  );
}

function KnownCocktailCard({ recommendation }: { recommendation: Recommendation }) {
  const missingIds = new Set(recommendation.missingGroups);

  return (
    <article className="result-card">
      <div className="result-topline">
        <div>
          <h3>{recommendation.recipe.recipe_name}</h3>
          <p>{recommendation.recipe.category}</p>
        </div>
        <span className={`availability ${recommendation.label}`}>
          {recommendation.label === "ready" ? <CheckCircle2 size={15} /> : <ShoppingBasket size={15} />}
          {recommendation.label === "ready" ? "Ready" : recommendation.missingGroups.length <= 2 ? "Grocery Run" : "Stretch"}
        </span>
      </div>

      <div className="score-row">
        <ScorePill label="Overall" value={recommendation.totalScore} />
        <ScorePill label="Palette" value={recommendation.paletteScore} />
        <ScorePill label="Tone" value={recommendation.vibeScore} />
      </div>

      <ul className="ingredient-lines">
        {recommendation.ingredients.map((ingredient) => (
          <li key={`${ingredient.recipe_id}_${ingredient.line_no}`} className={missingIds.has(ingredient.substitute_group_id) ? "missing" : ""}>
            <span>{ingredient.canonical_ingredient_name}</span>
            <em>{ingredient.quantity ? `${ingredient.quantity} ${ingredient.unit}` : ingredient.unit}</em>
          </li>
        ))}
      </ul>

      {recommendation.missingNames.length > 0 ? (
        <p className="missing-note">Missing: {recommendation.missingNames.slice(0, 3).join(", ")}</p>
      ) : null}
    </article>
  );
}

function GeneratedCocktailCard({ cocktail }: { cocktail: GeneratedCocktail }) {
  return (
    <article className="result-card generated-card">
      <div className="result-topline">
        <div>
          <h3>{cocktail.name}</h3>
          <p>
            {cocktail.template} | {cocktail.style}
          </p>
        </div>
        <span className="availability generated">
          <Sparkles size={15} />
          New
        </span>
      </div>

      <div className="score-row">
        <ScorePill label="Fit" value={cocktail.score} />
        <span className="score-pill">
          Grocery <strong>{cocktail.missingNames.length}</strong>
        </span>
      </div>

      <ul className="ingredient-lines">
        {cocktail.lines.map((line) => (
          <li key={`${cocktail.id}_${line.ingredientId}_${line.role}`} className={line.isInCabinet ? "" : "missing"}>
            <span>{line.ingredientName}</span>
            <em>{line.amount}</em>
          </li>
        ))}
      </ul>

      <div className="method-box">
        {cocktail.method.map((step) => (
          <p key={step}>{step}</p>
        ))}
      </div>

      <ul className="rationale-list">
        {cocktail.rationale.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </article>
  );
}

export function RecommenderApp() {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [target, setTarget] = useState<FlavorTarget>(defaultFlavorTarget);
  const [weights, setWeights] = useState<AhpWeights>(defaultWeights);
  const [vibes, setVibes] = useState<VibeValues>(defaultVibes);
  const [freeText, setFreeText] = useState("lounge chair in the sunny lawn");
  const [mode, setMode] = useState<"known" | "new">("known");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [status, setStatus] = useState("Your cabinet is saved in this browser until Supabase is connected.");
  const [isSaving, setIsSaving] = useState(false);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const selectedIngredients = useMemo(
    () => selectedIds.map((id) => ingredientsById.get(id)).filter((ingredient): ingredient is Ingredient => Boolean(ingredient)),
    [selectedIds]
  );

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const pool = seedData.ingredients.filter((ingredient) => !selectedIds.includes(ingredient.canonical_ingredient_id));
    const ranked = normalizedQuery
      ? pool.filter((ingredient) =>
          `${ingredient.ingredient_name} ${ingredient.ingredient_category} ${ingredient.substitute_group_id}`
            .toLowerCase()
            .includes(normalizedQuery)
        )
      : pool.filter((ingredient) => ingredient.source_rank !== null && ingredient.source_rank <= 40);
    return ranked.slice(0, 10);
  }, [query, selectedIds]);

  const recommendations = useMemo(
    () =>
      getRecommendations({
        selectedIngredients,
        target,
        vibes,
        freeText,
        weights
      }),
    [selectedIngredients, target, vibes, freeText, weights]
  );

  const generatedCocktails = useMemo(
    () =>
      createNewCocktails({
        selectedIngredients,
        flavorTarget: target,
        vibes,
        freeText,
        weights
      }),
    [selectedIngredients, target, vibes, freeText, weights]
  );

  const readyRecommendations = recommendations.filter((recommendation) => recommendation.label === "ready").slice(0, 6);
  const groceryRecommendations = recommendations.filter((recommendation) => recommendation.label === "grocery").slice(0, 6);

  useEffect(() => {
    const stored = window.localStorage.getItem(cabinetStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        setSelectedIds(parsed.filter((id) => ingredientsById.has(id)));
      } catch {
        window.localStorage.removeItem(cabinetStorageKey);
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setUserId(user?.id ?? null);
      setUserEmail(user?.email ?? null);
      if (user) {
        setStatus("Signed in. Loading your saved cabinet.");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
      setStatus(session?.user ? "Signed in. Your cabinet can sync now." : "Signed out.");
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }

    const loadCabinet = async () => {
      await supabase.from("profiles").upsert({ id: userId, display_name: userEmail ?? "" });
      const { data, error } = await supabase
        .from("user_cabinet_items")
        .select("canonical_ingredient_id")
        .eq("user_id", userId);

      if (error) {
        setStatus("Could not load the saved cabinet yet.");
        return;
      }

      if (data && data.length > 0) {
        setSelectedIds(data.map((row) => row.canonical_ingredient_id as string).filter((id) => ingredientsById.has(id)));
        setStatus("Saved cabinet loaded.");
      }
    };

    loadCabinet();
  }, [supabase, userId, userEmail]);

  useEffect(() => {
    if (!userId) {
      window.localStorage.setItem(cabinetStorageKey, JSON.stringify(selectedIds));
    }
  }, [selectedIds, userId]);

  const addIngredient = (ingredient: Ingredient) => {
    setSelectedIds((current) => Array.from(new Set([...current, ingredient.canonical_ingredient_id])));
    setQuery("");
  };

  const removeIngredient = (id: string) => {
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
  };

  const saveCabinet = async () => {
    if (!supabase || !userId) {
      window.localStorage.setItem(cabinetStorageKey, JSON.stringify(selectedIds));
      setStatus("Cabinet saved in this browser.");
      return;
    }

    setIsSaving(true);
    setStatus("Saving cabinet.");
    await supabase.from("profiles").upsert({ id: userId, display_name: userEmail ?? "" });
    const deleteResult = await supabase.from("user_cabinet_items").delete().eq("user_id", userId);
    if (deleteResult.error) {
      setStatus("Could not clear the previous cabinet.");
      setIsSaving(false);
      return;
    }

    if (selectedIngredients.length > 0) {
      const insertResult = await supabase.from("user_cabinet_items").insert(
        selectedIngredients.map((ingredient) => ({
          user_id: userId,
          canonical_ingredient_id: ingredient.canonical_ingredient_id,
          substitute_group_id: ingredient.substitute_group_id,
          display_name: ingredient.ingredient_name
        }))
      );
      if (insertResult.error) {
        setStatus("Could not save the cabinet yet.");
        setIsSaving(false);
        return;
      }
    }

    setStatus("Cabinet saved.");
    setIsSaving(false);
  };

  const signIn = async () => {
    if (!supabase || !email.trim()) {
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    });
    setStatus(error ? "Could not send the sign-in email." : "Check your email for the sign-in link.");
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
    setUserId(null);
    setUserEmail(null);
  };

  const updateWeight = (key: keyof AhpWeights, value: number) => {
    setWeights((current) => ({ ...current, [key]: clampWeight(value) }));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Grassroots</p>
          <h1>Cocktail Recommender</h1>
        </div>
        <AuthPanel
          configured={isSupabaseConfigured}
          email={email}
          userEmail={userEmail}
          status={status}
          isSaving={isSaving}
          onEmailChange={setEmail}
          onSignIn={signIn}
          onSignOut={signOut}
          onSave={saveCabinet}
        />
      </header>

      <section className="mode-strip" aria-label="Recommendation mode">
        <button className={mode === "known" ? "active" : ""} type="button" onClick={() => setMode("known")}>
          <Wine size={18} />
          <span>Create a known cocktail</span>
        </button>
        <button className={mode === "new" ? "active" : ""} type="button" onClick={() => setMode("new")}>
          <FlaskConical size={18} />
          <span>Create a new cocktail for me</span>
        </button>
      </section>

      <div className="workspace-grid">
        <section className="panel cabinet-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Your Cabinet</p>
              <h2>Ingredients on hand</h2>
            </div>
            <ShoppingBasket size={22} />
          </div>
          <p className="instruction">
            Add bottles, mixers, juices, syrups, and herbs. The matcher accepts substitutes like Cointreau for triple sec.
          </p>

          <div className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ingredients"
              aria-label="Search ingredients"
            />
          </div>

          <div className="search-results">
            {searchResults.map((ingredient) => (
              <button key={ingredient.canonical_ingredient_id} type="button" onClick={() => addIngredient(ingredient)}>
                <Plus size={15} />
                <span>{ingredient.ingredient_name}</span>
              </button>
            ))}
          </div>

          <div className="cabinet-list" aria-live="polite">
            {selectedIngredients.length === 0 ? (
              <p className="empty-state">Start with two or three things you actually have.</p>
            ) : (
              selectedIngredients.map((ingredient) => (
                <span key={ingredient.canonical_ingredient_id} className="cabinet-chip">
                  {ingredient.ingredient_name}
                  <button type="button" onClick={() => removeIngredient(ingredient.canonical_ingredient_id)} title="Remove ingredient">
                    <X size={14} />
                  </button>
                </span>
              ))
            )}
          </div>
        </section>

        <section className="panel palette-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Palette Pairing</p>
              <h2>Flavor target</h2>
            </div>
            <SlidersHorizontal size={22} />
          </div>
          <p className="instruction">
            Pick a point on each map. The system compares your target with every cocktail&apos;s weighted ingredient vector.
          </p>

          <div className="flavor-grid">
            <FlavorPad
              title="Basic Flavor"
              xLeft="sour"
              xRight="sweet"
              yTop="bitter"
              yBottom="salty"
              point={target.basic}
              onChange={(point) => setTarget((current) => ({ ...current, basic: point }))}
            />
            <FlavorPad
              title="Flavor Association"
              xLeft="mineral"
              xRight="fruity"
              yTop="herbaceous"
              yBottom="creamy"
              point={target.association}
              onChange={(point) => setTarget((current) => ({ ...current, association: point }))}
            />
            <FlavorPad
              title="Drinking Experience"
              xLeft="heavy"
              xRight="refreshing"
              yTop="smooth"
              yBottom="complex"
              point={target.experience}
              onChange={(point) => setTarget((current) => ({ ...current, experience: point }))}
            />
          </div>

          <div className="weights-grid">
            <FieldSlider label={`Basic ${normalizedWeightLabel([weights.basic, weights.association, weights.experience], 0)}`} value={weights.basic} onChange={(value) => updateWeight("basic", value)} />
            <FieldSlider label={`Association ${normalizedWeightLabel([weights.basic, weights.association, weights.experience], 1)}`} value={weights.association} onChange={(value) => updateWeight("association", value)} />
            <FieldSlider label={`Experience ${normalizedWeightLabel([weights.basic, weights.association, weights.experience], 2)}`} value={weights.experience} onChange={(value) => updateWeight("experience", value)} />
          </div>
        </section>

        <section className="panel tone-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Today&apos;s Tone</p>
              <h2>Vibe match</h2>
            </div>
            <Sparkles size={22} />
          </div>
          <p className="instruction">
            Set the emotional direction, then add a short phrase for niche context like sunny lawn or cozy nightcap.
          </p>

          <div className="vibe-sliders">
            {seedData.vibeDimensions.map((dimension) => (
              <FieldSlider
                key={dimension.vibe_dimension_id}
                label={`${dimension.left_label} / ${dimension.right_label}`}
                min={-100}
                max={100}
                value={vibes[dimension.vibe_dimension_id] ?? 0}
                left={dimension.left_label}
                right={dimension.right_label}
                onChange={(value) =>
                  setVibes((current) => ({
                    ...current,
                    [dimension.vibe_dimension_id]: value
                  }))
                }
              />
            ))}
          </div>

          <label className="text-area-label">
            Extra direction
            <textarea value={freeText} onChange={(event) => setFreeText(event.target.value)} rows={4} />
          </label>

          <div className="weights-grid compact">
            <FieldSlider label={`Cabinet ${normalizedWeightLabel([weights.cabinet, weights.palette, weights.vibe], 0)}`} value={weights.cabinet} onChange={(value) => updateWeight("cabinet", value)} />
            <FieldSlider label={`Palette ${normalizedWeightLabel([weights.cabinet, weights.palette, weights.vibe], 1)}`} value={weights.palette} onChange={(value) => updateWeight("palette", value)} />
            <FieldSlider label={`Tone ${normalizedWeightLabel([weights.cabinet, weights.palette, weights.vibe], 2)}`} value={weights.vibe} onChange={(value) => updateWeight("vibe", value)} />
          </div>
        </section>
      </div>

      <section className="results-section">
        <div className="results-heading">
          <div>
            <p className="eyebrow">{mode === "known" ? "Known Cocktails" : "New Cocktail Ideas"}</p>
            <h2>{mode === "known" ? "Best matches" : "Built from cocktail fundamentals"}</h2>
          </div>
          {selectedIngredients.length === 0 ? (
            <span className="caution">
              <AlertCircle size={16} />
              Add cabinet items for sharper results
            </span>
          ) : null}
        </div>

        {mode === "known" ? (
          <div className="result-columns">
            <div>
              <h3 className="column-title">Ready now</h3>
              <div className="result-grid">
                {(readyRecommendations.length ? readyRecommendations : recommendations.slice(0, 3)).map((recommendation) => (
                  <KnownCocktailCard key={recommendation.recipe.recipe_id} recommendation={recommendation} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="column-title">Grocery Run</h3>
              <div className="result-grid">
                {groceryRecommendations.map((recommendation) => (
                  <KnownCocktailCard key={recommendation.recipe.recipe_id} recommendation={recommendation} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="result-grid generated-grid">
            {generatedCocktails.map((cocktail) => (
              <GeneratedCocktailCard key={cocktail.id} cocktail={cocktail} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
