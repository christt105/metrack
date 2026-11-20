<script setup lang="ts">
import { reactive, ref } from 'vue';
import { INVITE_LIMITS, type Invite } from '@metrack/domain';
import { useApi } from '../composables/useApi';
import { useLoader } from '../composables/useLoader';
import { useSession } from '../composables/useSession';
import { useMessages } from '../composables/useMessages';
import { inviteUrl } from '../logic/inviteUrl';
import ErrorNotice from './ErrorNotice.vue';

const messages = useMessages();
const api = useApi();
const session = useSession();
const { data: invites, error: loadError, reload } = useLoader(() => api.listInvites());
const draft = reactive({ maxUses: 1, expiresInDays: INVITE_LIMITS.defaultExpiryDays });
const link = ref<string | null>(null);
const copied = ref(false);
const error = ref<unknown>(null);
const busy = ref(false);
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const expiryChoices = [1, 3, 7, 14, 30, 90];

const day = (iso: string): string => iso.slice(0, 10);

async function act(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await action();
    await reload();
  } catch (cause) {
    error.value = cause;
  } finally {
    busy.value = false;
  }
}

const create = () =>
  act(async () => {
    const created = await api.createInvite({
      maxUses: draft.maxUses,
      expiresInDays: draft.expiresInDays,
    });
    link.value = inviteUrl(window.location.origin, created.code);
    copied.value = false;
  });

const revoke = (invite: Invite) => {
  if (!window.confirm(messages.invites.revokeConfirm)) return Promise.resolve();
  return act(() => api.revokeInvite(invite.id));
};

async function share(): Promise<void> {
  if (link.value === null) return;
  try {
    await navigator.share({
      title: messages.appName,
      text: messages.invites.shareText(session.user.value?.name ?? ''),
      url: link.value,
    });
  } catch (cause) {
    if (!(cause instanceof DOMException && cause.name === 'AbortError')) error.value = cause;
  }
}

async function copy(): Promise<void> {
  if (link.value === null) return;
  await navigator.clipboard.writeText(link.value);
  copied.value = true;
}
</script>

<template>
  <div class="panel">
    <h2>{{ messages.invites.title }}</h2>
    <p class="muted">{{ messages.invites.hint }}</p>
    <ErrorNotice :error="loadError" />
    <div v-if="link" class="notice success link" role="status" data-test="invite-link">
      <span>{{ messages.invites.created }}</span>
      <code>{{ link }}</code>
      <div class="row">
        <button v-if="canShare" type="button" name="share" @click="share">
          {{ messages.invites.share }}
        </button>
        <button type="button" name="copy" @click="copy">
          {{ copied ? messages.invites.copied : messages.invites.copy }}
        </button>
      </div>
    </div>
    <form class="create" @submit.prevent="create">
      <label>
        <span class="muted">{{ messages.invites.uses }}</span>
        <input
          v-model.number="draft.maxUses"
          type="number"
          name="maxUses"
          min="1"
          :max="INVITE_LIMITS.maxUses"
          step="1"
          required
        />
      </label>
      <label>
        <span class="muted">{{ messages.invites.expiry }}</span>
        <select v-model.number="draft.expiresInDays" name="expiresInDays">
          <option v-for="days in expiryChoices" :key="days" :value="days">
            {{ messages.invites.expiryLabel(days) }}
          </option>
        </select>
      </label>
      <button type="submit" :disabled="busy">{{ messages.invites.create }}</button>
    </form>
    <ErrorNotice :error="error" />
    <p v-if="invites && invites.length === 0" class="muted">{{ messages.invites.empty }}</p>
    <ul v-if="invites && invites.length > 0" class="invites">
      <li v-for="invite in invites" :key="invite.id" data-test="invite">
        <div>
          <strong>{{ messages.invites.statusLabels[invite.status] }}</strong>
          <span class="muted">{{
            messages.invites.summary(invite.uses, invite.maxUses, day(invite.expiresAt))
          }}</span>
          <span v-for="use in invite.usedBy" :key="use.usedAt + String(use.userId)" class="muted">
            {{ messages.invites.usedBy(use.userName, day(use.usedAt)) }}
          </span>
        </div>
        <button
          v-if="invite.status === 'valid'"
          type="button"
          :disabled="busy"
          @click="revoke(invite)"
        >
          {{ messages.invites.revoke }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.link {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.link code {
  overflow-wrap: anywhere;
  user-select: all;
}

.create {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.create label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8rem;
}

.invites {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}

.invites li {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.invites li div {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}

.invites .muted {
  font-size: 0.8rem;
}
</style>
