/**
 * A synthetic knowledge base: three tea blends with their measures, the substitutes each
 * ingredient has, and one blend nobody has tried yet. Every figure here is made up.
 */
export interface Ingredient {
  name: string;
  /** Millilitres of liquid or teaspoons of leaf, as stated in `unit`. */
  amount: number;
  unit: 'ml' | 'tsp';
}

export interface Recipe {
  name: string;
  ingredients: Ingredient[];
  steepMinutes: number;
  /** True for a blend nobody has tested; replies must label it, never present it as proven. */
  untested?: boolean;
  note: string;
}

export const RECIPES: Recipe[] = [
  {
    name: 'Harbour Mist',
    ingredients: [
      { name: 'green tea', amount: 2, unit: 'tsp' },
      { name: 'mint', amount: 1, unit: 'tsp' },
      { name: 'water', amount: 250, unit: 'ml' },
    ],
    steepMinutes: 3,
    note: 'Bright and cool; steep short so the green tea stays sweet.',
  },
  {
    name: 'Ember Chai',
    ingredients: [
      { name: 'black tea', amount: 2, unit: 'tsp' },
      { name: 'ginger', amount: 1, unit: 'tsp' },
      { name: 'oat milk', amount: 60, unit: 'ml' },
      { name: 'water', amount: 190, unit: 'ml' },
    ],
    steepMinutes: 5,
    note: 'Warming; add the oat milk after steeping.',
  },
  {
    name: 'Lantern Riff',
    ingredients: [
      { name: 'rooibos', amount: 3, unit: 'tsp' },
      { name: 'orange peel', amount: 1, unit: 'tsp' },
      { name: 'water', amount: 250, unit: 'ml' },
    ],
    steepMinutes: 6,
    untested: true,
    note: 'An idea from the notebook, never brewed.',
  },
];

export const SUBSTITUTES: Record<string, string[]> = {
  mint: ['lemon balm', 'basil'],
  ginger: ['cardamom'],
  'oat milk': ['almond milk', 'whole milk'],
  'green tea': ['white tea'],
};

/** A recipe by name, case-insensitive, or undefined. */
export function findRecipe(name: string): Recipe | undefined {
  const wanted = name.trim().toLowerCase();
  return RECIPES.find((recipe) => recipe.name.toLowerCase() === wanted || wanted.includes(recipe.name.toLowerCase()));
}

/** The figures a recipe lets a reply state: each amount and the steep time. */
export function figuresOf(recipe: Recipe): number[] {
  return [...recipe.ingredients.map((ingredient) => ingredient.amount), recipe.steepMinutes];
}
