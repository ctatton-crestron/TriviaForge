/**
 * Answer-timing model.
 * Real players tend to answer either right away or right before the timer
 * runs out, so delays are drawn from a mixture: an "early" cluster near the
 * start, a "late" cluster near the end, and a thin uniform middle.
 * Delays are fractions of the question's time limit and never exceed
 * MAX_FRACTION, so answers land inside the server's limit + grace window.
 */

export const MAX_FRACTION = 0.96

/** Small seedable PRNG (mulberry32). Without a seed, falls back to Math.random. */
export function makeRng(seed) {
  if (seed === undefined || seed === null) return Math.random
  let a = (Number(seed) >>> 0) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fraction (0..MAX_FRACTION) of the time limit to wait before answering. */
export function sampleDelayFraction(rng, { earlyWeight = 0.45, lateWeight = 0.45 } = {}) {
  const r = rng()
  let f
  if (r < earlyWeight) {
    f = 0.02 + 0.13 * rng() ** 2 // 0.02-0.15, densest near the start
  } else if (r < earlyWeight + lateWeight) {
    f = MAX_FRACTION - 0.16 * rng() ** 2 // 0.80-0.96, densest near the end
  } else {
    f = 0.15 + 0.65 * rng() // uniform middle
  }
  return Math.min(MAX_FRACTION, f)
}

/** True if this client should skip answering the current question. */
export function shouldSkip(rng, rate) {
  return rng() < rate
}

const WORDS = ['paris', 'blue', 'seven', 'mercury', 'guitar', 'tiger', 'nile', 'oxygen', 'pizza', 'mars']

/** Random short free-text answer for open-ended questions. */
export function randomText(rng) {
  return WORDS[Math.floor(rng() * WORDS.length)]
}
