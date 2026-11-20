<script setup lang="ts">
import { computed, ref } from 'vue';
import { sizedImageUrl, type WatchlistEntry } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
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
      <img
        v-if="entry.cover"
        :src="sizedImageUrl(entry.cover, 'thumb')"
        :alt="entry.title"
        loading="lazy"
      />
      <span v-else class="placeholder">{{ entry.title.slice(0, 1) }}</span>
    </RouterLink>
    <div class="body">
      <RouterLink :to="to" class="title">{{ entry.title }}</RouterLink>
      <span class="muted">
        {{ messages.typeLabels[entry.type] }} ·
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
  gap: var(--s-3);
  padding: var(--s-2);
  border: 1px solid var(--outline);
  border-radius: var(--r-md);
  background: var(--surface-low);
}

.poster {
  flex: none;
  width: 48px;
  aspect-ratio: 2 / 3;
  background: var(--surface-high);
  border-radius: var(--r-sm);
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
  font-size: var(--t-small);
}

.title {
  overflow: hidden;
  color: var(--on-surface);
  font-size: 15px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
