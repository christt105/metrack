<script setup lang="ts">
import { computed, ref } from 'vue';
import type { WatchlistEntry } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ entry: WatchlistEntry }>();
const emit = defineEmits<{ unfollowed: [] }>();

const api = useApi();
const busy = ref(false);
const error = ref<unknown>(null);
const to = computed(
  () => `/${props.entry.type === 'movie' ? 'movies' : 'series'}/${props.entry.id}`,
);

async function unfollow(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await api.unfollow(props.entry.type === 'movie' ? 'movies' : 'series', props.entry.id);
    emit('unfollowed');
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <li class="entry">
    <RouterLink :to="to" class="poster">
      <img v-if="entry.cover" :src="entry.cover" :alt="entry.title" loading="lazy" />
      <span v-else class="placeholder">{{ entry.title.slice(0, 1) }}</span>
    </RouterLink>
    <div class="body">
      <RouterLink :to="to" class="title">{{ entry.title }}</RouterLink>
      <span class="muted">
        {{ messages.typeLabels[entry.type] }} -
        {{
          entry.releaseDate
            ? messages.watchlist.releases(entry.releaseDate)
            : messages.watchlist.noDate
        }}
      </span>
      <ErrorNotice :error="error" />
    </div>
    <button type="button" class="small" :disabled="busy" @click="unfollow">
      {{ messages.watchlist.unfollow }}
    </button>
  </li>
</template>

<style scoped>
.entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--outline);
}

.poster {
  flex: none;
  width: 48px;
  aspect-ratio: 2 / 3;
  background: var(--surface-high);
  border-radius: var(--radius);
  overflow: hidden;
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--muted);
}

.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.title {
  font-weight: 700;
}
</style>
