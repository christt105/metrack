<script setup lang="ts">
import { computed } from 'vue';
import type { AbandonedPass } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';

const messages = useMessages();
const props = defineProps<{ passes: readonly AbandonedPass[] }>();

const rows = computed(() =>
  props.passes
    .map((pass) => {
      const date = (value: string | null) =>
        value === null ? null : messages.episodes.airDate(value);
      return {
        key: pass.abandonedOn,
        text: messages.episodes.abandonedPass(
          pass.watched,
          pass.total,
          date(pass.startedAt),
          date(pass.finishedAt ?? pass.abandonedOn),
        ),
      };
    })
    .reverse(),
);
</script>

<template>
  <div v-if="rows.length > 0" class="abandoned">
    <h3>{{ messages.episodes.abandonedTitle }}</h3>
    <ul>
      <li v-for="row in rows" :key="row.key" class="muted">{{ row.text }}</li>
    </ul>
  </div>
</template>

<style scoped>
.abandoned {
  margin-top: var(--s-4);
}

h3 {
  margin: 0 0 var(--s-2);
  font-size: var(--t-small);
  font-weight: 600;
}

ul {
  padding: 0;
  margin: 0;
  list-style: none;
}

li {
  padding: var(--s-1) 0;
  font-size: var(--t-small);
}
</style>
