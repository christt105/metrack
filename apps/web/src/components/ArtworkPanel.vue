<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Collection, ImageKind } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import { imageKindsOf } from '../logic/fieldSchemas';
import ErrorNotice from './ErrorNotice.vue';
import ImagePicker from './ImagePicker.vue';

const props = defineProps<{ collection: Collection; detail: AnyDetail }>();
const emit = defineEmits<{ updated: [detail: AnyDetail] }>();

const api = useApi();
const kinds = computed(() => imageKindsOf(props.collection));
const picking = ref<ImageKind | null>(null);
const error = ref<unknown>(null);

function current(kind: ImageKind): string | null {
  return (props.detail as unknown as Record<string, string | null | undefined>)[kind] ?? null;
}

function onChosen(detail: unknown): void {
  picking.value = null;
  emit('updated', detail as AnyDetail);
}

async function clear(kind: ImageKind): Promise<void> {
  error.value = null;
  try {
    emit('updated', (await api.clearImage(props.collection, props.detail.id, kind)) as AnyDetail);
  } catch (cause) {
    error.value = cause;
  }
}
</script>

<template>
  <section class="panel">
    <h2>{{ messages.detail.sectionArtwork }}</h2>
    <div class="slots">
      <div v-for="kind in kinds" :key="kind" class="slot" :class="kind">
        <div class="preview">
          <img
            v-if="current(kind)"
            :src="current(kind) ?? ''"
            :alt="messages.imageKindLabels[kind]"
          />
          <span v-else class="muted">{{ messages.artwork.noImage }}</span>
        </div>
        <div class="row">
          <strong>{{ messages.imageKindLabels[kind] }}</strong>
          <span
            v-if="detail.editedFields.includes(kind)"
            class="edited"
            :title="messages.detail.editedHint"
          >
            {{ messages.detail.edited }}
          </span>
        </div>
        <div class="row">
          <button type="button" class="small" @click="picking = picking === kind ? null : kind">
            {{ messages.artwork.change }}
          </button>
          <button v-if="current(kind)" type="button" class="small danger" @click="clear(kind)">
            {{ messages.artwork.clear }}
          </button>
        </div>
      </div>
    </div>
    <ImagePicker
      v-if="picking"
      :id="detail.id"
      :key="picking"
      :collection="collection"
      :kind="picking"
      @chosen="onChosen"
      @close="picking = null"
    />
    <ErrorNotice :error="error" />
  </section>
</template>

<style scoped>
.slots {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.slot {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview {
  display: grid;
  place-items: center;
  background: var(--surface-high);
  border-radius: var(--radius);
  overflow: hidden;
}

.cover .preview {
  width: 140px;
  aspect-ratio: 2 / 3;
}

.banner .preview {
  width: min(100%, 360px);
  aspect-ratio: 16 / 9;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.edited {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--warning);
  color: #261d00;
  font-size: 0.7rem;
}
</style>
