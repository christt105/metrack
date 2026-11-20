<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import type { Collection } from '@metrack/domain';
import type { AnyDetail } from '../api/AnyDetail';
import { sessionKey } from '../auth/sessionKey';
import { useApi } from '../composables/useApi';
import { useMessages } from '../composables/useMessages';
import { saveForAll } from '../logic/saveForAll';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
const props = defineProps<{ collection: Collection; detail: AnyDetail }>();
const emit = defineEmits<{ saved: [detail: AnyDetail] }>();

const api = useApi();
const session = inject(sessionKey, null);
const editing = ref(false);
const text = ref('');
const saving = ref(false);
const error = ref<unknown>(null);

const pending = computed(() => 'pendingReview' in props.detail && props.detail.pendingReview);
const review = computed(() => ('review' in props.detail ? props.detail.review : null));

function edit(): void {
  text.value = review.value ?? '';
  error.value = null;
  editing.value = true;
}

function cancel(): void {
  editing.value = false;
  error.value = null;
}

async function save(publish = false): Promise<void> {
  saving.value = true;
  error.value = null;
  const next = text.value.trim() === '' ? null : text.value.trim();
  try {
    const updated = await saveForAll(
      (options) =>
        api.patch(
          props.collection,
          props.detail.id,
          (publish ? { review: next, pendingReview: false } : { review: next }) as never,
          options,
        ),
      session?.user.value?.role === 'owner',
      () => window.confirm(messages.detail.confirmForAll),
    );
    emit('saved', updated as AnyDetail);
    editing.value = false;
  } catch (cause) {
    error.value = cause;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="review-panel">
    <template v-if="editing">
      <label class="eyebrow" for="review-text">{{ messages.hero.reviewLabel }}</label>
      <textarea id="review-text" v-model="text" rows="6" :disabled="saving" />
      <ErrorNotice :error="error" />
      <p v-if="pending" class="muted">{{ messages.pending.draftHint }}</p>
      <div class="row">
        <button
          v-if="pending"
          type="button"
          class="primary publish"
          :disabled="saving"
          @click="save(true)"
        >
          {{ saving ? messages.common.saving : messages.pending.saveAndPublish }}
        </button>
        <button
          type="button"
          :class="{ primary: !pending }"
          class="save"
          :disabled="saving"
          @click="save(false)"
        >
          {{ saving ? messages.common.saving : messages.common.save }}
        </button>
        <button type="button" :disabled="saving" @click="cancel">{{ messages.hero.cancel }}</button>
      </div>
    </template>
    <template v-else>
      <blockquote v-if="review" class="review">
        <span class="eyebrow">{{ messages.hero.yourReview }}</span>
        {{ review }}
      </blockquote>
      <button type="button" class="edit-review" @click="edit">
        {{ review ? messages.hero.editReview : messages.hero.addReview }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.review-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s-3);
  margin-top: var(--s-5);
}

textarea {
  width: 100%;
}

.row {
  display: flex;
  gap: var(--s-2);
}

.review {
  align-self: stretch;
  margin: 0;
  padding: var(--s-4) var(--s-5);
  border-left: 2px solid var(--primary);
  background: var(--surface-low);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  font-style: italic;
  line-height: 1.7;
  white-space: pre-line;
}

.review .eyebrow {
  display: block;
  font-style: normal;
}
</style>
