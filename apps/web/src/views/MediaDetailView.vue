<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MEDIA_TYPE_OF_COLLECTION, isAnimatedGenres } from '@metrack/domain';
import type {
  Collection,
  Season,
  SeasonEpisodesResponse,
  SeasonEpisodesUpdateResponse,
  SeriesDetail,
  UnmatchedEpisode,
  Videogame,
} from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import AppIcon from '../components/AppIcon.vue';
import DetailHero from '../components/DetailHero.vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import FollowToggle from '../components/FollowToggle.vue';
import ManagePanel from '../components/ManagePanel.vue';
import QuickActions from '../components/QuickActions.vue';
import ReviewPanel from '../components/ReviewPanel.vue';
import SeasonEpisodes from '../components/SeasonEpisodes.vue';
import SteamAchievements from '../components/SteamAchievements.vue';
import SkipFiller from '../components/SkipFiller.vue';
import SeasonList from '../components/SeasonList.vue';
import UnmatchedEpisodes from '../components/UnmatchedEpisodes.vue';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import { isTracked } from '../logic/fieldSchemas';
import { seasonWatched } from '../logic/seasonWatched';
import { withTracking } from '../logic/withTracking';

const messages = useMessages();
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
const animated = computed(() => series.value !== null && isAnimatedGenres(series.value.genres));
const steamGame = computed(() =>
  props.collection === 'games' && detail.value && (detail.value as Videogame).steamAppId
    ? (detail.value as Videogame)
    : null,
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
const parentTmdbId = ref<number | null>(null);
const seasonUnmatched = ref<UnmatchedEpisode[]>([]);

const unmatchedSource = computed(() => {
  if (series.value) {
    return {
      unmatched: series.value.unmatched ?? [],
      tmdbId: series.value.tmdbId,
      known: series.value.seasons.map((s) => s.tmdbSeasonNumber ?? s.number),
      only: undefined,
    };
  }
  if (!seasonOf.value) return null;
  const number = seasonOf.value.tmdbSeasonNumber ?? seasonOf.value.number;
  return {
    unmatched: seasonUnmatched.value,
    tmdbId: parentTmdbId.value,
    known: [number],
    only: number,
  };
});

async function load(): Promise<void> {
  const mine = ++ticket;
  try {
    const result = (await api.getDetail(props.collection, props.id)) as AnyDetail;
    if (mine !== ticket) return;
    detail.value = result;
    error.value = null;
    parentTitle.value = null;
    parentArtwork.value = null;
    parentTmdbId.value = null;
    seasonUnmatched.value = [];
    if (props.collection === 'seasons') {
      const parent = await api
        .getDetail('series', (result as unknown as Season).seriesId)
        .catch(() => null);
      if (mine === ticket) {
        parentTitle.value = parent?.title ?? null;
        parentArtwork.value = parent ? { cover: parent.cover, banner: parent.banner } : null;
        parentTmdbId.value = parent?.tmdbId ?? null;
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

function onEpisodes(update: SeasonEpisodesUpdateResponse): void {
  if (seasonOf.value) detail.value = withTracking(seasonOf.value, update) as unknown as AnyDetail;
}

const hasCatalog = ref(false);

function onEpisodesLoaded(data: SeasonEpisodesResponse): void {
  hasCatalog.value = data.source !== 'numbers';
  seasonUnmatched.value = data.unmatched ?? [];
}

const watchedEpisodes = computed(() => (seasonOf.value ? seasonWatched(seasonOf.value) : null));

const titleText = computed(() => {
  if (!detail.value) return '';
  if ('title' in detail.value && detail.value.title) return detail.value.title;
  return `${messages.typeLabels.season} ${seasonOf.value?.number ?? ''}`;
});
const eyebrow = computed(() => messages.typeLabels[type.value]);

watch(
  () => [props.collection, props.id],
  () => {
    hasCatalog.value = false;
  },
);
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
      :watched="watchedEpisodes"
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
          :episode-mode="hasCatalog"
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

    <SteamAchievements v-if="steamGame" :game="steamGame" @refreshed="load" />

    <UnmatchedEpisodes
      v-if="unmatchedSource"
      :unmatched="unmatchedSource.unmatched"
      :tmdb-id="unmatchedSource.tmdbId"
      :known-seasons="unmatchedSource.known"
      :only="unmatchedSource.only"
    />

    <SeasonList v-if="series" :seasons="series.seasons" :series-cover="series.cover" />

    <SkipFiller v-if="series && animated" :series-id="series.id" @changed="load" />

    <SeasonEpisodes
      v-if="seasonOf"
      :season-id="seasonOf.id"
      :series-id="seasonOf.seriesId"
      :status="seasonOf.status"
      :rewatches="seasonOf.rewatches"
      :wants-rewatch="seasonOf.wantsRewatch"
      @updated="onEpisodes"
      @loaded="onEpisodesLoaded"
    />

    <ManagePanel
      :collection="collection"
      :detail="detail"
      :title="titleText"
      :fallback="parentArtwork"
      :rewatches-locked="hasCatalog"
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
