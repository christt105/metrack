<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Collection, ImageCandidateList, ImageKind } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ collection: Collection; id: number; kind: ImageKind }>();
const emit = defineEmits<{ chosen: [detail: unknown]; close: [] }>();

const api = useApi();
const list = ref<ImageCandidateList | null>(null);
const error = ref<unknown>(null);
const choosing = ref<string | null>(null);

onMounted(async () => {
  try {
    list.value = await api.imageCandidates(props.collection, props.id, props.kind);
  } catch (cause) {
    error.value = cause;
  }
});

async function choose(url: string): Promise<void> {
  choosing.value = url;
  error.value = null;
  try {
    emit('chosen', await api.chooseImage(props.collection, props.id, props.kind, url));
  } catch (cause) {
    error.value = cause;
  } finally {
    choosing.value = null;
  }
}
</script>

<template>
  <div class="picker">
    <div class="row head">
      <strong>{{ messages.imageKindLabels[kind] }}</strong>
      <button type="button" class="small" @click="emit('close')">
        {{ messages.artwork.close }}
      </button>
    </div>
    <p v-if="!list && !error" class="muted">{{ messages.artwork.loadingCandidates }}</p>
    <p v-for="failure in list?.failures ?? []" :key="failure.provider" class="notice error">
      {{ messages.artwork.providerFailed(failure.provider, failure.error) }}
    </p>
    <p v-if="list && list.candidates.length === 0" class="muted">
      {{ messages.artwork.noCandidates }}
    </p>
    <div class="candidates" :class="kind">
      <button
        v-for="candidate in list?.candidates ?? []"
        :key="candidate.url"
        type="button"
        class="candidate"
        :disabled="choosing !== null"
        :title="messages.artwork.choose"
        @click="choose(candidate.url)"
      >
        <img :src="candidate.thumbUrl" :alt="candidate.provider" loading="lazy" />
        <small class="muted">
          {{ candidate.provider
          }}<template v-if="candidate.width && candidate.height">
            {{ candidate.width }}x{{ candidate.height }}</template
          ><template v-if="candidate.language"> {{ candidate.language }}</template>
        </small>
      </button>
    </div>
    <ErrorNotice :error="error" />
  </div>
</template>

<style scoped>
.picker {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--outline);
}

.head {
  justify-content: space-between;
  margin-bottom: 8px;
}

.candidates {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
  max-height: 420px;
  overflow-y: auto;
}

.candidates.banner {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.candidate {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  text-align: left;
}

.candidate img {
  width: 100%;
  display: block;
  border-radius: 4px;
  background: var(--surface-high);
}
</style>
