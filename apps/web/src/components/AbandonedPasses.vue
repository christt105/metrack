<script setup lang="ts">
import { computed } from 'vue';
import { abandonedPassCount } from '@metrack/domain';
import type { AbandonedPass, SeasonEpisodeItem } from '@metrack/domain';
import { useMessages } from '../composables/useMessages';

const messages = useMessages();
const props = defineProps<{
  passes: readonly AbandonedPass[];
  episodes: readonly SeasonEpisodeItem[];
}>();

const rows = computed(() =>
  props.passes
    .map((pass, index) => {
      const { watched, total } = abandonedPassCount(props.passes, index, props.episodes);
      const date = (value: string | null) =>
        value === null ? null : messages.episodes.airDate(value);
      return {
        key: pass.restartedOn,
        text: messages.episodes.abandonedPass(
          watched,
          total,
          date(pass.startedAt),
          date(pass.finishedAt ?? pass.restartedOn),
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
