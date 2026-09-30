/**
 * Single source of meal definitions. Everything that lists meals (tiles, scoring, stats,
 * importer, rules tests) iterates this array — add or reorder meals here only.
 */
export const MEALS = [
  { key: 'breakfast', label: 'Breakfast', icon: '🍳' },
  { key: 'brunch', label: 'Brunch', icon: '🥐' },
  { key: 'lunch', label: 'Lunch', icon: '🍱' },
  { key: 'evening', label: 'Evening', icon: '🍎' },
  { key: 'dinner', label: 'Dinner', icon: '🍲' },
] as const

export type MealDef = (typeof MEALS)[number]
export type MealKey = MealDef['key']

export const MEAL_KEYS: readonly MealKey[] = MEALS.map((m) => m.key)
