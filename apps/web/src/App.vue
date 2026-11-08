<script setup lang="ts">
import { useRouter } from 'vue-router';
import DeletionBanner from './components/DeletionBanner.vue';
import { useSession } from './composables/useSession';
import { messages } from './i18n/messages';

const session = useSession();
const router = useRouter();

async function signOut(): Promise<void> {
  await session.signOut();
  await router.push({ name: 'login' });
}
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">{{ messages.appName }}</RouterLink>
    <nav v-if="session.user.value">
      <RouterLink to="/">{{ messages.nav.library }}</RouterLink>
      <RouterLink to="/search">{{ messages.nav.search }}</RouterLink>
      <RouterLink to="/watchlist">{{ messages.nav.watchlist }}</RouterLink>
      <RouterLink to="/unlinked">{{ messages.nav.unlinked }}</RouterLink>
      <RouterLink to="/settings">{{ messages.nav.settings }}</RouterLink>
    </nav>
    <div v-if="session.user.value" class="account">
      <span class="muted">{{ session.user.value.name }}</span>
      <button type="button" class="small" @click="signOut">{{ messages.login.signOut }}</button>
    </div>
  </header>
  <DeletionBanner v-if="session.user.value" />
  <main class="page">
    <RouterView />
  </main>
  <footer class="foot">
    <a href="/privacy">{{ messages.account.privacy }}</a>
  </footer>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 24px;
  padding: 10px 16px;
  background: var(--surface-low);
  border-bottom: 1px solid var(--outline);
}

.brand {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--on-surface);
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

nav a {
  padding: 6px 2px;
  color: var(--muted);
  border-bottom: 2px solid transparent;
}

nav a.router-link-exact-active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.account {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.foot {
  text-align: center;
  padding: 0 16px 32px;
  font-size: 0.85rem;
}

.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 16px 64px;
}
</style>
