# Cocktail Creation Engine

Grassroots has two creative paths: recommend known cocktails, or create a new drink idea from the user's cabinet, flavor target, and vibe target.

The current `Create a new cocktail for me` mode is intentionally rules-based. It does not claim to reproduce proprietary systems like Flavonomics. Instead, it uses transparent cocktail fundamentals so users and reviewers can see why a generated drink makes sense.

## Foundation

The generator starts from classic families:

| Template | Working Ratio | Use Case |
| --- | --- | --- |
| Bright Sour | base spirit + citrus + sweetener | Shaken, bright, flexible |
| Lawn Highball | base spirit + bubbles + accent | Refreshing, casual, low-friction |
| Garden Daisy | base spirit + citrus + orange liqueur | Margarita/Sidecar-style balance |
| Porch Spritz | bitter/aromatized modifier + sparkling wine + soda | Bubbly, social, lower intensity |
| Evening Stirred | base spirit + vermouth/liqueur + bitters | Smooth, complex, spirit-forward |
| Velvet Treat | base spirit + cream/coffee/cacao | Dessert or indulgent direction |

These structures keep generated recipes from becoming arbitrary ingredient piles.

## Ingredient Roles

Each generated recipe line has a role:

- `base`: primary spirit
- `acid`: lemon, lime, grapefruit, or similar balancing ingredient
- `sweetener`: syrup, honey, agave, grenadine, or orgeat
- `modifier`: liqueur, vermouth, juice, coffee, or aperitivo ingredient that changes the flavor center
- `lengthener`: soda, ginger beer, sparkling wine, tonic, or similar
- `accent`: bitters, herbs, small liqueur amounts, or aromatic touches
- `texture`: egg white, cream, milk, coconut cream, or related body-building ingredients

## Synergy Rules

The first version uses explicit substitute-group synergies:

- Gin: lemon, lime, mint, elderflower, dry vermouth, maraschino
- Vodka: lime, cranberry, ginger, espresso, coffee liqueur
- Rum: lime, pineapple, orgeat, ginger, cream/coconut
- Tequila: lime, grapefruit, orange liqueur, agave
- Mezcal: lime, grapefruit, bitter aperitivo, Chartreuse
- Whiskey: lemon, honey, ginger, sweet vermouth, aromatic bitters
- Brandy: orange liqueur, cream, sweet vermouth, sparkling wine, simple syrup

The engine prefers ingredients already in the user's cabinet, then fills gaps as Grocery Run items.

## Vibe and Flavor Fit

Templates are selected using:

- Flavor-map target coordinates
- Today's Tone sliders
- Free-text vibe nudges
- Cabinet availability
- Synergy coverage

For example, a sunny lawn prompt nudges the system toward refreshing highballs, spritzes, citrus, bubbles, and lighter structures. A cozy nightcap prompt nudges toward stirred or creamy templates.

## Next Upgrades

The next version should add:

- ABV estimates and drink strength constraints
- Sweet/sour balance checks using approximate sugar and acid data
- Ingredient intensity calibration so vodka and Chartreuse are not weighted as if equally expressive
- Expanded synergy rules from open flavor-compound references
- User feedback loops such as `too sweet`, `too strong`, `more refreshing`, or `more adventurous`
