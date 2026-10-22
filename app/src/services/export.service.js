/**
 * TriviaForge - Export Service
 *
 * Generates CSV exports for session results
 */

/**
 * Generate CSV content from session data
 * @param {Object} sessionData - Full session data with questions and players
 * @returns {string} CSV content
 */
export function generateCSV(sessionData) {
  const lines = [];

  // Header section
  lines.push('TriviaForge Session Export');
  lines.push(`Quiz: ${escapeCSV(sessionData.quizTitle)}`);
  lines.push(`Room Code: ${sessionData.roomCode}`);
  lines.push(`Status: ${sessionData.status}`);
  lines.push(`Date: ${formatDate(sessionData.createdAt)}`);
  if (sessionData.completedAt) {
    lines.push(`Completed: ${formatDate(sessionData.completedAt)}`);
  }
  lines.push('');

  // Player Results section
  lines.push('PLAYER RESULTS');
  lines.push('Rank,Name,Points,Correct,Answered,Accuracy');

  // Rank by total points (descending); ties: more correct answers, then faster total time
  const sortedPlayers = [...sessionData.playerResults].sort((a, b) =>
    (b.points || 0) - (a.points || 0) ||
    b.correct - a.correct ||
    (a.responseMs || 0) - (b.responseMs || 0) ||
    String(a.name).localeCompare(String(b.name))
  );

  sortedPlayers.forEach((player, index) => {
    const accuracy = player.answered > 0
      ? Math.round((player.correct / player.answered) * 100)
      : 0;
    lines.push(
      `${index + 1},${escapeCSV(player.name)},${player.points || 0},${player.correct},${player.answered},${accuracy}%`
    );
  });

  lines.push('');

  // Question Breakdown section
  lines.push('QUESTION BREAKDOWN');
  lines.push('#,Question,Correct Answer,Correct Count,Incorrect Count,Unanswered');

  sessionData.questions.forEach((question, qIdx) => {
    const isShortAnswer = question.type === 'short_answer';
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    sessionData.playerResults.forEach((player) => {
      const answer = player.answers[qIdx];
      if (answer === undefined || answer === '') {
        unansweredCount++;
      } else if (isShortAnswer ? question.shortAnswerCorrectness?.[player.name] : answer === question.correctChoice) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    const correctAnswerLabel = isShortAnswer
      ? (question.acceptedAnswers || []).map(a => a.answer_text).join(' / ')
      : `${String.fromCharCode(65 + question.correctChoice)}. ${question.choices[question.correctChoice] || ''}`;

    lines.push(
      `${qIdx + 1},${escapeCSV(question.text)},${escapeCSV(correctAnswerLabel)},${correctCount},${incorrectCount},${unansweredCount}`
    );
  });

  return lines.join('\n');
}

/**
 * Escape special characters for CSV
 * @param {string} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default {
  generateCSV,
};
