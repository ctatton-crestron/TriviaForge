/**
 * Server-side question clocks for live rooms.
 * The server (never the client) decides how long a player took to answer and
 * whether an answer arrived too late. Clocks support auto-mode pause/resume.
 */

import { DEFAULT_TIME_LIMIT, LATENCY_GRACE_MS } from '../utils/scoring.js'

/** Effective limit (seconds): question -> auto-mode room timer -> quiz -> global default -> 30. */
export function getQuestionLimit(room, questionIndex, quizOptions) {
  const q = room.quizData?.questions?.[questionIndex]
  return q?.timeLimit
    ?? (room.autoMode ? room.questionTimer : null)
    ?? room.quizData?.questionTimer
    ?? quizOptions?.defaultQuestionTimer
    ?? DEFAULT_TIME_LIMIT
}

/** Starts the clock for a question; keeps the original start if already running (re-present). */
export function startQuestionClock(room, questionIndex, quizOptions) {
  if (!room.questionClocks) room.questionClocks = {}
  const existing = room.questionClocks[questionIndex]
  const limitSec = getQuestionLimit(room, questionIndex, quizOptions)
  if (existing) {
    existing.limitSec = limitSec
    return existing
  }
  room.questionClocks[questionIndex] = { startedAt: Date.now(), limitSec, pausedAt: null, pausedMs: 0 }
  return room.questionClocks[questionIndex]
}

/** Elapsed ms on the clock excluding paused time. null if no clock exists. */
export function getElapsedMs(room, questionIndex) {
  const c = room.questionClocks?.[questionIndex]
  if (!c) return null
  const now = c.pausedAt ?? Date.now()
  return Math.max(0, now - c.startedAt - c.pausedMs)
}

export function pauseQuestionClock(room) {
  const c = room.questionClocks?.[room.currentQuestionIndex]
  if (c && !c.pausedAt) c.pausedAt = Date.now()
}

export function resumeQuestionClock(room) {
  const c = room.questionClocks?.[room.currentQuestionIndex]
  if (c && c.pausedAt) {
    c.pausedMs += Date.now() - c.pausedAt
    c.pausedAt = null
  }
}

/** Remaining seconds for the question (for reconnects). */
export function getRemainingSec(room, questionIndex) {
  const c = room.questionClocks?.[questionIndex]
  const elapsed = getElapsedMs(room, questionIndex)
  if (!c || elapsed === null) return null
  return Math.max(0, c.limitSec - elapsed / 1000)
}

/** True when the answer is past the limit (plus latency grace). */
export function isAnswerLate(room, questionIndex) {
  const c = room.questionClocks?.[questionIndex]
  const elapsed = getElapsedMs(room, questionIndex)
  if (!c || elapsed === null) return false
  return elapsed > c.limitSec * 1000 + LATENCY_GRACE_MS
}

/** Payload fields for questionPresented so every client renders the same countdown. */
export function getTimerFields(room, questionIndex) {
  const c = room.questionClocks?.[questionIndex]
  if (!c) return {}
  const remaining = getRemainingSec(room, questionIndex)
  return {
    timerStartedAt: new Date().toISOString(),
    timerDuration: remaining ?? c.limitSec
  }
}
