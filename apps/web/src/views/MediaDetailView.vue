<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MEDIA_TYPE_OF_COLLECTION } from '@metrack/domain';
import type { Collection, Season, SeriesDetail } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import AppIcon from '../components/AppIcon.vue';
import DetailHero from '../components/DetailHero.vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import FollowToggle from '../components/FollowToggle.vue';
import ManagePanel from '../components/ManagePanel.vue';
import QuickActions from '../components/QuickActions.vue';
import ReviewPanel from '../components/ReviewPanel.vue';
import SeasonList from '../components/SeasonList.vue';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { isTracked } from '../logic/fieldSchemas';

const props = defineProps<{ collection: Collection; id: number }>();

const api = useApi();
const detail = ref<AnyDetail | null>(null);
const error = ref<unknown>(null);
let ticket = 0;

const type = computed(() => MEDIA_TYPE_OF_COLLECTION[props.collection]);
const followCollection = computed(() =>
  props.collection === 'movies' || props.collection === 'series' ? props.collection : null,
);
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
const parentTitle = ref<string | null>(null);
const parentArtwork = ref<{ cover: string | null; banner: string | null } | null>(null);

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

const titleText = computed(() => {
  if (!detail.value) return '';
  if ('title' in detail.value && detail.value.title) return detail.value.title;
  return `${messages.typeLabels.season} ${seasonOf.value?.number ?? ''}`;
});
const eyebrow = computed(() => messages.typeLabels[type.value]);

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
        <QuickActions
          v-if="trackedStatus"
          :collection="collection"
          :detail="detail"
          @saved="onSaved"
        />
        <RouterLink :to="`/${collection}/${detail.id}/edit`" class="button">
          <AppIcon name="edit" :size="18" />
          {{ messages.hero.edit }}
        </RouterLink>
      </template>
      <template v-if="trackedStatus" #review>
        <ReviewPanel :collection="collection" :detail="detail" @saved="onSaved" />
      </template>
    </DetailHero>

    <SeasonList v-if="series" :seasons="series.seasons" :series-cover="series.cover" />

    <ManagePanel
      :collection="collection"
      :detail="detail"
      :title="titleText"
      :fallback="parentArtwork"
      @load="load"
      @saved="onSaved"
    />
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
</style>
