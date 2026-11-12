/** Counters and per-question timing for a simulation run. */

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0)

export class Stats {
  constructor() {
    this.joined = 0
    this.joinFailed = 0
    this.answersSent = 0
    this.skipped = 0
    this.disconnects = 0
    this.playerListUpdates = 0
    this.rejected = new Map() // reason -> count
    this.errors = new Map() // roomError message -> count
    this.questions = new Map() // index -> { presented: [t], revealed: [t], sent: n, skipped: n }
  }

  _q(i) {
    if (!this.questions.has(i)) this.questions.set(i, { presented: [], revealed: [], sent: 0, skipped: 0 })
    return this.questions.get(i)
  }

  presented(i, t = Date.now()) { this._q(i).presented.push(t) }
  revealed(i, t = Date.now()) { this._q(i).revealed.push(t) }
  sent(i) { this.answersSent++; this._q(i).sent++ }
  skip(i) { this.skipped++; this._q(i).skipped++ }
  reject(reason) { this.rejected.set(reason, (this.rejected.get(reason) || 0) + 1) }
  error(message) { this.errors.set(message, (this.errors.get(message) || 0) + 1) }

  /** Spread of receipt times: first -> last, and the 95th percentile offset from the first. */
  static spread(times) {
    if (times.length === 0) return { n: 0, spreadMs: 0, p95Ms: 0 }
    const sorted = [...times].sort((a, b) => a - b)
    const first = sorted[0]
    return {
      n: sorted.length,
      spreadMs: sorted[sorted.length - 1] - first,
      p95Ms: pct(sorted, 0.95) - first
    }
  }

  summary(totalClients) {
    const perQuestion = [...this.questions.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, q]) => ({
        index,
        presentedTo: Stats.spread(q.presented),
        revealedTo: Stats.spread(q.revealed),
        sent: q.sent,
        skipped: q.skipped
      }))
    return {
      clients: totalClients,
      joined: this.joined,
      joinFailed: this.joinFailed,
      answersSent: this.answersSent,
      skipped: this.skipped,
      disconnects: this.disconnects,
      playerListUpdatesTotal: this.playerListUpdates,
      playerListUpdatesPerClient: this.joined ? +(this.playerListUpdates / this.joined).toFixed(1) : 0,
      rejected: Object.fromEntries(this.rejected),
      errors: Object.fromEntries(this.errors),
      perQuestion
    }
  }
}

export function formatSummary(s) {
  const lines = []
  lines.push('')
  lines.push('=== Simulation summary ===')
  lines.push(`Clients: ${s.clients}  joined: ${s.joined}  failed to join: ${s.joinFailed}  disconnects: ${s.disconnects}`)
  lines.push(`Answers sent: ${s.answersSent}  skipped (no answer): ${s.skipped}`)
  const rej = Object.entries(s.rejected)
  lines.push(`Rejected by server: ${rej.length ? rej.map(([k, v]) => `${k} x${v}`).join(', ') : 'none'}`)
  const errs = Object.entries(s.errors)
  if (errs.length) lines.push(`Room errors: ${errs.map(([k, v]) => `"${k}" x${v}`).join(', ')}`)
  lines.push(`playerListUpdate events: ${s.playerListUpdatesTotal} total, ${s.playerListUpdatesPerClient} per client`)
  if (s.perQuestion.length) {
    lines.push('')
    lines.push('Per question (spread = first -> last client to receive the event):')
    for (const q of s.perQuestion) {
      lines.push(
        `  Q${q.index + 1}: presented spread ${q.presentedTo.spreadMs}ms (n=${q.presentedTo.n}) | ` +
        `reveal spread ${q.revealedTo.spreadMs}ms, p95 ${q.revealedTo.p95Ms}ms (n=${q.revealedTo.n}) | ` +
        `answers ${q.sent}, skipped ${q.skipped}`
      )
    }
  }
  return lines.join('\n')
}
