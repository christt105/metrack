<script setup lang="ts">
import { computed } from 'vue';
import type { UnmatchedEpisode } from '@metrack/domain';
import { messages } from '../i18n/messages';
import { groupUnmatched, tmdbSeriesUrl } from '../logic/groupUnmatched';

const props = defineProps<{
  unmatched: readonly UnmatchedEpisode[];
  tmdbId: number | null;
  knownSeasons: readonly number[];
  only?: number;
}>();

const groups = computed(() =>
  groupUnmatched(props.unmatched, props.tmdbId, props.knownSeasons, props.only),
);
const count = computed(() => groups.value.reduce((sum, group) => sum + group.episodes.length, 0));
</script>

<template>
  <aside v-if="count > 0" class="unmatched" role="status">
    <strong>{{ messages.unmatched.title(count) }}</strong>
    <p class="muted hint">{{ messages.unmatched.hint }}</p>
    <ul>
      <li v-for="group in groups" :key="group.season">
        <span class="season">{{ messages.unmatched.season(group.season) }}</span>
        <a
          v-if="group.href"
          :href="group.href"
          target="_blank"
          rel="noopener noreferrer"
          class="link"
          >{{ messages.unmatched.openSeason }}</a
        >
        <ul class="episodes">
          <li v-for="(episode, i) in group.episodes" :key="i">
            {{ messages.unmatched.episode(episode.number, episode.name) }}
            <template v-if="episode.code === 'episode_other_series' && episode.tmdbSeriesId">
              ·
              <a
                :href="tmdbSeriesUrl(episode.tmdbSeriesId)"
                target="_blank"
                rel="noopener noreferrer"
                >{{ messages.unmatched.otherSeries }} ({{ episode.tmdbSeriesId }})</a
              >
            </template>
          </li>
        </ul>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.unmatched {
  margin: 0 0 var(--s-5);
  padding: var(--s-3) var(--s-4);
  border-radius: var(--r-sm);
  border-left: 3px solid var(--warning);
  background: var(--surface-high);
  font-size: var(--t-small);
}

.hint {
  margin: 4px 0 var(--s-2);
}

ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.season {
  margin-right: var(--s-2);
  font-weight: 600;
}

.link {
  font-size: var(--t-small);
}

.episodes {
  margin: 2px 0 var(--s-2);
  padding-left: var(--s-3);
  color: var(--muted);
  overflow-wrap: anywhere;
}
</style>
