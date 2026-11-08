<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { PUBLIC_PAGE_LIMITS, canUseOwnArtwork, type PublicPage } from '@metrack/domain';
import { ApiRequestError } from '../api/ApiRequestError';
import { sessionKey } from '../auth/sessionKey';
import { useApi } from '../composables/useApi';
import { messages } from '../i18n/messages';
import ErrorNotice from './ErrorNotice.vue';

const props = defineProps<{ page: PublicPage }>();
const emit = defineEmits<{ saved: [page: PublicPage] }>();

const api = useApi();
const session = inject(sessionKey, null);
const mayUpload = computed(() => {
  const user = session?.user.value;
  return user ? canUseOwnArtwork(user.role) : false;
});

const handle = ref(props.page.handle ?? '');
const enabled = ref(props.page.enabled);
const avatar = ref(props.page.avatar);
const intro = ref(props.page.intro ?? '');
const description = ref(props.page.description ?? '');
const about = ref(props.page.about ?? '');
const repo = ref(props.page.giscus?.repo ?? '');
const repoId = ref(props.page.giscus?.repoId ?? '');
const category = ref(props.page.giscus?.category ?? '');
const categoryId = ref(props.page.giscus?.categoryId ?? '');
const busy = ref(false);
const saved = ref(false);
const error = ref<unknown>(null);

watch(
  () => props.page,
  (page) => {
    handle.value = page.handle ?? '';
    enabled.value = page.enabled;
    avatar.value = page.avatar;
    intro.value = page.intro ?? '';
    description.value = page.description ?? '';
    about.value = page.about ?? '';
    repo.value = page.giscus?.repo ?? '';
    repoId.value = page.giscus?.repoId ?? '';
    category.value = page.giscus?.category ?? '';
    categoryId.value = page.giscus?.categoryId ?? '';
  },
);

const known = computed(() =>
  error.value instanceof ApiRequestError
    ? (messages.publicPage.errors[error.value.code] ?? null)
    : null,
);
const base = computed(() => (props.page.handle ? `/u/${props.page.handle}/` : null));

async function upload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  error.value = null;
  try {
    avatar.value = (await api.uploadImage(file)).ref;
  } catch (cause) {
    error.value = cause;
  }
}

async function save(): Promise<void> {
  busy.value = true;
  saved.value = false;
  error.value = null;
  const giscusValues = [repo, repoId, category, categoryId].map((value) => value.value.trim());
  try {
    const page = await api.updatePublicPage({
      handle: handle.value.trim(),
      enabled: enabled.value,
      avatar: avatar.value,
      intro: intro.value.trim(),
      description: description.value.trim(),
      about: about.value.trim(),
      giscus: giscusValues.every((value) => value === '')
        ? null
        : {
            repo: giscusValues[0] as string,
            repoId: giscusValues[1] as string,
            category: giscusValues[2] as string,
            categoryId: giscusValues[3] as string,
          },
    });
    saved.value = true;
    emit('saved', page);
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="panel">
    <h2>{{ messages.publicPage.title }}</h2>
    <p class="muted">{{ messages.publicPage.hint }}</p>
    <form class="public-page" @submit.prevent="save">
      <label>
        <span class="muted">{{ messages.publicPage.handle }}</span>
        <input v-model="handle" type="text" name="handle" maxlength="30" autocomplete="off" />
        <span class="muted hint">{{ messages.publicPage.handleHint }}</span>
      </label>
      <label class="check">
        <input v-model="enabled" type="checkbox" name="enabled" />
        <span>{{ messages.publicPage.enabled }}</span>
      </label>
      <div class="avatar-row">
        <img v-if="avatar" class="avatar" :src="avatar" alt="" />
        <div class="avatar-actions">
          <span class="muted">{{ messages.publicPage.avatar }}</span>
          <label v-if="mayUpload" class="file">
            <span class="muted hint">{{ messages.publicPage.avatarUpload }}</span>
            <input type="file" name="avatar" accept="image/*" @change="upload" />
          </label>
          <span v-else class="muted hint">{{ messages.publicPage.avatarDefault }}</span>
          <button v-if="avatar" type="button" class="small" @click="avatar = null">
            {{ messages.publicPage.avatarRemove }}
          </button>
        </div>
      </div>
      <label>
        <span class="muted">{{ messages.publicPage.intro }}</span>
        <input v-model="intro" type="text" name="intro" :maxlength="PUBLIC_PAGE_LIMITS.intro" />
      </label>
      <label>
        <span class="muted">{{ messages.publicPage.description }}</span>
        <textarea
          v-model="description"
          name="description"
          rows="3"
          :maxlength="PUBLIC_PAGE_LIMITS.description"
        />
      </label>
      <label>
        <span class="muted">{{ messages.publicPage.about }}</span>
        <textarea v-model="about" name="about" rows="8" :maxlength="PUBLIC_PAGE_LIMITS.about" />
        <span class="muted hint">{{ messages.publicPage.aboutHint }}</span>
      </label>
      <fieldset>
        <legend class="muted">{{ messages.publicPage.comments }}</legend>
        <span class="muted hint">{{ messages.publicPage.commentsHint }}</span>
        <label>
          <span class="muted">{{ messages.publicPage.giscusRepo }}</span>
          <input v-model="repo" type="text" name="giscus-repo" autocomplete="off" />
        </label>
        <label>
          <span class="muted">{{ messages.publicPage.giscusRepoId }}</span>
          <input v-model="repoId" type="text" name="giscus-repo-id" autocomplete="off" />
        </label>
        <label>
          <span class="muted">{{ messages.publicPage.giscusCategory }}</span>
          <input v-model="category" type="text" name="giscus-category" autocomplete="off" />
        </label>
        <label>
          <span class="muted">{{ messages.publicPage.giscusCategoryId }}</span>
          <input v-model="categoryId" type="text" name="giscus-category-id" autocomplete="off" />
        </label>
      </fieldset>
      <button type="submit" :disabled="busy">{{ messages.publicPage.save }}</button>
    </form>
    <p v-if="saved" class="notice success" role="status">{{ messages.publicPage.saved }}</p>
    <p v-if="known" class="notice error" role="alert">{{ known }}</p>
    <ErrorNotice v-else :error="error" />
    <p v-if="page.enabled && base">
      <a :href="base" target="_blank" rel="noopener">{{ messages.publicPage.open }}</a>
      ·
      <a :href="`${base}feed.xml`" target="_blank" rel="noopener">{{ messages.publicPage.feed }}</a>
    </p>
  </div>
</template>

<style scoped>
.public-page {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.public-page label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}

.public-page .check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
}

.public-page button {
  justify-self: start;
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
}

.public-page fieldset {
  display: grid;
  gap: 8px;
  border: 1px solid var(--border, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
}

.hint {
  font-size: 0.75rem;
}
</style>
