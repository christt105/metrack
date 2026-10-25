<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { MEDIA_TYPE_OF_COLLECTION } from '@metrack/domain';
import type { Collection, Season, SeasonOverride, SeriesDetail } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import ArtworkPanel from '../components/ArtworkPanel.vue';
import EntityForm from '../components/EntityForm.vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import MetadataRefresh from '../components/MetadataRefresh.vue';
import RewatchList from '../components/RewatchList.vue';
import SeasonList from '../components/SeasonList.vue';
import SeasonOverrideEditor from '../components/SeasonOverrideEditor.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { isTracked } from '../logic/fieldSchemas';

const props = defineProps<{ collection: Collection; id: number }>();

const api = useApi();
const router = useRouter();
const detail = ref<AnyDetail | null>(null);
const error = ref<unknown>(null);
let ticket = 0;

const type = computed(() => MEDIA_TYPE_OF_COLLECTION[props.collection]);
const refreshable = computed(() => props.collection === 'movies' || props.collection === 'series');
const series = computed(() =>
  props.collection === 'series' ? (detail.value as SeriesDetail | null) : null,
);
const seasonOf = computed(() =>
  props.collection === 'seasons' ? (detail.value as unknown as Season | null) : null,
);
const trackedStatus = computed(() =>
  detail.value && isTracked(props.collection) && 'status' in detail.value
    ? detail.value.status
    : null,
);
const rewatches = computed(() =>
  detail.value && 'rewatches' in detail.value ? detail.value.rewatches : [],
);
const parentTitle = ref<string | null>(null);
const overrides = computed<SeasonOverride[]>(() => series.value?.overrides ?? []);

async function load(): Promise<void> {
  const mine = ++ticket;
  try {
    const result = (await api.getDetail(props.collection, props.id)) as AnyDetail;
    if (mine !== ticket) return;
    detail.value = result;
    error.value = null;
    parentTitle.value = null;
    if (props.collection === 'seasons') {
      const parent = await api
        .getDetail('series', (result as unknown as Season).seriesId)
        .catch(() => null);
      if (mine === ticket) parentTitle.value = parent?.title ?? null;
    }
  } catch (cause) {
    if (mine !== ticket) return;
    detail.value = null;
    error.value = cause;
  }
}

function onSaved(updated: AnyDetail): void {
  detail.value =
    props.collection === 'series' && series.value
      ? ({ ...series.value, ...updated } as AnyDetail)
      : updated;
}

async function remove(): Promise<void> {
  if (!window.confirm(messages.common.confirmDelete)) return;
  try {
    await api.remove(props.collection, props.id);
    await router.replace(seasonOf.value ? `/series/${seasonOf.value.seriesId}` : '/');
  } catch (cause) {
    error.value = cause;
  }
}

watch(() => [props.collection, props.id], load, { immediate: true });
</script>

<template>
  <section v-if="detail">
    <header class="head">
      <RouterLink v-if="seasonOf" :to="`/series/${seasonOf.seriesId}`" class="muted">
        {{ messages.detail.seasonOf }} {{ parentTitle ?? `#${seasonOf.seriesId}` }}
      </RouterLink>
      <h1>
        {{
          'title' in detail && detail.title
            ? detail.title
            : `${messages.typeLabels.season} ${seasonOf?.number ?? ''}`
        }}
      </h1>
      <div class="row">
        <span class="muted">{{ messages.collectionLabels[collection] }}</span>
        <StatusBadge v-if="trackedStatus" :status="trackedStatus" />
      </div>
      <MetadataRefresh
        v-if="refreshable"
        :id="detail.id"
        :type="type"
        :fetched-at="detail.fetchedAt"
        @refreshed="load"
      />
    </header>

    <EntityForm :collection="collection" :detail="detail" @saved="onSaved" @changed="load" />

    <SeasonList v-if="series" :series-id="series.id" :seasons="series.seasons" @changed="load" />
    <SeasonOverrideEditor
      v-if="series"
      :series-id="series.id"
      :overrides="overrides"
      @changed="load"
    />
    <RewatchList
      v-if="trackedStatus"
      :id="detail.id"
      :collection="collection"
      :rewatches="rewatches"
      :completed="trackedStatus === 'completed'"
      @updated="onSaved"
    />
    <ArtworkPanel
      :collection="collection"
      :detail="detail"
      @updated="
        (d) => {
          onSaved(d);
          load();
        }
      "
    />

    <button type="button" class="danger" @click="remove">{{ messages.detail.deleteItem }}</button>
  </section>
  <ErrorNotice :error="error" />
  <p v-if="!detail && !error" class="muted">{{ messages.common.loading }}</p>
</template>

<style scoped>
.head {
  margin-bottom: var(--gap);
}

.head h1 {
  margin-bottom: 6px;
}
</style>
