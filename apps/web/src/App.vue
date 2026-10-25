<script setup lang="ts">
import { messages } from './i18n/messages';
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">{{ messages.appName }}</RouterLink>
    <nav>
      <RouterLink to="/">{{ messages.nav.library }}</RouterLink>
      <RouterLink to="/search">{{ messages.nav.search }}</RouterLink>
      <RouterLink to="/watchlist">{{ messages.nav.watchlist }}</RouterLink>
      <RouterLink to="/unlinked">{{ messages.nav.unlinked }}</RouterLink>
      <RouterLink to="/settings">{{ messages.nav.settings }}</RouterLink>
    </nav>
  </header>
  <main class="page">
    <RouterView />
  </main>
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

.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 16px 64px;
}
</style>
