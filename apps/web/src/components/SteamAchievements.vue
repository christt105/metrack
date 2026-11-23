<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SteamAchievementsDetail, Videogame } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useLocale } from '../composables/useLocale';
import { useMessages } from '../composables/useMessages';
import ErrorNotice from './ErrorNotice.vue';
import SteamAchievementList from './SteamAchievementList.vue';
import SteamAchievementsRefresh from './SteamAchievementsRefresh.vue';

const props = defineProps<{ game: Videogame }>();
const emit = defineEmits<{ refreshed: [] }>();

const messages = useMessages();
const api = useApi();
const locale = useLocale();
const open = ref(false);
const loading = ref(false);
const error = ref<unknown>(null);
const detail = ref<SteamAchievementsDetail | null>(null);

const text = computed(() => {
  const { achievementsUnlocked: unlocked, achievementsTotal: total } = props.game;
  if (total === null || unlocked === null) return messages.steam.achievements.unknown;
  if (total === 0) return messages.steam.achievements.none;
  const progress = messages.steam.achievements.progress(unlocked, total);
  const last = props.game.achievementsLastUnlockedAt;
  return last ? `${progress} (${messages.steam.achievements.lastUnlock(last)})` : progress;
});
const counts = computed(() => {
  const { achievementsUnlocked: unlocked, achievementsTotal: total } = props.game;
  return total !== null && unlocked !== null && total > 0 ? { unlocked, total } : null;
});
const canList = computed(() => props.game.achievementsTotal !== 0);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const answer = await api.steamAchievements(props.game.id, locale.language.value);
    detail.value = answer;
    const { achievementsUnlocked: unlocked, achievementsTotal: total } = props.game;
    if (
      answer.state !== 'unavailable' &&
      (answer.unlocked !== unlocked || answer.total !== total)
    ) {
      emit('refreshed');
    }
  } catch (cause) {
    error.value = cause;
  } finally {
    loading.value = false;
  }
}

async function toggle(): Promise<void> {
  open.value = !open.value;
  if (open.value && detail.value === null && !loading.value) await load();
}

async function refreshed(): Promise<void> {
  emit('refreshed');
  if (open.value) await load();
}
</script>

<template>
  <section class="achievements" data-test="achievements">
    <h2>{{ messages.steam.achievements.title }}</h2>
    <p data-test="achievements-text">{{ text }}</p>
    <progress
      v-if="counts"
      :value="counts.unlocked"
      :max="counts.total"
      :aria-label="messages.steam.achievements.title"
      data-test="achievements-bar"
    ></progress>
    <button
      v-if="canList"
      type="button"
      class="toggle"
      :aria-expanded="open"
      data-test="achievements-toggle"
      @click="toggle"
    >
      {{ open ? messages.steam.achievements.hide : messages.steam.achievements.show }}
    </button>
    <div v-if="open && canList" data-test="achievements-detail">
      <p v-if="loading" class="muted" data-test="achievements-loading">
        {{ messages.steam.achievements.loading }}
      </p>
      <ErrorNotice :error="error" />
      <p v-if="detail?.state === 'private'" class="muted" data-test="achievements-private">
        {{ messages.steam.achievements.private }}
      </p>
      <p
        v-else-if="detail?.state === 'unavailable'"
        class="muted"
        data-test="achievements-unavailable"
      >
        {{ messages.steam.achievements.unavailable }}
      </p>
      <SteamAchievementList
        v-else-if="detail?.state === 'ok'"
        :achievements="detail.achievements"
      />
    </div>
    <SteamAchievementsRefresh
      :game-id="game.id"
      :label="messages.steam.achievements.refresh"
      @done="refreshed"
    />
  </section>
</template>

<style scoped>
progress {
  display: block;
  width: 100%;
  max-width: 100%;
  height: 8px;
}

.toggle {
  margin: 8px 0;
}
</style>
