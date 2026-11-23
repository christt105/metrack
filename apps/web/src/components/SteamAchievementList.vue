<script setup lang="ts">
import type { SteamAchievement } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';

defineProps<{ achievements: SteamAchievement[] }>();

const messages = useMessages();
</script>

<template>
  <ul class="list" data-test="achievement-list">
    <li
      v-for="achievement in achievements"
      :key="achievement.apiName"
      class="item"
      :class="{ locked: !achievement.unlocked }"
      data-test="achievement"
    >
      <img
        v-if="achievement.iconUrl"
        :src="achievement.iconUrl"
        alt=""
        width="48"
        height="48"
        loading="lazy"
        decoding="async"
      />
      <span v-else class="icon-fallback" aria-hidden="true"></span>
      <div class="text">
        <strong class="name">{{ achievement.name }}</strong>
        <span class="description">{{
          achievement.description ?? messages.steam.achievements.hiddenDescription
        }}</span>
        <span class="muted state">{{
          achievement.unlocked
            ? achievement.unlockedAt
              ? messages.steam.achievements.unlockedOn(achievement.unlockedAt.slice(0, 10))
              : messages.steam.achievements.unlockedOn('')
            : messages.steam.achievements.locked
        }}</span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.item {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 8px;
  background: var(--surface-low);
  border: 1px solid var(--outline);
  border-radius: var(--r-md);
}

img,
.icon-fallback {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: var(--r-sm, 6px);
  background: var(--surface-high, var(--surface-low));
  object-fit: cover;
}

.locked img {
  opacity: 0.55;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name,
.description {
  overflow-wrap: anywhere;
}

.description {
  color: var(--on-surface);
  font-size: var(--t-label);
}

.state {
  font-size: var(--t-label);
}

.locked .name {
  color: var(--muted);
}
</style>
