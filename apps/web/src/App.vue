<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from './components/AppIcon.vue';
import DeletionBanner from './components/DeletionBanner.vue';
import OfflineNotice from './components/OfflineNotice.vue';
import { useSession } from './composables/useSession';
import { messages } from './i18n/messages';
import { NAV_ITEMS } from './logic/mainNavItems';

const session = useSession();
const route = useRoute();
const router = useRouter();

const signedIn = computed(() => Boolean(session.user.value) && !session.needsWelcome.value);
const focused = computed(() => route.meta.focused === true);
const publicUrl = computed(() => {
  const page = session.publicPage.value;
  return page?.enabled && page.handle ? `/u/${page.handle}/` : null;
});
const bare = computed(() => !session.user.value || route.meta.public === true);

function isCurrent(names: readonly string[]): boolean {
  return typeof route.name === 'string' && names.includes(route.name);
}

async function signOut(): Promise<void> {
  await session.signOut();
  await router.push({ name: 'login' });
}
</script>

<template>
  <a class="skip-link" href="#content">{{ messages.shell.skip }}</a>
  <header v-if="!bare" class="nav" :class="{ focused }">
    <div class="nav__wrap">
      <RouterLink to="/" class="brand" :aria-label="messages.appName">
        <span class="mark" aria-hidden="true"></span>
        <span class="brand__word">{{ messages.appName }}</span>
      </RouterLink>
      <nav v-if="signedIn" class="nav__links" :aria-label="messages.shell.mainNav">
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          class="nav__link"
          :aria-current="isCurrent(item.routes) ? 'page' : undefined"
        >
          {{ messages.nav[item.label] }}
        </RouterLink>
      </nav>
      <div v-if="session.user.value" class="account">
        <span class="account__name">{{ session.user.value.name }}</span>
        <a
          v-if="publicUrl"
          class="icon-link"
          :href="publicUrl"
          target="_blank"
          rel="noopener"
          :aria-label="messages.shell.publicPage"
          :title="messages.shell.publicPage"
        >
          <AppIcon name="externalLink" :size="20" />
        </a>
        <button
          type="button"
          class="ghost icon-button"
          :aria-label="messages.login.signOut"
          :title="messages.login.signOut"
          @click="signOut"
        >
          <AppIcon name="logout" :size="20" />
        </button>
      </div>
    </div>
  </header>
  <OfflineNotice />
  <DeletionBanner v-if="session.user.value" />
  <main id="content" :class="bare ? 'bare' : 'page'" tabindex="-1">
    <RouterView />
  </main>
  <footer v-if="!bare" class="foot" :class="{ focused }">
    <a href="/privacy">{{ messages.account.privacy }}</a>
  </footer>
  <nav
    v-if="signedIn && !bare"
    class="tabbar"
    :class="{ focused }"
    :aria-label="messages.shell.mainNav"
  >
    <RouterLink
      v-for="item in NAV_ITEMS"
      :key="item.to"
      :to="item.to"
      class="tab"
      :aria-current="isCurrent(item.routes) ? 'page' : undefined"
    >
      <AppIcon :name="item.icon" />
      <span>{{ messages.nav[item.label] }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.skip-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 50;
  padding: 10px 16px;
  border-radius: var(--r-sm);
  background: var(--on-surface);
  color: var(--bg);
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: none;
}

.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  padding-top: var(--safe-top);
  background: var(--bg);
  border-bottom: 1px solid var(--outline);
}

.nav__wrap {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--s-5);
  max-width: var(--wrap);
  height: var(--nav);
  margin: 0 auto;
  padding: 0 var(--gut);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  justify-self: start;
  color: var(--on-surface);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.brand:hover {
  text-decoration: none;
}

.mark {
  width: 24px;
  height: 24px;
  background: var(--primary);
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill-rule='evenodd' d='M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z'/%3E%3C/svg%3E")
    center / contain no-repeat;
}

.nav__links {
  display: flex;
  gap: var(--s-1);
}

.nav__link {
  position: relative;
  padding: 10px 14px;
  border-radius: var(--r-sm);
  color: var(--muted);
  font-weight: 500;
  transition: color var(--m-out) var(--ease);
}

.nav__link:hover {
  color: var(--on-surface);
  text-decoration: none;
  transition-duration: var(--m-in);
}

.nav__link[aria-current='page'] {
  color: var(--on-surface);
}

.nav__link[aria-current='page']::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: calc((var(--nav) - 44px) / -2 - 1px);
  height: 2px;
  border-radius: 2px;
  background: var(--primary);
}

.account {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: var(--s-2);
}

.account__name {
  color: var(--muted);
  font-size: var(--t-small);
}

.icon-button {
  width: 44px;
  padding: 0;
}

.icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-sm);
  color: var(--muted);
}

.icon-link:hover {
  color: var(--on-surface);
  text-decoration: none;
}

.page {
  max-width: var(--wrap);
  min-height: calc(100dvh - var(--nav) - 80px);
  margin: 0 auto;
  padding: var(--s-6) var(--gut) var(--s-8);
  outline: none;
}

.bare {
  outline: none;
}

.foot {
  max-width: var(--wrap);
  margin: 0 auto;
  padding: 0 var(--gut) calc(var(--s-6) + var(--tabbar));
  font-size: var(--t-label);
}

.foot a {
  color: var(--muted);
}

.tabbar {
  display: none;
}

@media (max-width: 759px) {
  .nav__wrap {
    grid-template-columns: 1fr auto;
  }

  .nav__links,
  .account__name {
    display: none;
  }

  .page {
    padding-top: var(--s-5);
  }

  .tabbar {
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    height: var(--tabbar);
    padding-bottom: var(--safe-bottom);
    background: var(--bg);
    border-top: 1px solid var(--outline);
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
  }

  .tab span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab:hover {
    text-decoration: none;
  }

  .tab[aria-current='page'] {
    color: var(--on-surface);
  }

  .tab[aria-current='page'] .icon {
    color: var(--primary);
  }

  .focused {
    display: none;
  }
}
</style>
