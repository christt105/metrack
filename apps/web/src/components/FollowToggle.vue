<script setup lang="ts">
import { ref } from 'vue';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import AppIcon from './AppIcon.vue';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ collection: 'movies' | 'series'; id: number; following: boolean }>();
const emit = defineEmits<{ changed: [following: boolean] }>();

const api = useApi();
const busy = ref(false);
const error = ref<unknown>(null);

async function toggle(): Promise<void> {
  const next = !props.following;
  busy.value = true;
  error.value = null;
  try {
    await (next
      ? api.follow(props.collection, props.id)
      : api.unfollow(props.collection, props.id));
    emit('changed', next);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="follow">
    <button
      type="button"
      :class="following ? '' : 'primary'"
      :aria-pressed="following"
      :disabled="busy"
      :title="following ? messages.watchlist.unfollow : undefined"
      @click="toggle"
    >
      <AppIcon :name="following ? 'check' : 'bell'" :size="18" />
      {{ following ? messages.watchlist.following : messages.watchlist.follow }}
    </button>
    <ErrorNotice :error="error" />
  </div>
</template>
