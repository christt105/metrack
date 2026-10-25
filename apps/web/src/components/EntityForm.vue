<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Collection, MediaStatus } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { useApi } from '../composables/useApi';
import { fieldLabel, messages } from '../i18n/messages';
import type { FieldSchema, FieldSection } from '../logic/FieldSchema';
import { fieldSchemas, isTracked } from '../logic/fieldSchemas';
import { buildPatch, DraftError, toDraft } from '../logic/formDraft';
import type { Draft } from '../logic/formDraft';
import { statusOptions } from '../logic/statusOptions';
import ErrorNotice from './ErrorNotice.vue';
import FieldInput from './FieldInput.vue';
import FieldRow from './FieldRow.vue';

const props = defineProps<{ collection: Collection; detail: AnyDetail }>();
const emit = defineEmits<{ saved: [detail: AnyDetail]; changed: [] }>();

const api = useApi();
const schemas = computed(() => fieldSchemas[props.collection]);
const tracked = computed(() => isTracked(props.collection));
const draft = ref<Draft>({});
const status = ref<MediaStatus>('planned');
const saving = ref(false);
const saved = ref(false);
const error = ref<unknown>(null);
const invalid = ref<{ key: string; reason: string } | null>(null);

const currentStatus = computed(() => ('status' in props.detail ? props.detail.status : 'planned'));
const options = computed(() => statusOptions(currentStatus.value));

watch(
  () => props.detail,
  (detail) => {
    draft.value = toDraft(schemas.value, detail);
    status.value = currentStatus.value;
  },
  { immediate: true },
);

const sections: FieldSection[] = ['tracking', 'metadata', 'ids', 'notes'];
const sectionTitles: Record<FieldSection, string> = {
  tracking: messages.detail.sectionTracking,
  metadata: messages.detail.sectionMetadata,
  ids: messages.detail.sectionIds,
  notes: messages.detail.sectionNotes,
};

function fieldsOf(section: FieldSection): FieldSchema[] {
  return schemas.value.filter((schema) => schema.section === section);
}

function isEdited(key: string): boolean {
  return props.detail.editedFields.includes(key);
}

function fieldId(key: string): string {
  return `field-${key}`;
}

function hintFor(schema: FieldSchema): string | undefined {
  return schema.kind === 'list' ? messages.detail.listHint : undefined;
}

async function release(key: string): Promise<void> {
  error.value = null;
  try {
    await api.unmarkEdited(props.collection, props.detail.id, key);
    emit('changed');
  } catch (cause) {
    error.value = cause;
  }
}

async function save(): Promise<void> {
  error.value = null;
  invalid.value = null;
  saved.value = false;
  let patch: Record<string, unknown>;
  try {
    patch = buildPatch(schemas.value, props.detail, draft.value);
  } catch (cause) {
    if (cause instanceof DraftError) invalid.value = { key: cause.key, reason: cause.message };
    else error.value = cause;
    return;
  }
  if (tracked.value && status.value !== currentStatus.value) patch.status = status.value;
  if (Object.keys(patch).length === 0) {
    saved.value = true;
    return;
  }
  saving.value = true;
  try {
    const updated = await api.patch(props.collection, props.detail.id, patch as never);
    emit('saved', updated as AnyDetail);
    saved.value = true;
  } catch (cause) {
    error.value = cause;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="entity-form" @submit.prevent="save">
    <fieldset
      v-for="section in sections"
      v-show="fieldsOf(section).length > 0 || (section === 'tracking' && tracked)"
      :key="section"
      class="panel"
    >
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
          :hint="hintFor(schema)"
          :invalid="invalid?.key === schema.key ? invalid.reason : undefined"
          :class="{ wide: schema.kind === 'textarea' || schema.kind === 'list' }"
          @release="release(schema.key)"
        >
          <FieldInput
            :id="fieldId(schema.key)"
            :kind="schema.kind"
            :required="schema.required"
            :model-value="draft[schema.key] ?? ''"
            @update:model-value="draft[schema.key] = $event"
          />
        </FieldRow>
      </div>
    </fieldset>
    <ErrorNotice :error="error" />
    <div class="actions">
      <button type="submit" class="primary" :disabled="saving">
        {{ saving ? messages.common.saving : messages.common.save }}
      </button>
      <span v-if="saved && !saving" class="success-text" role="status">{{
        messages.common.saved
      }}</span>
    </div>
  </form>
</template>

<style scoped>
fieldset {
  min-width: 0;
}

legend {
  padding: 0 6px;
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.actions {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  background: var(--surface);
}

.success-text {
  color: var(--success);
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
