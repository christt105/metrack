<script setup lang="ts">
import { computed } from 'vue';
import type { Videogame } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';
import SteamAchievementsRefresh from './SteamAchievementsRefresh.vue';

const props = defineProps<{ game: Videogame }>();
const emit = defineEmits<{ refreshed: [] }>();

const messages = useMessages();
const text = computed(() => {
  const { achievementsUnlocked: unlocked, achievementsTotal: total } = props.game;
  if (total === null || unlocked === null) return messages.steam.achievements.unknown;
  if (total === 0) return messages.steam.achievements.none;
  const progress = messages.steam.achievements.progress(unlocked, total);
  const last = props.game.achievementsLastUnlockedAt;
  return last ? `${progress} (${messages.steam.achievements.lastUnlock(last)})` : progress;
});
</script>

<template>
  <section class="achievements" data-test="achievements">
    <h2>{{ messages.steam.achievements.title }}</h2>
    <p data-test="achievements-text">{{ text }}</p>
    <SteamAchievementsRefresh
      :game-id="game.id"
      :label="messages.steam.achievements.refresh"
      @done="emit('refreshed')"
    />
  </section>
</template>
