#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { runSimulation, formatSummary, DEFAULTS } from './lib/runner.js'

const HELP = `
TriviaForge client simulator

Connects fake players to a running room and answers each question after a
random delay (clustered near the start and end of the time limit). A few
clients skip each question.

Usage:
  node simulate.js --server <url> --room <code> [options]

Required:
  --server <url>            Server address, e.g. http://192.168.1.10:3000
  --room <code>             Room code to join

Options:
  --clients <n>             Number of clients (default ${DEFAULTS.clients})
  --no-answer-rate <0-1>    Chance a client skips a question (default ${DEFAULTS.noAnswerRate})
  --early-weight <0-1>      Share of answers near the start of the timer (default ${DEFAULTS.earlyWeight})
  --late-weight <0-1>       Share of answers near the end of the timer (default ${DEFAULTS.lateWeight})
  --join-stagger-ms <ms>    Delay between client connections (default ${DEFAULTS.joinStaggerMs})
  --default-time-limit <s>  Time limit to assume if the server sends none (default ${DEFAULTS.defaultTimeLimit})
  --prefix <text>           Username/display-name prefix (default ${DEFAULTS.prefix})
  --no-spoof-ip             Don't send a unique X-Forwarded-For per client
                            (exercises the server's real per-IP rate limits)
  --max-duration <s>        Stop after this many seconds
  --seed <n>                Seed the random choices for repeatable runs
  -v, --verbose             Log every client action
  -h, --help                Show this help

Stops when the quiz completes / the room closes, after --max-duration, or on Ctrl-C.
`

let values
try {
  ;({ values } = parseArgs({
    options: {
      server: { type: 'string' },
      room: { type: 'string' },
      clients: { type: 'string' },
      'no-answer-rate': { type: 'string' },
      'early-weight': { type: 'string' },
      'late-weight': { type: 'string' },
      'join-stagger-ms': { type: 'string' },
      'default-time-limit': { type: 'string' },
      prefix: { type: 'string' },
      'no-spoof-ip': { type: 'boolean' },
      'max-duration': { type: 'string' },
      seed: { type: 'string' },
      verbose: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' }
    }
  }))
} catch (err) {
  console.error(err.message)
  console.error(HELP)
  process.exit(2)
}

if (values.help) {
  console.log(HELP)
  process.exit(0)
}
if (!values.server || !values.room) {
  console.error('Error: --server and --room are required.')
  console.error(HELP)
  process.exit(2)
}

const num = (v, fallback, name, { min = -Infinity, max = Infinity, int = false } = {}) => {
  if (v === undefined) return fallback
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) {
    console.error(`Error: --${name} must be ${int ? 'an integer' : 'a number'} between ${min} and ${max}.`)
    process.exit(2)
  }
  return n
}

const opts = {
  server: values.server,
  room: values.room,
  clients: num(values.clients, DEFAULTS.clients, 'clients', { min: 1, max: 5000, int: true }),
  noAnswerRate: num(values['no-answer-rate'], DEFAULTS.noAnswerRate, 'no-answer-rate', { min: 0, max: 1 }),
  earlyWeight: num(values['early-weight'], DEFAULTS.earlyWeight, 'early-weight', { min: 0, max: 1 }),
  lateWeight: num(values['late-weight'], DEFAULTS.lateWeight, 'late-weight', { min: 0, max: 1 }),
  joinStaggerMs: num(values['join-stagger-ms'], DEFAULTS.joinStaggerMs, 'join-stagger-ms', { min: 0 }),
  defaultTimeLimit: num(values['default-time-limit'], DEFAULTS.defaultTimeLimit, 'default-time-limit', { min: 1 }),
  prefix: values.prefix || DEFAULTS.prefix,
  spoofIp: !values['no-spoof-ip'],
  maxDurationMs: values['max-duration'] ? num(values['max-duration'], 0, 'max-duration', { min: 1 }) * 1000 : undefined,
  seed: values.seed,
  verbose: !!values.verbose
}
if (opts.earlyWeight + opts.lateWeight > 1) {
  console.error('Error: --early-weight plus --late-weight must not exceed 1.')
  process.exit(2)
}

console.log(`Simulating ${opts.clients} client(s) in room ${opts.room} on ${opts.server}` +
  `${opts.spoofIp ? '' : ' (real IP, rate limits apply)'}. Ctrl-C to stop.`)

const run = runSimulation(opts, {
  onProgress: (stats) => {
    console.log(`[progress] joined ${stats.joined}/${opts.clients} | answers ${stats.answersSent} | skipped ${stats.skipped} | rejected ${[...stats.rejected.values()].reduce((a, b) => a + b, 0)} | join failures ${stats.joinFailed}`)
  }
})

process.on('SIGINT', () => run.stop('interrupted'))
process.on('SIGTERM', () => run.stop('terminated'))

const { reason, summary } = await run.done
console.log(`\nStopped: ${reason}`)
console.log(formatSummary(summary))
process.exit(0)
