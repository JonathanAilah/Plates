// Food-type tags a cook can put on a dish (stored comma-separated in
// dishes.tags) and the kitchen-condition filters buyers can apply in the
// Discover filter panel. Shared by the dish form, the feed filters, and the
// server-side validation in /api/dishes.

export const FOOD_TAGS = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Dessert',
  'Baked goods',
  'Snacks',
  'Drinks',
  'Comfort food',
  'Soul food',
  'BBQ',
  'Seafood',
  'Soups & stews',
  'Salads',
  'Pasta',
  'Rice dishes',
  'Tacos & wraps',
  'Spicy',
  'Vegan',
  'Vegetarian',
  'Halal',
  'Kosher',
  'American',
  'Mexican',
  'Italian',
  'Caribbean',
  'African',
  'Asian',
  'Indian',
  'Middle Eastern',
];

export const MAX_DISH_TAGS = 3;

// Buyer-facing kitchen-condition filters. The first two require the cook to
// have marked the flag; the "no-*" ones require its absence.
export const KITCHEN_CONDITION_FILTERS = [
  { key: 'nut-free', label: 'Nut-free kitchen' },
  { key: 'gluten-free', label: 'Gluten-free kitchen' },
  { key: 'no-pets', label: 'No pets in home' },
  { key: 'no-smokers', label: 'No smokers in home' },
] as const;

export function conditionLabel(key: string): string {
  return KITCHEN_CONDITION_FILTERS.find((c) => c.key === key)?.label ?? key;
}
