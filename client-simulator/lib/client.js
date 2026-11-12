import { io } from 'socket.io-client'
import { randomUUID } from 'node:crypto'
import { sampleDelayFraction, shouldSkip, randomText } from './timing.js'

/** Deterministic fake IPv4 per client index, for the X-Forwarded-For header. */
export function fakeIp(index) {
  const n = index + 1
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`
}

/**
 * One simulated player. Joins a room over Socket.IO and answers each
 * presented question after a random delay (or not at all).
 */
export class SimClient {
  constructor({ index, opts, stats, rng, onRoomEnded }) {
    this.index = index
    this.opts = opts
    this.stats = stats
    this.rng = rng
    this.onRoomEnded = onRoomEnded
    this.username = `${opts.prefix}_${index + 1}`
    this.displayName = `${opts.prefix}-${index + 1}`
    this.playerID = randomUUID()
    this.joined = false
    this.handled = new Set() // question indices already scheduled/answered
    this.timers = new Map() // question index -> timeout
    this.socket = null
    this.stopping = false
  }

  log(...args) {
    if (this.opts.verbose) console.log(`[${this.username}]`, ...args)
  }

  connect() {
    const { server, spoofIp } = this.opts
    this.socket = io(server, {
      reconnection: false,
      extraHeaders: spoofIp ? { 'x-forwarded-for': fakeIp(this.index) } : undefined
    })
    const s = this.socket

    s.on('connect', () => {
      s.emit('joinRoom', {
        roomCode: this.opts.room,
        username: this.username,
        displayName: this.displayName,
        playerID: this.playerID
      })
    })

    s.on('connect_error', (err) => {
      if (!this.joined) this.stats.joinFailed++
      this.stats.error(`connect_error: ${err.message}`)
    })

    s.on('playerListUpdate', () => {
      this.stats.playerListUpdates++
      if (!this.joined) {
        this.joined = true
        this.stats.joined++
        this.log('joined')
      }
    })

    s.on('roomError', (message) => {
      this.stats.error(String(message))
      if (!this.joined) this.stats.joinFailed++
      this.log('roomError:', message)
      if (/room not found/i.test(String(message))) this.onRoomEnded?.('room not found')
    })

    s.on('questionPresented', ({ questionIndex, question, timerDuration }) => {
      if (questionIndex === undefined || !question || question.revealed) return
      this.stats.presented(questionIndex)
      this.onQuestion(questionIndex, question, timerDuration)
    })

    s.on('questionRevealed', ({ questionIndex }) => {
      this.stats.revealed(questionIndex)
      this.cancel(questionIndex)
    })

    s.on('answerRejected', (info) => {
      this.stats.reject(info?.timeExpired ? 'late' : (info?.message || 'rejected'))
      this.log('answerRejected:', info?.message)
    })

    s.on('quizCompleted', () => this.onRoomEnded?.('quiz completed'))
    s.on('quizResults', () => this.onRoomEnded?.('results shown'))
    s.on('roomClosed', () => this.onRoomEnded?.('room closed'))

    s.on('disconnect', (reason) => {
      if (!this.stopping) this.stats.disconnects++
      this.log('disconnected:', reason)
    })
  }

  onQuestion(index, question, timerDuration) {
    if (this.handled.has(index)) return // e.g. resent on rejoin
    this.handled.add(index)

    if (shouldSkip(this.rng, this.opts.noAnswerRate)) {
      this.stats.skip(index)
      this.log(`Q${index + 1}: skipping`)
      return
    }

    const isShort = question.type === 'short_answer'
    const choices = question.choices || []
    if (!isShort && choices.length === 0) {
      this.stats.skip(index)
      return
    }

    const limitSec = Number.isFinite(timerDuration) && timerDuration > 0 ? timerDuration : this.opts.defaultTimeLimit
    const delayMs = Math.round(sampleDelayFraction(this.rng, this.opts) * limitSec * 1000)

    const timer = setTimeout(() => {
      this.timers.delete(index)
      if (!this.socket?.connected) return
      const choice = isShort ? randomText(this.rng) : Math.floor(this.rng() * choices.length)
      this.socket.emit('submitAnswer', { roomCode: this.opts.room, choice })
      this.stats.sent(index)
      this.log(`Q${index + 1}: answered ${JSON.stringify(choice)} after ${delayMs}ms`)
    }, delayMs)
    this.timers.set(index, timer)
  }

  cancel(index) {
    const t = this.timers.get(index)
    if (t) {
      clearTimeout(t)
      this.timers.delete(index)
    }
  }

  stop() {
    this.stopping = true
    for (const t of this.timers.values()) clearTimeout(t)
    this.timers.clear()
    this.socket?.disconnect()
  }
}
