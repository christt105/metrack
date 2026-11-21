<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { FillerCategory, FillerPreviewResponse } from '@metrack/domain';
import { ApiRequestError } from '../api/ApiRequestError';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import {
  SKIPPABLE_CATEGORIES,
  categoryState,
  defaultSelection,
  episodesOfCategory,
  fillerId,
  isSkippable,
  setCategory,
  skipGroups,
} from '../logic/fillerSelection';
import type { FillerSkipGroup } from '../logic/FillerSkipGroup';
import ErrorNotice from './ErrorNotice.vue';
import UndoToast from './UndoToast.vue';

const TOAST_MS = 7000;
const messages = useMessages();
const props = defineProps<{ seriesId: number }>();
const emit = defineEmits<{ changed: [] }>();

const api = useApi();
const opened = ref(false);
const loading = ref(false);
const busy = ref(false);
const preview = ref<FillerPreviewResponse | null>(null);
const selection = ref<Set<string>>(new Set());
const problem = ref<string | null>(null);
const notFound = ref(false);
const error = ref<unknown>(null);
const slugInput = ref('');
const toast = ref<{ message: string; undo: FillerSkipGroup[] } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

const episodes = computed(() => preview.value?.episodes ?? []);
const offered = computed(() =>
  SKIPPABLE_CATEGORIES.map((category) => ({
    category,
    episodes: episodesOfCategory(episodes.value, category),
    skippable: episodesOfCategory(episodes.value, category).filter(isSkippable),
    state: categoryState(selection.value, episodes.value, category),
  })),
);
const canonCount = computed(
  () => (preview.value?.counts.mangaCanon ?? 0) + (preview.value?.counts.animeCanon ?? 0),
);
const chosen = computed(() => skipGroups(selection.value, episodes.value));
const chosenCount = computed(() => chosen.value.reduce((sum, group) => sum + group.keys.length, 0));
const anySkippable = computed(() => offered.value.some((group) => group.skippable.length > 0));

function describe(cause: unknown): void {
  notFound.value = false;
  problem.value = null;
  error.value = null;
  if (cause instanceof ApiRequestError) {
    const details = (cause.details ?? {}) as {
      ours?: number;
      theirs?: number;
      seasonNumber?: number;
    };
    if (cause.code === 'filler_not_found') {
      notFound.value = true;
      return;
    }
    if (cause.code === 'invalid_filler_slug') {
      notFound.value = true;
      problem.value = messages.filler.invalidSlug;
      return;
    }
    if (cause.code === 'filler_count_mismatch') {
      problem.value = messages.filler.mismatch(details.ours ?? 0, details.theirs ?? 0);
      return;
    }
    if (cause.code === 'filler_catalog_incomplete') {
      problem.value = messages.filler.incomplete(details.seasonNumber ?? 0);
      return;
    }
    if (cause.code === 'filler_list_invalid') {
      problem.value = messages.filler.invalidList;
      return;
    }
    if (cause.code === 'filler_source_unavailable') {
      problem.value = messages.filler.unavailable;
      return;
    }
  }
  error.value = cause;
}

async function load(slug?: string): Promise<void> {
  loading.value = true;
  preview.value = null;
  try {
    const loaded = await api.fillerPreview(props.seriesId, slug);
    preview.value = loaded;
    selection.value = defaultSelection(loaded.episodes);
    notFound.value = false;
    problem.value = null;
    error.value = null;
  } catch (cause) {
    describe(cause);
  } finally {
    loading.value = false;
  }
}

async function open(): Promise<void> {
  opened.value = true;
  await load();
}

function close(): void {
  opened.value = false;
  preview.value = null;
  notFound.value = false;
  problem.value = null;
  error.value = null;
}

function toggleEpisode(id: string, on: boolean): void {
  const next = new Set(selection.value);
  if (on) next.add(id);
  else next.delete(id);
  selection.value = next;
}

function toggleCategory(category: FillerCategory, on: boolean): void {
  selection.value = setCategory(selection.value, episodes.value, category, on);
}

function say(message: string, undo: FillerSkipGroup[]): void {
  clearTimeout(timer);
  toast.value = { message, undo };
  timer = setTimeout(dismiss, TOAST_MS);
}

function dismiss(): void {
  clearTimeout(timer);
  toast.value = null;
}

async function apply(): Promise<void> {
  const groups = chosen.value;
  if (busy.value || groups.length === 0) return;
  busy.value = true;
  error.value = null;
  const done: FillerSkipGroup[] = [];
  try {
    for (const group of groups) {
      await api.updateSeasonEpisodes(group.seasonId, { op: 'skip', keys: group.keys });
      done.push(group);
    }
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
  if (done.length === 0) return;
  const count = done.reduce((sum, group) => sum + group.keys.length, 0);
  close();
  emit('changed');
  say(messages.filler.applied(count), done);
}

async function undo(): Promise<void> {
  const groups = toast.value?.undo ?? [];
  dismiss();
  if (busy.value || groups.length === 0) return;
  busy.value = true;
  error.value = null;
  try {
    for (const group of groups) {
      await api.updateSeasonEpisodes(group.seasonId, { op: 'unskip', keys: group.keys });
    }
    say(messages.filler.undone, []);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
    emit('changed');
  }
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <section class="panel filler" data-test="filler">
    <div class="head">
      <h2>{{ messages.filler.title }}</h2>
      <button v-if="!opened" type="button" data-test="filler-open" @click="open">
        {{ messages.filler.action }}
      </button>
      <button v-else type="button" class="ghost" data-test="filler-close" @click="close">
        {{ messages.filler.close }}
      </button>
    </div>
    <template v-if="opened">
      <p class="muted">{{ messages.filler.intro }}</p>
      <p v-if="loading" class="muted">{{ messages.filler.loading }}</p>
      <p v-if="problem" class="notice error" role="alert" data-test="filler-problem">
        {{ problem }}
      </p>
      <form
        v-if="notFound"
        class="lookup"
        data-test="filler-lookup"
        @submit.prevent="load(slugInput.trim())"
      >
        <strong>{{ messages.filler.notFoundTitle }}</strong>
        <p class="muted">{{ messages.filler.notFoundHint }}</p>
        <label>
          <span class="muted">{{ messages.filler.slugLabel }}</span>
          <input v-model="slugInput" type="text" data-test="filler-slug" />
        </label>
        <button type="submit" :disabled="loading || slugInput.trim() === ''">
          {{ messages.filler.retry }}
        </button>
      </form>
      <ErrorNotice :error="error" />
      <template v-if="preview">
        <p class="muted">
          {{ messages.filler.source }}:
          <a :href="preview.sourceUrl" target="_blank" rel="noopener noreferrer">{{
            preview.sourceUrl
          }}</a>
        </p>
        <ul class="counts" data-test="filler-counts">
          <li v-for="category in SKIPPABLE_CATEGORIES" :key="category">
            {{ messages.filler.counts[category] }}: {{ preview.counts[category] }}
          </li>
          <li>{{ messages.filler.counts.mangaCanon }}: {{ preview.counts.mangaCanon }}</li>
          <li>{{ messages.filler.counts.animeCanon }}: {{ preview.counts.animeCanon }}</li>
        </ul>
        <p class="muted">{{ messages.filler.keptNote(canonCount) }}</p>
        <p v-if="!anySkippable" data-test="filler-nothing">{{ messages.filler.nothing }}</p>
        <div v-for="group in offered" :key="group.category" class="category">
          <label v-if="group.skippable.length > 0" class="all">
            <input
              type="checkbox"
              :data-test="`filler-all-${group.category}`"
              :checked="group.state === 'all'"
              :indeterminate="group.state === 'some'"
              @change="toggleCategory(group.category, ($event.target as HTMLInputElement).checked)"
            />
            {{
              messages.filler.selectAll(
                messages.filler.counts[group.category],
                group.skippable.filter((e) => selection.has(fillerId(e))).length,
                group.skippable.length,
              )
            }}
          </label>
          <ul v-if="group.episodes.length > 0" class="list">
            <li v-for="episode in group.episodes" :key="fillerId(episode)">
              <label>
                <input
                  type="checkbox"
                  :data-test="`filler-episode-${episode.absoluteNumber}`"
                  :disabled="!isSkippable(episode)"
                  :checked="selection.has(fillerId(episode))"
                  @change="
                    toggleEpisode(fillerId(episode), ($event.target as HTMLInputElement).checked)
                  "
                />
                {{
                  messages.filler.episode(
                    episode.absoluteNumber,
                    episode.seasonNumber,
                    episode.number,
                    episode.title,
                  )
                }}
              </label>
              <span v-if="episode.watched" class="tag muted">{{ messages.filler.watchedTag }}</span>
              <span v-else-if="episode.skipped" class="tag muted">{{
                messages.filler.skippedTag
              }}</span>
            </li>
          </ul>
        </div>
        <button
          type="button"
          class="primary"
          data-test="filler-confirm"
          :disabled="busy || chosenCount === 0"
          @click="apply"
        >
          {{ messages.filler.confirm(chosenCount) }}
        </button>
      </template>
    </template>
    <ErrorNotice v-if="!opened" :error="error" />
    <Teleport to="body">
      <UndoToast
        v-if="toast"
        :message="toast.message"
        :undoable="toast.undo.length > 0"
        @undo="undo"
        @dismiss="dismiss"
      />
    </Teleport>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
}

.counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-1) var(--s-4);
  padding: 0;
  list-style: none;
}

.category {
  margin-bottom: var(--s-3);
}

.all {
  display: block;
  margin-bottom: var(--s-1);
  font-weight: 600;
}

.list {
  max-height: 280px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.tag {
  margin-left: var(--s-2);
  font-size: var(--t-small);
}

.lookup {
  display: grid;
  gap: var(--s-2);
  margin-bottom: var(--s-3);
}
</style>
