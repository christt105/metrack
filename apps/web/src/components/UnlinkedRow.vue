<script setup lang="ts">
import { computed, ref } from 'vue';
import type { UnlinkedTitle } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { fieldLabel, messages } from '../i18n/messages';
import { detailPath } from '../logic/mediaRoutes';
import { buildIds, idFieldsFor } from '../logic/unlinkedIdFields';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ title: UnlinkedTitle }>();
const emit = defineEmits<{ gone: [] }>();

const api = useApi();
const fields = computed(() => idFieldsFor(props.title.mediaType));
const texts = ref<Record<string, string>>({});
const busy = ref(false);
const error = ref<unknown>(null);
const needsIds = ref(false);
const resolvedPath = ref<string | null>(null);

async function dismiss(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await api.dismissUnlinked(props.title.id);
    emit('gone');
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

async function resolve(): Promise<void> {
  const ids = buildIds(props.title.mediaType, texts.value);
  needsIds.value = Object.keys(ids).length === 0;
  if (needsIds.value) return;
  busy.value = true;
  error.value = null;
  try {
    const created = await api.resolveUnlinked(props.title.id, { ids });
    resolvedPath.value = detailPath(created.type, created.id);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <article class="panel">
    <div class="head">
      <div>
        <strong>{{ title.title }}</strong>
        <span class="muted">
          {{ messages.typeLabels[title.mediaType]
          }}<template v-if="title.year"> - {{ title.year }}</template> -
          {{ messages.unlinked.source(title.source) }}
        </span>
      </div>
      <button type="button" class="small danger" :disabled="busy" @click="dismiss">
        {{ messages.unlinked.dismiss }}
      </button>
    </div>
    <p v-if="resolvedPath" class="notice success">
      {{ messages.unlinked.resolved }}
      <RouterLink :to="resolvedPath">{{ messages.common.open }}</RouterLink>
    </p>
    <p v-else-if="fields.length === 0" class="muted">{{ messages.unlinked.seasonHint }}</p>
    <form v-else class="ids" @submit.prevent="resolve">
      <label v-for="field in fields" :key="field.key">
        <span class="muted">{{ fieldLabel(field.key) }}</span>
        <input
          v-model="texts[field.key]"
          :type="field.numeric ? 'number' : 'text'"
          :min="field.numeric ? 0 : undefined"
        />
      </label>
      <button type="submit" class="primary" :disabled="busy">
        {{ messages.unlinked.resolve }}
      </button>
    </form>
    <p v-if="needsIds" class="notice error" role="alert">{{ messages.unlinked.needsIds }}</p>
    <ErrorNotice :error="error" />
  </article>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.head div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ids {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
}

label {
  display: flex;
  flex: 1 1 160px;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}
</style>
