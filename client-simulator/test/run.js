// Self-checks for the simulator. Uses an in-process mock Socket.IO server that
// speaks just enough of the TriviaForge protocol; no real server needed.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { makeRng, sampleDelayFraction, shouldSkip, MAX_FRACTION } from '../lib/timing.js'
import { runSimulation } from '../lib/runner.js'

// ---- 1. timing model ----
{
  const rng = makeRng(42)
  const N = 20000
  const bins = new Array(10).fill(0)
  let max = 0
  let skipped = 0
  for (let i = 0; i < N; i++) {
    const f = sampleDelayFraction(rng)
    max = Math.max(max, f)
    bins[Math.min(9, Math.floor(f * 10))]++
    if (shouldSkip(rng, 0.05)) skipped++
  }
  console.log('delay histogram (fraction of limit, 10 bins):', bins.map((b) => ((b / N) * 100).toFixed(0) + '%').join(' '))
  assert.ok(max <= MAX_FRACTION, `delay fraction ${max} exceeds ${MAX_FRACTION}`)
  const early = (bins[0] + bins[1]) / N
  const late = (bins[8] + bins[9]) / N
  const middle = bins.slice(2, 8).reduce((a, b) => a + b, 0) / N
  assert.ok(early > 0.4 && late > 0.4, `expected clusters near start/end, got early=${early} late=${late}`)
  assert.ok(middle < 0.2, `expected a thin middle, got ${middle}`)
  assert.ok(Math.abs(skipped / N - 0.05) < 0.01, `skip rate ${skipped / N} not ~5%`)
  // seeding is repeatable
  const a = makeRng(7), b = makeRng(7)
  assert.equal(a(), b())
  console.log('ok: timing model')
}

// ---- 2. end-to-end against a mock server ----
{
  const CLIENTS = 30
  const LIMIT_SEC = 2
  const http = createServer()
  const io = new Server(http)
  const seenIps = new Set()
  const joined = new Set()
  const answers = [] // { q, ms, choice, type }
  let qStart = 0
  let currentQ = -1

  io.on('connection', (socket) => {
    seenIps.add(socket.handshake.headers['x-forwarded-for'])
    socket.on('joinRoom', ({ roomCode, username, displayName, playerID }) => {
      if (roomCode !== 'TEST' || !username || !displayName || !playerID) return socket.emit('roomError', 'Room not found.')
      joined.add(username)
      socket.join('TEST')
      socket.emit('playerListUpdate', { roomCode, players: [], revealedCount: 0, totalQuestions: 2 })
      if (joined.size === CLIENTS) setTimeout(runQuiz, 300)
    })
    socket.on('submitAnswer', ({ roomCode, choice }) => {
      assert.equal(roomCode, 'TEST')
      answers.push({ q: currentQ, ms: Date.now() - qStart, choice })
    })
  })

  const present = (index, question) => {
    currentQ = index
    qStart = Date.now()
    io.to('TEST').emit('questionPresented', { questionIndex: index, question, timerStartedAt: new Date().toISOString(), timerDuration: LIMIT_SEC })
  }
  const runQuiz = () => {
    present(0, { type: 'multiple_choice', choices: ['A', 'B', 'C', 'D'], revealed: false })
    setTimeout(() => {
      io.to('TEST').emit('questionRevealed', { questionIndex: 0, question: {}, results: [] })
      present(1, { type: 'short_answer', choices: [], revealed: false })
      setTimeout(() => {
        io.to('TEST').emit('questionRevealed', { questionIndex: 1, question: {}, results: [] })
        io.to('TEST').emit('quizCompleted', {})
      }, LIMIT_SEC * 1000 + 100)
    }, LIMIT_SEC * 1000 + 100)
  }

  await new Promise((r) => http.listen(0, r))
  const port = http.address().port

  const run = runSimulation({
    server: `http://localhost:${port}`,
    room: 'TEST',
    clients: CLIENTS,
    noAnswerRate: 0.2,
    joinStaggerMs: 5,
    endGraceMs: 300,
    maxDurationMs: 20000,
    seed: 1
  })
  const { reason, summary } = await run.done
  console.log('stopped:', reason)
  console.log(JSON.stringify(summary, null, 1).slice(0, 900))

  assert.equal(reason, 'quiz completed')
  assert.equal(summary.joined, CLIENTS)
  assert.equal(summary.joinFailed, 0)
  assert.equal(seenIps.size, CLIENTS, 'each client should send a unique X-Forwarded-For')
  assert.equal(summary.answersSent + summary.skipped, CLIENTS * 2)
  assert.equal(answers.length, summary.answersSent)
  assert.ok(summary.skipped > 0 && summary.skipped < CLIENTS, `skipped ${summary.skipped} should be a minority`)
  const ms = answers.map((a) => a.ms)
  assert.ok(Math.max(...ms) <= LIMIT_SEC * 1000 * MAX_FRACTION + 250, `answer at ${Math.max(...ms)}ms is past the limit`)
  const early = ms.filter((m) => m < LIMIT_SEC * 1000 * 0.3).length
  const late = ms.filter((m) => m > LIMIT_SEC * 1000 * 0.7).length
  assert.ok(early > 0 && late > 0, `expected early and late answers (early ${early}, late ${late})`)
  assert.ok(answers.some((a) => typeof a.choice === 'string') && answers.some((a) => typeof a.choice === 'number'), 'both answer types used')
  assert.equal(summary.perQuestion.length, 2)
  io.close()
  http.close()
  console.log('ok: end-to-end against mock server')
}

process.exit(0)
