/**
 * Question payloads sent to players/displays.
 * Until a question is revealed, the answer key must not leave the server:
 * strip correctChoice and acceptedAnswers, and for short-answer questions
 * blank `choices` (it holds the accepted answers). Presenters receive the
 * full question list separately (roomCreated / roomRestored).
 */

/** Choices that are safe to send before reveal. */
export function publicChoices(question, isRevealed) {
  if (isRevealed || question?.type !== 'short_answer') return question?.choices
  return []
}

/** Question object for questionPresented. Revealed questions are sent in full. */
export function questionForClients(question, isRevealed = false) {
  if (isRevealed) return { ...question, revealed: true }
  const { correctChoice, acceptedAnswers, ...rest } = question
  return { ...rest, choices: publicChoices(question, false), revealed: false }
}
