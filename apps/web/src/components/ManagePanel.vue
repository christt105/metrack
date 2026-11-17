<script setup lang="ts">
import { computed } from 'vue';
import { MEDIA_TYPE_OF_COLLECTION } from '@metrack/domain';
import type { Collection, Season, SeasonOverride, SeriesDetail } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { messages } from '../i18n/messages';
import { isTracked } from '../logic/fieldSchemas';
import AddSeasonForm from './AddSeasonForm.vue';
import ArtworkPanel from './ArtworkPanel.vue';
import DeleteEntry from './DeleteEntry.vue';
import ManageDisclosure from './ManageDisclosure.vue';
import ManageGroup from './ManageGroup.vue';
import MetadataRefresh from './MetadataRefresh.vue';
import RewatchList from './RewatchList.vue';
import SeasonOrderingPanel from './SeasonOrderingPanel.vue';
import SeasonOverrideEditor from './SeasonOverrideEditor.vue';

const props = defineProps<{
  collection: Collection;
  detail: AnyDetail;
  title: string;
  fallback: { cover: string | null; banner: string | null } | null;
}>();
const emit = defineEmits<{ load: []; saved: [detail: AnyDetail] }>();

const type = computed(() => MEDIA_TYPE_OF_COLLECTION[props.collection]);
const refreshable = computed(() => props.collection === 'movies' || props.collection === 'series');
const series = computed(() =>
  props.collection === 'series' ? (props.detail as SeriesDetail) : null,
);
const seasonOf = computed(() =>
  props.collection === 'seasons' ? (props.detail as unknown as Season) : null,
);
const trackedStatus = computed(() =>
  isTracked(props.collection) && 'status' in props.detail ? props.detail.status : null,
);
const rewatches = computed(() => ('rewatches' in props.detail ? props.detail.rewatches : []));
const hasUnlinkedSeasons = computed(() =>
  (series.value?.seasons ?? []).some((s) => s.number >= 1 && s.tmdbSeasonNumber === null),
);
const overrides = computed<SeasonOverride[]>(() => series.value?.overrides ?? []);
const redirectTo = computed(() => (seasonOf.value ? `/series/${seasonOf.value.seriesId}` : '/'));

function onArtwork(updated: AnyDetail): void {
  emit('saved', updated);
  emit('load');
}
</script>

<template>
  <section class="manage" aria-labelledby="manage-title">
    <h2 id="manage-title">{{ messages.manage.title }}</h2>
    <p class="muted intro">{{ messages.manage.intro }}</p>
    <div class="groups">
      <ManageGroup v-if="trackedStatus" :title="messages.manage.rewatches">
        <RewatchList
          :id="detail.id"
          :collection="collection"
          :rewatches="rewatches"
          :completed="trackedStatus === 'completed'"
          @updated="emit('saved', $event)"
        />
      </ManageGroup>
      <ManageDisclosure :title="messages.manage.images" :hint="messages.manage.imagesHint">
        <ArtworkPanel
          :collection="collection"
          :detail="detail"
          :fallback="fallback"
          @updated="onArtwork"
        />
      </ManageDisclosure>
      <ManageGroup v-if="series" :title="messages.manage.addSeason">
        <AddSeasonForm :series-id="series.id" :seasons="series.seasons" @changed="emit('load')" />
      </ManageGroup>
      <SeasonOrderingPanel
        v-if="series && series.tmdbId !== null"
        :series-id="series.id"
        :has-unlinked-seasons="hasUnlinkedSeasons"
        @changed="emit('load')"
      />
      <ManageDisclosure
        v-if="series"
        :title="messages.manage.seasonSettings"
        :hint="messages.manage.seasonSettingsHint"
      >
        <SeasonOverrideEditor
          :series-id="series.id"
          :overrides="overrides"
          @changed="emit('load')"
        />
      </ManageDisclosure>
      <ManageGroup v-if="refreshable" :title="messages.manage.metadata">
        <MetadataRefresh
          :id="detail.id"
          :type="type"
          :fetched-at="detail.fetchedAt"
          @refreshed="emit('load')"
        />
      </ManageGroup>
      <ManageGroup class="danger-zone" :title="messages.manage.dangerZone">
        <DeleteEntry
          :id="detail.id"
          :collection="collection"
          :title="title"
          :redirect-to="redirectTo"
        />
      </ManageGroup>
    </div>
  </section>
</template>

<style scoped>
.manage {
  margin-top: var(--s-7);
}

.intro {
  margin: 0 0 var(--s-4);
}

.groups {
  display: grid;
  gap: var(--s-3);
}

.groups :deep(.panel) {
  margin-bottom: 0;
}

.danger-zone {
  margin-top: var(--s-4);
  border-color: var(--danger);
}
</style>
