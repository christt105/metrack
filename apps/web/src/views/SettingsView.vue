<script setup lang="ts">
import { computed, ref } from 'vue';
import type { HealthReport, OwnSettings, SyncPlan } from '@metrack/domain';
import AboutPanel from '../components/AboutPanel.vue';
import AccountPanel from '../components/AccountPanel.vue';
import ErrorNotice from '../components/ErrorNotice.vue';
import InvitationsPanel from '../components/InvitationsPanel.vue';
import LanguagePanel from '../components/LanguagePanel.vue';
import NtfyAlertsPanel from '../components/NtfyAlertsPanel.vue';
import PublicPagePanel from '../components/PublicPagePanel.vue';
import SettingsList from '../components/SettingsList.vue';
import TokensPanel from '../components/TokensPanel.vue';
import UsersPanel from '../components/UsersPanel.vue';
import UserSettingsEditor from '../components/UserSettingsEditor.vue';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { useSession } from '../composables/useSession';
import { useMessages } from '../composables/useMessages';
import { countSyncChanges } from '../logic/countSyncChanges';

const messages = useMessages();
const api = useApi();
const session = useSession();
let healthRequest: Promise<HealthReport> | undefined;
const loadHealth = (): Promise<HealthReport> => (healthRequest ??= api.health());
const { data: health, error: healthError } = useLoader(loadHealth);
let ownRequest: Promise<OwnSettings> | undefined;
const loadOwn = (): Promise<OwnSettings> => (ownRequest ??= api.ownSettings());
const { data: own, error: ownError, reload: reloadOwn } = useLoader(loadOwn);
const owner = computed(() => own.value?.owner === true);
const ownerOnly = async <T,>(load: () => Promise<T>): Promise<T | null> =>
  (await loadOwn()).owner ? load() : null;
const {
  data: backups,
  error: backupsError,
  reload: reloadBackups,
} = useLoader(() =>
  ownerOnly(async () => ((await loadHealth()).features.backups ? api.listBackups() : null)),
);
const { data: imageUsage, error: imageUsageError } = useLoader(() => api.imageUsage());
const { data: users, error: usersError } = useLoader(() => ownerOnly(() => api.listUsers()));
const refreshOwn = async (): Promise<void> => {
  ownRequest = undefined;
  await reloadOwn();
  if (own.value) session.setPublicPage(own.value.publicPage);
};
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

const cleanup = () =>
  run(async () => messages.settings.cleanupDone((await api.cleanupImages()).removed.length));
const backup = () =>
  run(async () => {
    const created = await api.createBackup();
    await reloadBackups();
    return messages.settings.backupDone(created.name);
  });
const groups = computed(() =>
  (['profile', 'connections', 'people', 'system', 'about'] as const)
    .filter((id) => id !== 'people' || owner.value)
    .map((id) => ({ id })),
);
</script>

<template>
  <section>
    <h1>{{ messages.settings.title }}</h1>
    <div class="settings">
      <nav class="index" :aria-label="messages.settings.sections">
        <a v-for="group in groups" :key="group.id" :href="`#${group.id}`" class="chip">
          {{ messages.settings.groups[group.id] }}
        </a>
      </nav>
      <div class="groups">
        <div id="profile" class="group">
          <p class="group-title">{{ messages.settings.groups.profile }}</p>
          <LanguagePanel v-if="own" :language="own.settings.language" />
          <PublicPagePanel v-if="own" :page="own.publicPage" @saved="refreshOwn" />
          <AccountPanel v-if="own" :handle="own.publicPage.handle" />
        </div>
        <div id="connections" class="group">
          <p class="group-title">{{ messages.settings.groups.connections }}</p>
          <div class="panel">
            <h2>{{ messages.settings.jobs }}</h2>
            <p class="muted">{{ messages.settings.jobsHint }}</p>
            <ErrorNotice :error="ownError" />
            <SettingsList v-if="own" :settings="own.settings" />
          </div>
          <NtfyAlertsPanel
            v-if="own?.ntfyTopicGenerated"
            :topic="own.settings.ntfyTopic"
            @saved="refreshOwn"
          />
          <TokensPanel :connector="owner" />
          <div v-if="own?.settings.jellyfinUser" class="panel">
            <h2>{{ messages.settings.sync }}</h2>
            <p v-if="health?.features.sync === false" class="muted">
              {{ messages.settings.syncByConnector }}
            </p>
            <template v-else>
              <p class="muted">{{ messages.settings.syncHint }}</p>
              <ul v-if="plan" class="sync">
                <li>{{ messages.settings.syncMovies(plan.movies.length) }}</li>
                <li>
                  {{ messages.settings.syncSeasons(plan.series.flatMap((s) => s.seasons).length) }}
                </li>
                <li>{{ messages.settings.syncUnlinked(plan.unlinked.length) }}</li>
                <li>{{ messages.settings.syncWarnings(plan.warnings.length) }}</li>
                <li class="muted">
                  {{
                    messages.settings.syncUnmatched(plan.ignoredPlays, plan.unmatchedTitles.length)
                  }}
                </li>
              </ul>
              <button type="button" :disabled="busy" @click="checkSync">
                {{ messages.settings.syncCheck }}
              </button>
              <button v-if="syncChanges > 0" type="button" :disabled="busy" @click="applySync">
                {{ messages.settings.syncApply }}
              </button>
            </template>
          </div>
        </div>
        <div v-if="owner" id="people" class="group">
          <p class="group-title">{{ messages.settings.groups.people }}</p>
          <InvitationsPanel v-if="owner" />
          <UsersPanel v-if="owner" />
          <div v-if="owner" class="panel">
            <h2>{{ messages.settings.users }}</h2>
            <p class="muted">{{ messages.settings.usersHint }}</p>
            <ErrorNotice :error="usersError" />
            <UserSettingsEditor
              v-for="entry in users ?? []"
              :key="entry.user.id"
              :user="entry.user"
              :settings="entry.settings"
              :topic-generated="own?.ntfyTopicGenerated === true"
              @saved="refreshOwn"
            />
          </div>
        </div>
        <div id="system" class="group">
          <p class="group-title">{{ messages.settings.groups.system }}</p>
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
            <h2>{{ messages.images.title }}</h2>
            <ErrorNotice :error="imageUsageError" />
            <p v-if="imageUsage" data-test="image-usage">
              {{
                imageUsage.quotaBytes === null
                  ? messages.images.usageUnlimited(messages.images.megabytes(imageUsage.usedBytes))
                  : messages.images.usage(
                      messages.images.megabytes(imageUsage.usedBytes),
                      messages.images.megabytes(imageUsage.quotaBytes),
                    )
              }}
            </p>
          </div>
          <div v-if="owner" class="panel">
            <h2>{{ messages.settings.storage }}</h2>
            <button type="button" :disabled="busy" @click="cleanup">
              {{ messages.settings.cleanup }}
            </button>
          </div>
          <div v-if="owner && health?.features.backups" class="panel">
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
                  }}<template v-if="item.hasImages"
                    >, {{ messages.settings.backupWithImages }}</template
                  >
                </span>
              </li>
            </ul>
            <button type="button" :disabled="busy" @click="backup">
              {{ messages.settings.backupNow }}
            </button>
          </div>
        </div>
        <div id="about" class="group">
          <p class="group-title">{{ messages.settings.groups.about }}</p>
          <AboutPanel :version="health?.appVersion ?? null" />
        </div>
        <p v-if="actionResult" class="notice success" role="status">{{ actionResult }}</p>
        <ErrorNotice :error="actionError" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings {
  display: grid;
  grid-template-columns: 200px minmax(0, 820px);
  gap: var(--s-7);
  align-items: start;
}

.index {
  position: sticky;
  top: calc(var(--nav) + var(--s-5));
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
}

.index .chip {
  justify-content: flex-start;
  border-color: transparent;
  color: var(--muted);
}

.index .chip:hover {
  color: var(--on-surface);
  background: var(--surface-low);
  text-decoration: none;
}

.group {
  scroll-margin-top: calc(var(--nav) + var(--s-4));
  margin-bottom: var(--s-7);
}

.group-title {
  margin: 0 0 var(--s-3);
  color: var(--muted);
  font-size: var(--t-label);
  font-weight: 500;
}

@media (max-width: 959px) {
  .settings {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s-4);
  }

  .index {
    top: var(--nav);
    z-index: 5;
    flex-direction: row;
    overflow-x: auto;
    margin: 0 calc(var(--gut) * -1);
    padding: var(--s-2) var(--gut);
    background: var(--bg);
    scrollbar-width: none;
  }

  .index .chip {
    border-color: var(--outline);
  }
}

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
