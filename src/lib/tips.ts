/**
 * Short weight-gain tips shown beside the score ring on Today. One is picked at random each time
 * the screen opens. Keep each tip to a few words.
 */
export const WEIGHT_GAIN_TIPS = [
  'Add a spoon of peanut butter.',
  'Drink milk instead of water.',
  'Snack on nuts and dried fruit.',
  'Add olive oil to your meals.',
  'Top toast with avocado.',
  'Blend a banana smoothie.',
  'Add cheese to eggs or rice.',
  'Use full-fat yoghurt.',
  'Never skip breakfast.',
  'Eat every 3 hours.',
  'Add an extra egg.',
  'Keep snacks within reach.',
  'Have a bedtime snack.',
  'Add butter or ghee to rice.',
  'Drink juice with meals.',
  "Don't fill up on water first.",
  'Sip drinks after eating.',
  'Use a bigger plate.',
  'Add granola to yoghurt.',
  'Add honey to oats.',
  'Eat bananas daily.',
  'Add a glass of milk at night.',
  'Pick whole milk over skim.',
  'Add paneer or tofu.',
  'Eat dates as a sweet snack.',
  'Sprinkle seeds on everything.',
  'Make oats with milk.',
  'Add a side of potatoes.',
  'Have a handful of trail mix.',
  'Pair fruit with nut butter.',
  'Add coconut milk to curries.',
  'Choose dense breads.',
  'Have a protein shake.',
  'Add an extra roti or slice.',
  'Rest well — sleep builds you up.',
  'Light strength training helps.',
  'Eat slowly, but finish.',
  'Plan meals the night before.',
  'Small, frequent meals add up.',
  'Add hummus to snacks.',
] as const

/** A random tip. `random` is injectable for tests and must return a number in [0, 1). */
export function pickTip(random: () => number = Math.random): string {
  const i = Math.min(WEIGHT_GAIN_TIPS.length - 1, Math.floor(random() * WEIGHT_GAIN_TIPS.length))
  return WEIGHT_GAIN_TIPS[i] ?? WEIGHT_GAIN_TIPS[0]
}
