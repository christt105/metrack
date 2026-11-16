<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { MEDIA_TYPE_OF_COLLECTION } from '@metrack/domain';
import type { Collection, Season, SeasonOverride, SeriesDetail } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import AppIcon from '../components/AppIcon.vue';
import ArtworkPanel from '../components/ArtworkPanel.vue';
import EntityForm from '../components/EntityForm.vue';
import DetailHero from '../components/DetailHero.vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import FollowToggle from '../components/FollowToggle.vue';
import MetadataRefresh from '../components/MetadataRefresh.vue';
import RewatchList from '../components/RewatchList.vue';
import SeasonList from '../components/SeasonList.vue';
import SeasonOrderingPanel from '../components/SeasonOrderingPanel.vue';
import SeasonOverrideEditor from '../components/SeasonOverrideEditor.vue';
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
const followCollection = computed(() =>
  props.collection === 'movies' || props.collection === 'series' ? props.collection : null,
);
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
const parentArtwork = ref<{ cover: string | null; banner: string | null } | null>(null);
const hasUnlinkedSeasons = computed(() =>
  (series.value?.seasons ?? []).some((s) => s.number >= 1 && s.tmdbSeasonNumber === null),
);
const overrides = computed<SeasonOverride[]>(() => series.value?.overrides ?? []);

async function load(): Promise<void> {
  const mine = ++ticket;
  try {
    const result = (await api.getDetail(props.collection, props.id)) as AnyDetail;
    if (mine !== ticket) return;
    detail.value = result;
    error.value = null;
    parentTitle.value = null;
    parentArtwork.value = null;
    if (props.collection === 'seasons') {
      const parent = await api
        .getDetail('series', (result as unknown as Season).seriesId)
        .catch(() => null);
      if (mine === ticket) {
        parentTitle.value = parent?.title ?? null;
        parentArtwork.value = parent ? { cover: parent.cover, banner: parent.banner } : null;
      }
    }
  } catch (cause) {
    if (mine !== ticket) return;
    detail.value = null;
    error.value = cause;
  }
}

function setFollowing(value: boolean): void {
  if (detail.value && 'follow' in detail.value) detail.value.follow = value;
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

const titleText = computed(() => {
  if (!detail.value) return '';
  if ('title' in detail.value && detail.value.title) return detail.value.title;
  return `${messages.typeLabels.season} ${seasonOf.value?.number ?? ''}`;
});
const eyebrow = computed(() => messages.typeLabels[type.value]);

function scrollToEdit(): void {
  document.getElementById('edit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

watch(() => [props.collection, props.id], load, { immediate: true });
</script>

<template>
  <article v-if="detail" class="detail">
    <DetailHero
      :detail="detail"
      :title="titleText"
      :eyebrow="eyebrow"
      :status="trackedStatus"
      :fallback="parentArtwork"
    >
      <template #before-title>
        <RouterLink v-if="seasonOf" :to="`/series/${seasonOf.seriesId}`" class="back">
          <AppIcon name="back" :size="18" />
          {{ parentTitle ?? `${messages.detail.seasonOf} #${seasonOf.seriesId}` }}
        </RouterLink>
      </template>
      <template #actions>
        <FollowToggle
          v-if="followCollection && 'follow' in detail"
          :id="detail.id"
          :collection="followCollection"
          :following="detail.follow"
          @changed="setFollowing"
        />
        <button type="button" @click="scrollToEdit">
          <AppIcon name="edit" :size="18" />
          {{ messages.hero.edit }}
        </button>
      </template>
    </DetailHero>

    <SeasonList
      v-if="series"
      :series-id="series.id"
      :seasons="series.seasons"
      :series-cover="series.cover"
      @changed="load"
    />

    <section id="edit" class="section" aria-labelledby="edit-title">
      <h2 id="edit-title">{{ messages.hero.edit }}</h2>
      <EntityForm :collection="collection" :detail="detail" @saved="onSaved" @changed="load" />
      <RewatchList
        v-if="trackedStatus"
        :id="detail.id"
        :collection="collection"
        :rewatches="rewatches"
        :completed="trackedStatus === 'completed'"
        @updated="onSaved"
      />
    </section>

    <details class="panel advanced">
      <summary>{{ messages.hero.advanced }}</summary>
      <div class="advanced__body">
        <MetadataRefresh
          v-if="refreshable"
          :id="detail.id"
          :type="type"
          :fetched-at="detail.fetchedAt"
          @refreshed="load"
        />
        <SeasonOrderingPanel
          v-if="series && series.tmdbId !== null"
          :series-id="series.id"
          :has-unlinked-seasons="hasUnlinkedSeasons"
          @changed="load"
        />
        <SeasonOverrideEditor
          v-if="series"
          :series-id="series.id"
          :overrides="overrides"
          @changed="load"
        />
        <ArtworkPanel
          :collection="collection"
          :detail="detail"
          :fallback="parentArtwork"
          @updated="
            (d) => {
              onSaved(d);
              load();
            }
          "
        />
        <div>
          <button type="button" class="danger" @click="remove">
            <AppIcon name="trash" :size="18" />
            {{ messages.detail.deleteItem }}
          </button>
        </div>
      </div>
    </details>
  </article>
  <ErrorNotice :error="error" />
  <p v-if="!detail && !error" class="muted">{{ messages.common.loading }}</p>
</template>

<style scoped>
.detail {
  max-width: 1120px;
  margin: 0 auto;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: var(--s-1);
  color: var(--muted);
  font-size: var(--t-small);
  font-weight: 500;
}

.back:hover {
  color: var(--on-surface);
  text-decoration: none;
}

.section {
  scroll-margin-top: calc(var(--nav) + var(--s-4));
  margin-bottom: var(--s-6);
}

.advanced > summary {
  font-weight: 500;
}

.advanced[open] > summary {
  margin-bottom: var(--s-4);
}

.advanced__body {
  display: grid;
  gap: var(--s-4);
}

.advanced__body :deep(.panel) {
  margin-bottom: 0;
  background: var(--bg);
}
</style>
