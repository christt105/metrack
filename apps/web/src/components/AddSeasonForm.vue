<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Season } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ seriesId: number; seasons: Season[] }>();
const emit = defineEmits<{ changed: [] }>();

const api = useApi();
const number = ref('');
const error = ref<unknown>(null);
const busy = ref(false);
const nextNumber = computed(() =>
  String(props.seasons.reduce((max, season) => Math.max(max, season.number), 0) + 1),
);

async function add(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await api.create('seasons', {
      seriesId: props.seriesId,
      number: Number(number.value || nextNumber.value),
    });
    number.value = '';
    emit('changed');
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <form class="row" @submit.prevent="add">
      <input
        v-model="number"
        type="number"
        min="0"
        step="1"
        class="number"
        :placeholder="nextNumber"
        :aria-label="messages.manage.seasonNumber"
      />
      <button type="submit" :disabled="busy">{{ messages.manage.addSeasonButton }}</button>
    </form>
    <ErrorNotice :error="error" />
  </div>
</template>

<style scoped>
.number {
  width: 110px;
}
</style>
