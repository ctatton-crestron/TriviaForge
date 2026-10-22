<template>
  <Modal :isOpen="isOpen" size="large" title="Live Standings" @close="$emit('close')">
    <template #default>
      <div class="display-standings">
        <table v-if="sortedPlayers.length > 0" class="standings-table">
          <thead>
            <tr>
              <th class="rank-col">#</th>
              <th>Player</th>
              <th>Points</th>
              <th>Correct</th>
              <th>Answered</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(player, idx) in sortedPlayers" :key="player.name" :class="['standings-row', getRankClass(idx)]">
              <td class="rank"><AppIcon v-if="idx <= 2" name="medal" size="lg" :class="getMedalClass(idx)" /><template v-else>{{ idx + 1 }}</template></td>
              <td class="player-name">{{ player.name }}</td>
              <td class="points">{{ (player.points || 0).toLocaleString() }}</td>
              <td class="correct">{{ player.correct }}</td>
              <td class="answered">{{ player.answered }}</td>
            </tr>
          </tbody>
        </table>

        <div v-else class="empty-state-standings">
          <AppIcon name="clipboard-list" size="2xl" />
          <p>No answers revealed yet!</p>
          <p class="empty-hint">Standings will appear once the first answer is revealed.</p>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import Modal from '@/components/common/Modal.vue'
import AppIcon from '@/components/common/AppIcon.vue'

defineProps({
  isOpen: { type: Boolean, required: true },
  sortedPlayers: { type: Array, default: () => [] }
})

defineEmits(['close'])

const getRankClass = (idx) => ['gold', 'silver', 'bronze'][idx] || ''
const getMedalClass = (idx) => ['medal-gold', 'medal-silver', 'medal-bronze'][idx] || ''
</script>

<style scoped>
.display-standings {
  max-height: 70vh;
  overflow-y: auto;
}

.standings-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-overlay-30);
  border-radius: 8px;
  overflow: hidden;
  font-size: 1.25rem;
}

.standings-table thead {
  background: var(--bg-overlay-50);
}

.standings-table th {
  text-align: center;
  padding: 1rem 0.75rem;
  color: var(--text-tertiary);
  font-weight: bold;
  border-bottom: 2px solid var(--border-color);
}

.standings-table th:nth-child(2) {
  text-align: left;
}

.standings-table td {
  padding: 1rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.standings-row.gold,
.standings-row.bronze {
  background: var(--warning-bg-15);
}

.standings-row.silver {
  background: var(--bg-overlay-15);
}

.standings-table .rank {
  width: 60px;
  color: var(--text-tertiary);
  font-weight: bold;
}

.standings-table .player-name {
  text-align: left;
  font-weight: bold;
  color: var(--text-primary);
}

.standings-table .points {
  color: var(--info-light);
  font-weight: bold;
}

.standings-table .correct {
  color: var(--secondary-light);
  font-weight: bold;
}

.standings-table .answered {
  color: var(--warning-light);
  font-weight: bold;
}

.empty-state-standings {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-tertiary);
  font-size: 1.25rem;
}

.empty-hint {
  font-size: 1rem;
  margin-top: 0.5rem;
}

.medal-gold { color: #FFD700; }
.medal-silver { color: #C0C0C0; }
.medal-bronze { color: #CD7F32; }
</style>
