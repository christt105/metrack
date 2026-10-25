<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SyncPlan } from '@metrack/domain';
import ErrorNotice from '../components/ErrorNotice.vue';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { messages } from '../i18n/messages';
import { countSyncChanges } from '../logic/countSyncChanges';

const api = useApi();
const { data: health, error: healthError } = useLoader(() => api.health());
const {
  data: backups,
  error: backupsError,
  reload: reloadBackups,
} = useLoader(() => api.listBackups());
const actionError = ref<unknown>(null);
const actionResult = ref<string | null>(null);
const busy = ref(false);

async function run(action: () => Promise<string>): Promise<void> {
  busy.value = true;
  actionError.value = null;
  actionResult.value = null;
  try {
    actionResult.value = await action();
  } catch (cause) {
    actionError.value = cause;
  } finally {
    busy.value = false;
  }
}

const plan = ref<SyncPlan | null>(null);
const syncChanges = computed(() => (plan.value === null ? 0 : countSyncChanges(plan.value)));
const checkSync = () =>
  run(async () => {
    plan.value = await api.syncReport();
    return countSyncChanges(plan.value) === 0 ? messages.settings.syncNothing : '';
  });
const applySync = () => {
  if (!window.confirm(messages.settings.syncConfirm)) return Promise.resolve();
  return run(async () => {
    const { plan: applied } = await api.applySync();
    plan.value = null;
    return messages.settings.syncApplied(countSyncChanges(applied));
  });
};

const publish = () =>
  run(async () => messages.settings.publishQueued((await api.publish()).failures));
const cleanup = () =>
  run(async () => messages.settings.cleanupDone((await api.cleanupImages()).removed.length));
const backup = () =>
  run(async () => {
    const created = await api.createBackup();
    await reloadBackups();
    return messages.settings.backupDone(created.name);
  });
</script>

<template>
  <section>
    <h1>{{ messages.settings.title }}</h1>
    <div class="panel">
      <h2>{{ messages.settings.service }}</h2>
      <ErrorNotice :error="healthError" />
      <dl v-if="health">
        <dt class="muted">{{ messages.settings.status }}</dt>
        <dd>{{ health.status }}</dd>
        <dt class="muted">{{ messages.settings.version }}</dt>
        <dd>{{ health.appVersion }}</dd>
        <dt class="muted">{{ messages.settings.schema }}</dt>
        <dd>{{ health.schemaVersion }}</dd>
      </dl>
    </div>
    <div class="panel">
      <h2>{{ messages.settings.publishing }}</h2>
      <p class="muted">{{ messages.settings.publishHint }}</p>
      <button type="button" :disabled="busy" @click="publish">
        {{ messages.settings.publish }}
      </button>
    </div>
    <div class="panel">
      <h2>{{ messages.settings.storage }}</h2>
      <button type="button" :disabled="busy" @click="cleanup">
        {{ messages.settings.cleanup }}
      </button>
    </div>
    <div class="panel">
      <h2>{{ messages.settings.backups }}</h2>
      <ErrorNotice :error="backupsError" />
      <p v-if="backups && backups.length === 0" class="muted">
        {{ messages.settings.backupsEmpty }}
      </p>
      <ul v-if="backups" class="backups">
        <li v-for="item in backups" :key="item.name">
          <span>{{ item.name }}</span>
          <span class="muted">
            {{ messages.settings.backupSize(item.sizeBytes)
            }}<template v-if="item.hasImages">, {{ messages.settings.backupWithImages }}</template>
          </span>
        </li>
      </ul>
      <button type="button" :disabled="busy" @click="backup">
        {{ messages.settings.backupNow }}
      </button>
    </div>
    <div class="panel">
      <h2>{{ messages.settings.sync }}</h2>
      <p class="muted">{{ messages.settings.syncHint }}</p>
      <ul v-if="plan" class="sync">
        <li>{{ messages.settings.syncMovies(plan.movies.length) }}</li>
        <li>
          {{ messages.settings.syncSeasons(plan.series.flatMap((s) => s.seasons).length) }}
        </li>
        <li>{{ messages.settings.syncUnlinked(plan.unlinked.length) }}</li>
        <li>{{ messages.settings.syncWarnings(plan.warnings.length) }}</li>
        <li class="muted">
          {{ messages.settings.syncUnmatched(plan.ignoredPlays, plan.unmatchedTitles.length) }}
        </li>
      </ul>
      <button type="button" :disabled="busy" @click="checkSync">
        {{ messages.settings.syncCheck }}
      </button>
      <button v-if="syncChanges > 0" type="button" :disabled="busy" @click="applySync">
        {{ messages.settings.syncApply }}
      </button>
    </div>
    <p v-if="actionResult" class="notice success" role="status">{{ actionResult }}</p>
    <ErrorNotice :error="actionError" />
  </section>
</template>

<style scoped>
.backups {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}

.sync {
  margin: 0 0 12px;
  padding-left: 20px;
}

.backups li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}

dd {
  margin: 0;
}
</style>
