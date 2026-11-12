/**
 * Player-list payloads for the `playerListUpdate` socket event.
 *
 * Clients only need names, connection state and whether each player has
 * answered. Raw player objects carry every player's answers, answerMeta,
 * user agent and ids, so sending them to the whole room costs O(players^3)
 * bytes per question and exposes other players' choices.
 */

/** The fields clients may see for one player. */
export function toPublicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    connected: p.connected,
    connectionState: p.connectionState,
    isSpectator: !!p.isSpectator,
    hasAnswered: p.choice !== null && p.choice !== undefined
  }
}

/** Full `playerListUpdate` payload for a room (spectators excluded). */
export function buildPlayerListPayload(roomCode, room) {
  return {
    roomCode,
    players: Object.values(room.players).filter(p => !p.isSpectator).map(toPublicPlayer),
    revealedCount: (room.revealedQuestions || []).length,
    totalQuestions: room.quizData.questions.length
  }
}
