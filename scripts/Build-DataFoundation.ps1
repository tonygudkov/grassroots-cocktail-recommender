param(
  [string]$WorkbookPath = "C:\Users\tonyg\OneDrive - Cal Poly\top_100_cocktail_ingredients_quantitative_flavor_map.xlsx",
  [string]$RecipeSeedPath = "data/manual/iba_starter_recipes.json",
  [string]$AliasSeedPath = "data/manual/ingredient_aliases_seed.csv",
  [string]$OutputDir = "data/processed"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Remove-Diacritics {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $normalized = $Text.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($ch)
    }
  }
  return $builder.ToString().Normalize([Text.NormalizationForm]::FormC)
}

function New-Slug {
  param([string]$Text)
  $clean = (Remove-Diacritics $Text).ToLowerInvariant()
  $clean = $clean -replace "&", " and "
  $clean = $clean -replace "[^a-z0-9]+", "_"
  $clean = $clean.Trim("_")
  if ([string]::IsNullOrWhiteSpace($clean)) { return "unknown" }
  return $clean
}

function ConvertTo-Number {
  param($Value)
  if ($null -eq $Value -or $Value -eq "") { return $null }
  $parsed = 0.0
  if ([double]::TryParse([string]$Value, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$parsed)) {
    return [Math]::Round($parsed, 4)
  }
  return $null
}

function Get-EntryText {
  param($Zip, [string]$Name)
  $entry = $Zip.GetEntry($Name)
  if (-not $entry) { return $null }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Get-ColumnIndex {
  param([string]$CellRef)
  $letters = ([regex]::Match($CellRef, "^[A-Z]+")).Value
  $n = 0
  foreach ($ch in $letters.ToCharArray()) {
    $n = $n * 26 + ([int][char]$ch - [int][char]"A" + 1)
  }
  return $n
}

function Read-XlsxSheet {
  param([string]$Path, [string]$SheetName)

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    [xml]$workbook = Get-EntryText $zip "xl/workbook.xml"
    [xml]$relationships = Get-EntryText $zip "xl/_rels/workbook.xml.rels"

    $workbookNs = New-Object System.Xml.XmlNamespaceManager($workbook.NameTable)
    $workbookNs.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    $relNs = New-Object System.Xml.XmlNamespaceManager($relationships.NameTable)
    $relNs.AddNamespace("r", "http://schemas.openxmlformats.org/package/2006/relationships")

    $relMap = @{}
    foreach ($rel in $relationships.SelectNodes("//r:Relationship", $relNs)) {
      $relMap[$rel.Id] = $rel.Target
    }

    $sharedStrings = @()
    $sharedText = Get-EntryText $zip "xl/sharedStrings.xml"
    if ($sharedText) {
      [xml]$sharedXml = $sharedText
      $sharedNs = New-Object System.Xml.XmlNamespaceManager($sharedXml.NameTable)
      $sharedNs.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
      foreach ($si in $sharedXml.SelectNodes("//d:si", $sharedNs)) {
        $sharedStrings += $si.InnerText
      }
    }

    $sheetNode = $workbook.SelectNodes("//d:sheets/d:sheet", $workbookNs) |
      Where-Object { $_.name -eq $SheetName } |
      Select-Object -First 1
    if (-not $sheetNode) { throw "Sheet not found: $SheetName" }

    $rid = $sheetNode.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $target = $relMap[$rid]
    if ($target -notlike "worksheets/*") { $target = "worksheets/$target" }
    [xml]$sheetXml = Get-EntryText $zip "xl/$target"

    $sheetNs = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $sheetNs.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

    $rows = @()
    foreach ($row in $sheetXml.SelectNodes("//d:sheetData/d:row", $sheetNs)) {
      $cells = @{}
      $maxCol = 0
      foreach ($cell in $row.SelectNodes("d:c", $sheetNs)) {
        $col = Get-ColumnIndex $cell.r
        if ($col -gt $maxCol) { $maxCol = $col }
        $valueNode = $cell.SelectSingleNode("d:v", $sheetNs)
        $value = if ($valueNode) { $valueNode.InnerText } else { "" }
        if ($cell.t -eq "s" -and $value -ne "") {
          $value = $sharedStrings[[int]$value]
        } elseif ($cell.t -eq "inlineStr") {
          $value = $cell.InnerText
        }
        $cells[$col] = $value
      }
      $rowValues = @()
      for ($i = 1; $i -le [Math]::Max($maxCol, 1); $i++) {
        if ($cells.ContainsKey($i)) { $rowValues += $cells[$i] } else { $rowValues += "" }
      }
      $rows += ,$rowValues
    }

    $headers = $rows[0]
    $objects = @()
    for ($r = 1; $r -lt $rows.Count; $r++) {
      $obj = [ordered]@{}
      for ($c = 0; $c -lt $headers.Count; $c++) {
        $obj[$headers[$c]] = if ($c -lt $rows[$r].Count) { $rows[$r][$c] } else { "" }
      }
      $objects += [pscustomobject]$obj
    }
    return $objects
  } finally {
    $zip.Dispose()
  }
}

function Get-SubstituteGroup {
  param([string]$IngredientName, [string]$Category)
  $name = New-Slug $IngredientName
  $categorySlug = New-Slug $Category

  if ($name -match "lemon.*juice|fresh_lemon|lemon_juice") { return "citrus_juice_lemon" }
  if ($name -match "lime.*juice|fresh_lime|lime_juice") { return "citrus_juice_lime" }
  if ($name -match "grapefruit.*juice") { return "citrus_juice_grapefruit" }
  if ($name -match "orange.*juice") { return "citrus_juice_orange" }
  if ($name -match "pineapple.*juice") { return "tropical_juice_pineapple" }
  if ($name -match "cranberry.*juice") { return "fruit_juice_cranberry" }
  if ($name -match "apple.*juice|apple_cider") { return "fruit_juice_apple" }
  if ($name -match "sugar_syrup|simple_syrup|syrup_rich|syrup_2_1") { return "sweetener_simple_syrup" }
  if ($name -match "grenadine|pomegranate") { return "sweetener_grenadine" }
  if ($name -match "orgeat|almond_syrup") { return "sweetener_orgeat" }
  if ($name -match "honey") { return "sweetener_honey" }
  if ($name -match "agave") { return "sweetener_agave" }
  if ($name -match "espresso") { return "coffee_espresso" }
  if (($name -match "(^|_)gin($|_)" -or $name -match "dry_gin|london_dry_gin") -and $name -notmatch "sloe") { return "spirit_gin" }
  if ($name -match "vodka") { return "spirit_vodka" }
  if ($name -match "tequila") { return "spirit_tequila" }
  if ($name -match "mezcal") { return "spirit_mezcal" }
  if ($name -match "rum|rhum|cachaca") { return "spirit_rum_sugarcane" }
  if ($name -match "whisk|bourbon|rye|scotch") { return "spirit_whiskey" }
  if ($name -match "cognac|brandy|calvados|pisco") { return "spirit_brandy" }
  if ($name -match "triple_sec|cointreau|orange_curacao|curacao|grand_marnier") { return "liqueur_orange" }
  if ($name -match "maraschino") { return "liqueur_maraschino" }
  if ($name -match "amaretto") { return "liqueur_amaretto" }
  if ($name -match "benedictine") { return "liqueur_benedictine" }
  if ($name -match "apricot") { return "liqueur_apricot" }
  if ($name -match "black_raspberry|chambord") { return "liqueur_black_raspberry" }
  if ($name -match "cherry") { return "liqueur_cherry" }
  if ($name -match "coffee_liqueur|kahlua") { return "liqueur_coffee" }
  if ($name -match "elderflower") { return "liqueur_elderflower" }
  if ($name -match "creme_de_cacao|cacao") { return "liqueur_cacao" }
  if ($name -match "creme_de_menthe|menthe") { return "liqueur_mint" }
  if ($name -match "campari|red_bitter|aperol") { return "liqueur_bitter_aperitivo" }
  if ($name -match "lillet_blanc|lillet_blonde") { return "aromatized_wine_blanc" }
  if ($name -match "chartreuse") { return "liqueur_chartreuse" }
  if ($name -match "vermouth.*dry|dry_vermouth") { return "vermouth_dry" }
  if ($name -match "vermouth.*sweet|sweet_vermouth|rosso|rouge") { return "vermouth_sweet" }
  if ($name -match "champagne|sparkling|prosecco") { return "wine_sparkling" }
  if ($name -match "soda_water|club_soda") { return "mixer_soda_water" }
  if ($name -match "ginger_beer|ginger_ale") { return "mixer_ginger" }
  if ($name -match "cola") { return "mixer_cola" }
  if ($name -match "tonic") { return "mixer_tonic" }
  if ($name -match "egg_white") { return "foamer_egg_white" }
  if ($name -match "cream|milk|coconut_cream") { return "dairy_or_cream" }
  if ($name -match "mint") { return "fresh_herb_mint" }
  if ($name -match "angostura|aromatic_bitters") { return "bitters_aromatic" }
  if ($name -match "orange_bitters") { return "bitters_orange" }
  if ($categorySlug -ne "unknown") { return "category_$categorySlug" }
  return "ingredient_" + $name
}

function ConvertTo-ApproxMl {
  param($Quantity, [string]$Unit)
  $unitSlug = New-Slug $Unit
  $q = ConvertTo-Number $Quantity
  if ($null -eq $q) { return $null }
  switch ($unitSlug) {
    "ml" { return [Math]::Round($q, 2) }
    "oz" { return [Math]::Round($q * 29.5735, 2) }
    "cl" { return [Math]::Round($q * 10, 2) }
    "dash" { return [Math]::Round($q * 1, 2) }
    "dashes" { return [Math]::Round($q * 1, 2) }
    "bar_spoon" { return [Math]::Round($q * 5, 2) }
    "tsp" { return [Math]::Round($q * 5, 2) }
    "teaspoon" { return [Math]::Round($q * 5, 2) }
    "tbsp" { return [Math]::Round($q * 15, 2) }
    "tablespoon" { return [Math]::Round($q * 15, 2) }
    "piece" { return [Math]::Round($q * 10, 2) }
    "leaves" { return [Math]::Round($q * 1, 2) }
    "top_up" { return [Math]::Round($q, 2) }
    default { return $null }
  }
}

function Get-RecipeIngredientWeight {
  param($AmountMl, [string]$Unit)
  if ($null -ne $AmountMl -and $AmountMl -gt 0) { return [double]$AmountMl }
  $unitSlug = New-Slug $Unit
  if ($unitSlug -eq "dash" -or $unitSlug -eq "dashes") { return 1.0 }
  if ($unitSlug -eq "top_up") { return 90.0 }
  if ($unitSlug -eq "piece") { return 10.0 }
  if ($unitSlug -eq "leaves") { return 1.0 }
  return 5.0
}

function Export-CsvData {
  param($Rows, [string]$Path)
  try {
    $Rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $Path
  } catch {
    Write-Warning "Could not refresh $Path because it is currently locked. Keeping the existing file."
  }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$profiles = Read-XlsxSheet -Path $WorkbookPath -SheetName "Quantitative Profiles"
$coords = Read-XlsxSheet -Path $WorkbookPath -SheetName "Map Coordinates"
$coordsByName = @{}
foreach ($coord in $coords) { $coordsByName[$coord.Ingredient] = $coord }

$flavorVectors = @()
$profileByCanonicalId = @{}
$profileByNormalizedName = @{}

foreach ($profile in $profiles) {
  $coord = $coordsByName[$profile.Ingredient]
  $canonicalId = New-Slug $profile.Ingredient
  $group = Get-SubstituteGroup -IngredientName $profile.Ingredient -Category $profile.Category
  $row = [pscustomobject][ordered]@{
    canonical_ingredient_id = $canonicalId
    ingredient_name = $profile.Ingredient
    normalized_name = New-Slug $profile.Ingredient
    substitute_group_id = $group
    rank = ConvertTo-Number $profile.Rank
    category = $profile.Category
    source_level = $profile."Source Level"
    confidence = $profile.Confidence
    basic_sour_pct = ConvertTo-Number $profile."Basic Sour %"
    basic_bitter_pct = ConvertTo-Number $profile."Basic Bitter %"
    basic_sweet_pct = ConvertTo-Number $profile."Basic Sweet %"
    basic_salty_pct = ConvertTo-Number $profile."Basic Salty %"
    association_fruity_pct = ConvertTo-Number $profile."Association Fruity %"
    association_herbaceous_pct = ConvertTo-Number $profile."Association Herbaceous %"
    association_creamy_pct = ConvertTo-Number $profile."Association Creamy %"
    association_mineral_pct = ConvertTo-Number $profile."Association Mineral %"
    experience_smooth_pct = ConvertTo-Number $profile."Experience Smooth %"
    experience_refreshing_pct = ConvertTo-Number $profile."Experience Refreshing %"
    experience_complex_pct = ConvertTo-Number $profile."Experience Complex %"
    experience_heavy_pct = ConvertTo-Number $profile."Experience Heavy %"
    basic_x_sweet_minus_sour = ConvertTo-Number $coord."Basic X = Sweet - Sour"
    basic_y_bitter_minus_salty = ConvertTo-Number $coord."Basic Y = Bitter - Salty"
    association_x_fruity_minus_mineral = ConvertTo-Number $coord."Association X = Fruity - Mineral"
    association_y_herbaceous_minus_creamy = ConvertTo-Number $coord."Association Y = Herbaceous - Creamy"
    experience_x_refreshing_minus_heavy = ConvertTo-Number $coord."Experience X = Refreshing - Heavy"
    experience_y_smooth_minus_complex = ConvertTo-Number $coord."Experience Y = Smooth - Complex"
    top_basic = $profile."Top Basic"
    top_association = $profile."Top Association"
    top_experience = $profile."Top Experience"
    primary_source_key = $profile."Primary Source Key"
    evidence_urls = $profile."Evidence URLs"
    notes = $profile.Notes
  }
  $flavorVectors += $row
  $profileByCanonicalId[$canonicalId] = $row
  $profileByNormalizedName[$row.normalized_name] = $row
}

$aliases = Import-Csv -Path $AliasSeedPath
$aliasBySource = @{}
foreach ($alias in $aliases) {
  $aliasBySource[(New-Slug $alias.source_ingredient_name)] = $alias
}

$recipesJson = Get-Content -Raw -Path $RecipeSeedPath | ConvertFrom-Json
$recipeRows = @()
$recipeIngredientRows = @()
$ingredientRowsById = @{}

foreach ($vector in $flavorVectors) {
  $ingredientRowsById[$vector.canonical_ingredient_id] = [pscustomobject][ordered]@{
    canonical_ingredient_id = $vector.canonical_ingredient_id
    ingredient_name = $vector.ingredient_name
    normalized_name = $vector.normalized_name
    ingredient_category = $vector.category
    substitute_group_id = $vector.substitute_group_id
    has_flavor_profile = $true
    flavor_profile_confidence = $vector.confidence
    source_rank = $vector.rank
    data_origin = "user_workbook_quantitative_profiles"
    review_status = "starter_profile"
  }
}

foreach ($recipe in $recipesJson.recipes) {
  $recipeId = New-Slug ($recipe.source_id + "_" + $recipe.name)
  $recipeRows += [pscustomobject][ordered]@{
    recipe_id = $recipeId
    recipe_name = $recipe.name
    source_id = $recipe.source_id
    source_recipe_id = $recipe.source_recipe_id
    source_url = $recipe.source_url
    category = $recipe.category
    alcoholic = $recipe.alcoholic
    iba_status = $recipe.iba_status
    notes = $recipe.notes
  }

  $line = 0
  foreach ($ingredient in $recipe.ingredients) {
    $line += 1
    $sourceIngredientName = $ingredient.name
    $sourceSlug = New-Slug $sourceIngredientName
    $alias = $aliasBySource[$sourceSlug]

    $canonicalName = $null
    $matchStatus = "unmatched_recipe_only"
    if ($alias) {
      $canonicalName = $alias.canonical_ingredient_name
      $matchStatus = $alias.match_type
    } elseif ($profileByNormalizedName.ContainsKey($sourceSlug)) {
      $canonicalName = $profileByNormalizedName[$sourceSlug].ingredient_name
      $matchStatus = "exact_profile_name"
    } else {
      $canonicalName = $sourceIngredientName
    }

    $canonicalId = New-Slug $canonicalName
    $profile = $profileByCanonicalId[$canonicalId]
    $substituteGroup = if ($alias -and $alias.substitute_group_id) {
      $alias.substitute_group_id
    } elseif ($profile) {
      $profile.substitute_group_id
    } else {
      Get-SubstituteGroup -IngredientName $canonicalName -Category ""
    }

    if (-not $ingredientRowsById.ContainsKey($canonicalId)) {
      $ingredientRowsById[$canonicalId] = [pscustomobject][ordered]@{
        canonical_ingredient_id = $canonicalId
        ingredient_name = $canonicalName
        normalized_name = New-Slug $canonicalName
        ingredient_category = "Recipe-only imported ingredient"
        substitute_group_id = $substituteGroup
        has_flavor_profile = $false
        flavor_profile_confidence = ""
        source_rank = ""
        data_origin = "iba_starter_recipe_seed"
        review_status = "needs_flavor_profile"
      }
    }

    $amountMl = ConvertTo-ApproxMl -Quantity $ingredient.quantity -Unit $ingredient.unit
    $profileStatus = if ($profile) { "profiled" } else { "needs_profile" }
    $recipeIngredientRows += [pscustomobject][ordered]@{
      recipe_id = $recipeId
      recipe_name = $recipe.name
      line_no = $line
      source_ingredient_name = $sourceIngredientName
      canonical_ingredient_id = $canonicalId
      canonical_ingredient_name = $canonicalName
      substitute_group_id = $substituteGroup
      quantity = $ingredient.quantity
      unit = $ingredient.unit
      amount_ml_approx = $amountMl
      is_optional = [bool]$ingredient.optional
      match_status = $matchStatus
      flavor_profile_status = $profileStatus
      source_id = $recipe.source_id
    }
  }
}

$recipeFlavorRows = @()
foreach ($recipe in $recipeRows) {
  $ingredients = $recipeIngredientRows | Where-Object { $_.recipe_id -eq $recipe.recipe_id -and -not $_.is_optional }
  $totalWeight = 0.0
  $profiledWeight = 0.0
  $sums = @{
    basic_x = 0.0
    basic_y = 0.0
    association_x = 0.0
    association_y = 0.0
    experience_x = 0.0
    experience_y = 0.0
  }

  foreach ($ingredient in $ingredients) {
    $weight = Get-RecipeIngredientWeight -AmountMl $ingredient.amount_ml_approx -Unit $ingredient.unit
    $totalWeight += $weight
    $profile = $profileByCanonicalId[$ingredient.canonical_ingredient_id]
    if ($profile) {
      $profiledWeight += $weight
      $sums.basic_x += $weight * [double]$profile.basic_x_sweet_minus_sour
      $sums.basic_y += $weight * [double]$profile.basic_y_bitter_minus_salty
      $sums.association_x += $weight * [double]$profile.association_x_fruity_minus_mineral
      $sums.association_y += $weight * [double]$profile.association_y_herbaceous_minus_creamy
      $sums.experience_x += $weight * [double]$profile.experience_x_refreshing_minus_heavy
      $sums.experience_y += $weight * [double]$profile.experience_y_smooth_minus_complex
    }
  }

  $coverage = if ($totalWeight -gt 0) { [Math]::Round($profiledWeight / $totalWeight, 4) } else { 0 }
  $denominator = if ($profiledWeight -gt 0) { $profiledWeight } else { 1 }
  $recipeFlavorRows += [pscustomobject][ordered]@{
    recipe_id = $recipe.recipe_id
    recipe_name = $recipe.recipe_name
    profiled_weight_ml_approx = [Math]::Round($profiledWeight, 2)
    total_weight_ml_approx = [Math]::Round($totalWeight, 2)
    flavor_profile_coverage_ratio = $coverage
    basic_x_sweet_minus_sour = [Math]::Round($sums.basic_x / $denominator, 4)
    basic_y_bitter_minus_salty = [Math]::Round($sums.basic_y / $denominator, 4)
    association_x_fruity_minus_mineral = [Math]::Round($sums.association_x / $denominator, 4)
    association_y_herbaceous_minus_creamy = [Math]::Round($sums.association_y / $denominator, 4)
    experience_x_refreshing_minus_heavy = [Math]::Round($sums.experience_x / $denominator, 4)
    experience_y_smooth_minus_complex = [Math]::Round($sums.experience_y / $denominator, 4)
  }
}

$unmatchedRows = $recipeIngredientRows |
  Where-Object { $_.flavor_profile_status -eq "needs_profile" } |
  Sort-Object canonical_ingredient_name -Unique |
  Select-Object canonical_ingredient_id, canonical_ingredient_name, substitute_group_id, source_ingredient_name, match_status

$substituteGroupRows = @{}
foreach ($ingredient in $ingredientRowsById.Values) {
  if (-not $substituteGroupRows.ContainsKey($ingredient.substitute_group_id)) {
    $substituteGroupRows[$ingredient.substitute_group_id] = [pscustomobject][ordered]@{
      substitute_group_id = $ingredient.substitute_group_id
      display_name = (($ingredient.substitute_group_id -replace "_", " ").Trim())
      notes = "Generated from ingredient aliases and category heuristics; review before expanding source data."
    }
  }
}

$sourceRows = @(
  [pscustomobject][ordered]@{
    source_id = "user_workbook_quantitative_profiles"
    source_name = "Top 100 cocktail ingredients quantitative flavor map workbook"
    source_url = $WorkbookPath
    license_or_use_note = "Local prototype workbook supplied by project team. Ingredient rank is based on Difford's top-100 list; flavor scores are team/AI inferred with cited supporting sources."
    imported_data = "Ingredient names, ranks, categories, normalized flavor percentages, map coordinates, confidence, and source notes"
    production_use = "Use as starter flavor-vector table; retain confidence flags and revisit low-confidence categories."
  },
  [pscustomobject][ordered]@{
    source_id = "diffords_top_100_pdf"
    source_name = "Difford's Guide Top 100 cocktail ingredients PDF"
    source_url = "C:\Users\tonyg\Downloads\Top 100 cocktail ingredients.pdf"
    license_or_use_note = "Used only as provenance for ingredient frequency order through the supplied PDF/workbook. Do not scrape or redistribute Difford recipe text without permission."
    imported_data = "Ingredient rank/order indirectly through the project workbook"
    production_use = "Citation/provenance only."
  },
  [pscustomobject][ordered]@{
    source_id = "iba_starter_recipe_seed"
    source_name = "IBA cocktails starter seed"
    source_url = "https://github.com/rasmusab/iba-cocktails"
    license_or_use_note = "The referenced repository is MIT licensed except Wikipedia-derived files. This project seed stores factual recipe ingredient names and amounts, not method prose."
    imported_data = "Starter recipe names, categories, ingredient names, and amounts"
    production_use = "Good first recipe corpus; expand with direct source review before launch."
  },
  [pscustomobject][ordered]@{
    source_id = "mixology_tools_candidate"
    source_name = "Mixology Tools API and cocktail database"
    source_url = "https://mixology.tools/"
    license_or_use_note = "Candidate expansion source with open API/open-data positioning and useful inventory/taxonomy concepts. Not imported in this build."
    imported_data = "None yet"
    production_use = "Recommended next import if source terms and endpoint stability are confirmed."
  },
  [pscustomobject][ordered]@{
    source_id = "thecocktaildb_candidate"
    source_name = "TheCocktailDB API"
    source_url = "https://www.thecocktaildb.com/api.php"
    license_or_use_note = "Free test key is suitable for development/education; public production apps should review premium-key requirements and attribution/usage terms."
    imported_data = "None yet"
    production_use = "Optional recipe/ingredient enrichment source after terms review."
  },
  [pscustomobject][ordered]@{
    source_id = "flavordb_reference"
    source_name = "FlavorDB"
    source_url = "https://academic.oup.com/nar/article/46/D1/D1210/4559748"
    license_or_use_note = "Reference for food flavor molecules/descriptors. Not bulk imported in this build."
    imported_data = "Referenced by workbook source notes"
    production_use = "Use for future ingredient descriptor enrichment."
  },
  [pscustomobject][ordered]@{
    source_id = "mdpi_spirits_ml_reference"
    source_name = "Flavor Wheel Development from a Machine Learning Perspective"
    source_url = "https://www.mdpi.com/2304-8158/13/24/4142"
    license_or_use_note = "Open-access research reference for distilled-spirit descriptors and spirit-category flavor modeling. Not bulk imported in this build."
    imported_data = "Referenced by workbook source notes"
    production_use = "Use for future spirits descriptor calibration and confidence upgrades."
  },
  [pscustomobject][ordered]@{
    source_id = "usda_fdc_reference"
    source_name = "USDA FoodData Central"
    source_url = "https://fdc.nal.usda.gov/"
    license_or_use_note = "US government data source for composition. Not bulk imported in this build."
    imported_data = "Referenced by workbook source notes"
    production_use = "Use for future sugar/acid/fat/sodium and grocery-friction features."
  }
)

$vibeRows = @(
  [pscustomobject][ordered]@{ vibe_dimension_id = "bright_mellow"; left_label = "Mellow"; right_label = "Bright"; default_weight_pct = 20; notes = "Affective energy slider for citrusy/lively vs softer/rounder drinks." },
  [pscustomobject][ordered]@{ vibe_dimension_id = "cozy_fresh"; left_label = "Cozy"; right_label = "Fresh"; default_weight_pct = 20; notes = "Useful for lawn-chair, beach, fireplace, or dinner-party language." },
  [pscustomobject][ordered]@{ vibe_dimension_id = "easy_adventurous"; left_label = "Easy"; right_label = "Adventurous"; default_weight_pct = 20; notes = "Captures familiar comfort vs novel or complex flavor direction." },
  [pscustomobject][ordered]@{ vibe_dimension_id = "casual_elegant"; left_label = "Casual"; right_label = "Elegant"; default_weight_pct = 20; notes = "Maps to serve style and perceived occasion." },
  [pscustomobject][ordered]@{ vibe_dimension_id = "light_indulgent"; left_label = "Light"; right_label = "Indulgent"; default_weight_pct = 20; notes = "Helps separate spritz/sour profiles from creamy/heavy/sweet profiles." }
)

Export-CsvData -Rows $flavorVectors -Path (Join-Path $OutputDir "ingredient_flavor_vectors.csv")
Export-CsvData -Rows ($ingredientRowsById.Values | Sort-Object ingredient_name) -Path (Join-Path $OutputDir "ingredients.csv")
Export-CsvData -Rows $recipeRows -Path (Join-Path $OutputDir "recipes.csv")
Export-CsvData -Rows $recipeIngredientRows -Path (Join-Path $OutputDir "recipe_ingredients.csv")
Export-CsvData -Rows $recipeFlavorRows -Path (Join-Path $OutputDir "recipe_flavor_vectors.csv")
Export-CsvData -Rows $unmatchedRows -Path (Join-Path $OutputDir "unmatched_recipe_ingredients.csv")
Export-CsvData -Rows $sourceRows -Path (Join-Path $OutputDir "source_registry.csv")
Export-CsvData -Rows ($substituteGroupRows.Values | Sort-Object substitute_group_id) -Path (Join-Path $OutputDir "substitute_groups.csv")
Export-CsvData -Rows $vibeRows -Path (Join-Path $OutputDir "vibe_dimensions.csv")

$appSeed = [pscustomobject][ordered]@{
  generatedAt = (Get-Date).ToString("s")
  ingredients = @($ingredientRowsById.Values | Sort-Object ingredient_name)
  ingredientFlavorVectors = @($flavorVectors | Sort-Object rank)
  recipes = @($recipeRows | Sort-Object recipe_name)
  recipeIngredients = @($recipeIngredientRows | Sort-Object recipe_name, line_no)
  recipeFlavorVectors = @($recipeFlavorRows | Sort-Object recipe_name)
  vibeDimensions = @($vibeRows)
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $OutputDir "app_seed.json"), ($appSeed | ConvertTo-Json -Depth 8), $utf8NoBom)

$summary = [pscustomobject][ordered]@{
  built_at_local = (Get-Date).ToString("s")
  workbook_path = $WorkbookPath
  recipe_seed_path = $RecipeSeedPath
  alias_seed_path = $AliasSeedPath
  ingredient_flavor_vectors = $flavorVectors.Count
  canonical_ingredients = $ingredientRowsById.Count
  recipes = $recipeRows.Count
  recipe_ingredient_rows = $recipeIngredientRows.Count
  recipe_flavor_vectors = $recipeFlavorRows.Count
  unmatched_recipe_ingredients = @($unmatchedRows).Count
  substitute_groups = $substituteGroupRows.Count
  source_rows = $sourceRows.Count
}

$summaryJson = $summary | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $OutputDir "data_build_summary.json"), $summaryJson, $utf8NoBom)
$summary | ConvertTo-Json -Depth 4
