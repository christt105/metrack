<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import type { Collection, MediaStatus, Season } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { sessionKey } from '../auth/sessionKey';
import AppIcon from '../components/AppIcon.vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import FieldInput from '../components/FieldInput.vue';
import FieldRow from '../components/FieldRow.vue';
import { useApi } from '../composables/useApi';
import { fieldLabel, messages } from '../i18n/messages';
import { countFormChanges } from '../logic/countFormChanges';
import type { FieldSchema, FieldSection } from '../logic/FieldSchema';
import { fieldSchemas, isTracked } from '../logic/fieldSchemas';
import { buildPatch, DraftError, toDraft } from '../logic/formDraft';
import type { Draft } from '../logic/formDraft';
import { openableLink } from '../logic/openableLink';
import { saveForAll } from '../logic/saveForAll';
import { statusOptions } from '../logic/statusOptions';

const props = defineProps<{ collection: Collection; id: number }>();

const api = useApi();
const session = inject(sessionKey, null);
const router = useRouter();
const detail = ref<AnyDetail | null>(null);
const draft = ref<Draft>({});
const status = ref<MediaStatus>('planned');
const pendingReview = ref(false);
const releases = ref<string[]>([]);
const saving = ref(false);
const error = ref<unknown>(null);
const invalid = ref<{ key: string; reason: string } | null>(null);
const leaving = ref(false);
const datesDerived = ref(false);
let ticket = 0;

const schemas = computed(() => fieldSchemas[props.collection]);
const tracked = computed(() => isTracked(props.collection));
const detailPath = computed(() => `/${props.collection}/${props.id}`);
const currentStatus = computed<MediaStatus>(() =>
  detail.value && 'status' in detail.value ? detail.value.status : 'planned',
);
const options = computed(() => statusOptions(currentStatus.value));
const changes = computed(() =>
  detail.value
    ? countFormChanges({
        schemas: schemas.value,
        entity: detail.value,
        draft: draft.value,
        status: status.value,
        pendingReview: pendingReview.value,
        releases: releases.value,
      })
    : 0,
);
const dirty = computed(() => changes.value > 0);
const summary = computed(() =>
  changes.value === 0 ? messages.edit.noChanges : messages.edit.changes(changes.value),
);
const titleText = computed(() => {
  const current = detail.value;
  if (!current) return '';
  if ('title' in current && current.title) return current.title;
  return `${messages.typeLabels.season} ${(current as unknown as Season).number ?? ''}`;
});

const sections: FieldSection[] = ['tracking', 'notes', 'metadata', 'ids'];
const sectionTitles: Record<FieldSection, string> = {
  tracking: messages.edit.sectionTracking,
  notes: messages.edit.sectionNotes,
  metadata: messages.edit.sectionMetadata,
  ids: messages.edit.sectionIds,
};

function fieldsOf(section: FieldSection): FieldSchema[] {
  return schemas.value.filter((schema) => schema.section === section);
}

function showSection(section: FieldSection): boolean {
  return fieldsOf(section).length > 0 || (section === 'tracking' && tracked.value);
}

function fieldId(key: string): string {
  return `field-${key}`;
}

const DERIVED_KEYS = ['startedAt', 'finishedAt'];

function isDerived(key: string): boolean {
  return datesDerived.value && DERIVED_KEYS.includes(key);
}

function isEdited(key: string): boolean {
  return detail.value?.editedFields.includes(key) ?? false;
}

function toggleRelease(key: string): void {
  releases.value = releases.value.includes(key)
    ? releases.value.filter((k) => k !== key)
    : [...releases.value, key];
}

function reset(current: AnyDetail): void {
  draft.value = toDraft(schemas.value, current);
  status.value = 'status' in current ? current.status : 'planned';
  pendingReview.value = 'pendingReview' in current && current.pendingReview === true;
  releases.value = [];
}

async function load(): Promise<void> {
  const mine = ++ticket;
  try {
    const result = (await api.getDetail(props.collection, props.id)) as AnyDetail;
    if (mine !== ticket) return;
    detail.value = result;
    error.value = null;
    datesDerived.value = false;
    reset(result);
    if (props.collection === 'seasons') {
      const episodes = await api.seasonEpisodes(props.id).catch(() => null);
      if (mine === ticket) datesDerived.value = episodes?.datesDerived === true;
    }
  } catch (cause) {
    if (mine !== ticket) return;
    detail.value = null;
    error.value = cause;
  }
}

async function leave(): Promise<void> {
  leaving.value = true;
  if (router.options.history.state.back === detailPath.value) router.back();
  else await router.replace(detailPath.value);
}

async function cancel(): Promise<void> {
  if (dirty.value && !window.confirm(messages.edit.leaveConfirm)) return;
  await leave();
}

async function save(): Promise<void> {
  const current = detail.value;
  if (!current || !dirty.value || saving.value) return;
  error.value = null;
  invalid.value = null;
  let patch: Record<string, unknown>;
  try {
    patch = buildPatch(schemas.value, current, draft.value);
  } catch (cause) {
    if (cause instanceof DraftError) invalid.value = { key: cause.key, reason: cause.message };
    else error.value = cause;
    return;
  }
  if (tracked.value && status.value !== currentStatus.value) patch.status = status.value;
  if ('pendingReview' in current && pendingReview.value !== current.pendingReview)
    patch.pendingReview = pendingReview.value;
  saving.value = true;
  let patched = false;
  try {
    if (Object.keys(patch).length > 0) {
      await saveForAll(
        (options) => api.patch(props.collection, props.id, patch as never, options),
        session?.user.value?.role === 'owner',
        () => window.confirm(messages.detail.confirmForAll),
      );
      patched = true;
    }
    for (const key of releases.value) await api.unmarkEdited(props.collection, props.id, key);
    await leave();
  } catch (cause) {
    leaving.value = false;
    if (patched) await load();
    error.value = cause;
  } finally {
    saving.value = false;
  }
}

function warnBeforeUnload(event: BeforeUnloadEvent): void {
  if (!dirty.value || leaving.value) return;
  event.preventDefault();
  event.returnValue = '';
}

onBeforeRouteLeave(() => {
  if (!dirty.value || leaving.value) return true;
  return window.confirm(messages.edit.leaveConfirm);
});

onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload));
watch(() => [props.collection, props.id], load, { immediate: true });
</script>

<template>
  <div v-if="detail" class="edit">
    <header class="head">
      <RouterLink :to="detailPath" class="back" @click.prevent="cancel">
        <AppIcon name="back" :size="18" />
        {{ messages.edit.back }}
      </RouterLink>
      <h1>{{ messages.edit.title(titleText) }}</h1>
    </header>
    <form id="edit-form" class="form" @submit.prevent="save">
      <template v-for="section in sections" :key="section">
        <fieldset v-if="showSection(section)" class="panel" :data-section="section">
          <legend>{{ sectionTitles[section] }}</legend>
          <div class="grid">
            <FieldRow
              v-if="section === 'tracking' && tracked"
              :id="fieldId('status')"
              :label="fieldLabel('status')"
            >
              <select :id="fieldId('status')" v-model="status">
                <option v-for="option in options" :key="option" :value="option">
                  {{ messages.statusLabels[option] }}
                </option>
              </select>
            </FieldRow>
            <FieldRow
              v-for="schema in fieldsOf(section)"
              :id="fieldId(schema.key)"
              :key="schema.key"
              :label="fieldLabel(schema.key)"
              :edited="isEdited(schema.key)"
              :released="releases.includes(schema.key)"
              :hint="
                isDerived(schema.key) && schema.key === 'finishedAt'
                  ? messages.edit.datesDerived
                  : schema.kind === 'list'
                    ? messages.detail.listHint
                    : undefined
              "
              :invalid="invalid?.key === schema.key ? invalid.reason : undefined"
              :class="{ wide: schema.kind === 'textarea' || schema.kind === 'list' }"
              @release="toggleRelease(schema.key)"
            >
              <FieldInput
                :id="fieldId(schema.key)"
                :kind="schema.kind"
                :required="schema.required"
                :disabled="isDerived(schema.key)"
                :model-value="draft[schema.key] ?? ''"
                @update:model-value="draft[schema.key] = $event"
              />
              <a
                v-if="schema.kind === 'link' && openableLink(draft[schema.key])"
                class="open-link"
                :href="openableLink(draft[schema.key]) ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ messages.detail.openLink }}
              </a>
            </FieldRow>
            <div v-if="section === 'tracking' && tracked" class="wide pending">
              <label class="check" :for="fieldId('pendingReview')">
                <input :id="fieldId('pendingReview')" v-model="pendingReview" type="checkbox" />
                {{ messages.edit.pendingLabel }}
              </label>
              <small class="muted">{{ messages.edit.pendingHelp }}</small>
            </div>
          </div>
        </fieldset>
      </template>
      <ErrorNotice :error="error" />
    </form>
    <div class="bar" role="region" :aria-label="messages.edit.barLabel">
      <div class="bar__inner">
        <span class="bar__count" role="status" :class="{ active: dirty }">{{ summary }}</span>
        <button type="button" :disabled="saving" @click="cancel">
          {{ messages.common.cancel }}
        </button>
        <button type="submit" form="edit-form" class="primary" :disabled="!dirty || saving">
          {{ saving ? messages.common.saving : messages.common.save }}
        </button>
      </div>
    </div>
  </div>
  <ErrorNotice v-else :error="error" />
  <p v-if="!detail && !error" class="muted">{{ messages.common.loading }}</p>
</template>

<style scoped>
.edit {
  max-width: 1120px;
  margin: 0 auto;
  padding-bottom: calc(88px + var(--safe-bottom));
}

.head {
  margin-bottom: var(--s-4);
}

.head h1 {
  margin: var(--s-1) 0 0;
  overflow-wrap: anywhere;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: var(--t-small);
  font-weight: 500;
}

.back:hover {
  color: var(--on-surface);
  text-decoration: none;
}

.form {
  display: grid;
  gap: var(--s-4);
}

fieldset {
  min-width: 0;
  margin: 0;
}

legend {
  padding: 0 6px;
  font-weight: 500;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.pending {
  display: grid;
  gap: 4px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
}

.open-link {
  align-self: flex-start;
}

.bar {
  position: fixed;
  inset: auto 0 0;
  z-index: 25;
  padding-bottom: var(--safe-bottom);
  background: var(--bg);
  border-top: 1px solid var(--outline);
}

.bar__inner {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 1120px;
  margin: 0 auto;
  padding: 12px var(--gut);
}

.bar__count {
  flex: 1;
  min-width: 0;
  color: var(--muted);
}

.bar__count.active {
  color: var(--on-surface);
  font-weight: 500;
}

@media (min-width: 760px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }

  .wide {
    grid-column: 1 / -1;
  }
}
</style>
