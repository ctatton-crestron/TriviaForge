import { SimClient } from './client.js'
import { Stats, formatSummary } from './stats.js'
import { makeRng } from './timing.js'

export const DEFAULTS = {
  clients: 10,
  noAnswerRate: 0.05,
  earlyWeight: 0.45,
  lateWeight: 0.45,
  joinStaggerMs: 50,
  defaultTimeLimit: 30,
  prefix: 'sim',
  spoofIp: true,
  verbose: false,
  endGraceMs: 3000
}

/**
 * Runs a simulation until the room ends (results shown / closed), stop() is
 * called, or maxDurationMs elapses. Resolves with the summary object.
 */
export function runSimulation(userOpts, { onProgress } = {}) {
  const opts = { ...DEFAULTS, ...userOpts }
  const stats = new Stats()
  const clients = []
  let finished = false
  let endTimer = null
  let progressTimer = null
  let maxTimer = null
  let resolveDone
  const done = new Promise((resolve) => { resolveDone = resolve })

  const finish = (reason) => {
    if (finished) return
    finished = true
    clearTimeout(endTimer)
    clearTimeout(maxTimer)
    clearInterval(progressTimer)
    clients.forEach((c) => c.stop())
    resolveDone({ reason, summary: stats.summary(opts.clients) })
  }

  // The first client to see the room end schedules shutdown after a short grace
  // so the remaining clients can receive the same event for the stats.
  const onRoomEnded = (reason) => {
    if (finished || endTimer) return
    endTimer = setTimeout(() => finish(reason), opts.endGraceMs)
  }

  for (let i = 0; i < opts.clients; i++) {
    const seed = opts.seed === undefined ? undefined : Number(opts.seed) + i
    clients.push(new SimClient({ index: i, opts, stats, rng: makeRng(seed), onRoomEnded }))
  }

  clients.forEach((c, i) => {
    setTimeout(() => { if (!finished) c.connect() }, i * opts.joinStaggerMs)
  })

  if (onProgress) {
    progressTimer = setInterval(() => onProgress(stats, opts), 5000)
  }
  if (opts.maxDurationMs) {
    maxTimer = setTimeout(() => finish('max duration reached'), opts.maxDurationMs)
  }

  return { done, stop: (reason = 'stopped') => finish(reason), stats, opts }
}

export { formatSummary }
