import { BadRequestError } from './errors.js'
import { matchShortAnswer } from './similarity.js'

/**
 * Speed-based scoring. Single source of truth for points calculation.
 * A correct answer earns 100% of the question's points when instant, decaying
 * linearly to MIN_FRACTION (10%) at the time limit. Wrong/unanswered = 0.
 */

export const MIN_FRACTION = 0.1
export const DEFAULT_POINTS = 1000
export const DEFAULT_TIME_LIMIT = 30
export const MIN_POINTS = 1
export const MAX_POINTS = 10000
export const MIN_TIME_LIMIT = 5
export const MAX_TIME_LIMIT = 300
/** Grace (ms) beyond the time limit to absorb network latency. */
export const LATENCY_GRACE_MS = 1500

/** Effective time limit in seconds: question -> quiz -> global default -> 30. */
export function resolveTimeLimit(question, quiz, globalDefault) {
  return question?.timeLimit ?? question?.time_limit
    ?? quiz?.questionTimer ?? quiz?.question_timer
    ?? globalDefault ?? DEFAULT_TIME_LIMIT
}

export function calculatePoints({ isCorrect, points, limitSec, elapsedMs }) {
  if (!isCorrect) return 0
  const base = Number.isFinite(points) ? points : DEFAULT_POINTS
  const limitMs = Math.max(1, (limitSec || DEFAULT_TIME_LIMIT) * 1000)
  const ratio = Math.min(1, Math.max(0, (elapsedMs || 0) / limitMs))
  return Math.round(base * (1 - (1 - MIN_FRACTION) * ratio))
}

/** True when an answer arrived after the limit plus latency grace. */
export function isLate(limitSec, elapsedMs) {
  return elapsedMs > limitSec * 1000 + LATENCY_GRACE_MS
}

/** Returns an int in [min, max], null for empty (when allowNull), else throws. */
export function parseBounded(value, min, max, label, { allowNull = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (allowNull) return null
    return undefined
  }
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new BadRequestError(`${label} must be a whole number between ${min} and ${max}`)
  }
  return n
}

/** Grades a live-room choice against a question (multiple choice, true/false or short answer). */
export function gradeChoice(question, choice, threshold = 0.85) {
  if (!question || choice === null || choice === undefined) return false
  if (question.type === 'short_answer') {
    return matchShortAnswer(choice, question.acceptedAnswers || [], threshold).isCorrect
  }
  return choice === question.correctChoice
}

/** Total points a live-room player has earned (stored per-answer at submit time). */
export function totalPoints(player) {
  return Object.values(player?.answerMeta || {}).reduce((sum, m) => sum + (m.points || 0), 0)
}

/** Total response time (ms) across a player's correct answers - leaderboard tie-break. */
export function totalCorrectResponseMs(player) {
  return Object.values(player?.answerMeta || {}).reduce(
    (sum, m) => sum + (m.isCorrect ? (m.responseMs || 0) : 0), 0)
}

/** Leaderboard comparator: points desc, correct count desc, faster total time, then name. */
export function compareStandings(a, b) {
  return (b.points - a.points)
    || (b.correct - a.correct)
    || ((a.responseMs ?? 0) - (b.responseMs ?? 0))
    || String(a.name).localeCompare(String(b.name))
}

/**
 * Final-results payload for the podium (live rooms). Shared by the manual and
 * auto-pilot completion paths so both rank and total by points.
 */
export function buildQuizResultsPayload(room) {
  const players = Object.values(room.players)
    .filter(p => !p.isSpectator && p.answers && Object.keys(p.answers).length > 0)
    .map(p => {
      const points = totalPoints(p)
      return {
        name: p.name,
        score: points,
        points,
        correct: Object.values(p.answerMeta || {}).filter(m => m.isCorrect).length,
        responseMs: totalCorrectResponseMs(p),
        totalAnswered: Object.keys(p.answers).length
      }
    })
    .sort(compareStandings)

  const totalScore = players.reduce((sum, p) => sum + p.points, 0)
  const classAverage = players.length > 0 ? Math.round(totalScore / players.length) : 0

  return {
    players,
    totalQuestions: room.quizData.questions.length,
    classAverage,
    showResults: true
  }
}
