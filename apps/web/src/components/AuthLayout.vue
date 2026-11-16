<script setup lang="ts">
import { messages } from '../i18n/messages';
</script>

<template>
  <div class="auth">
    <div class="auth__words">
      <span class="brand">
        <span class="mark" aria-hidden="true"></span>
        {{ messages.appName }}
      </span>
      <div class="auth__body">
        <slot />
      </div>
      <a class="auth__foot" href="/privacy">{{ messages.account.privacy }}</a>
    </div>
    <div class="auth__visual" aria-hidden="true">
      <div class="rings">
        <span v-for="n in 5" :key="n" class="ring" :style="{ '--i': n }"></span>
        <span class="core"></span>
      </div>
      <ul class="facts">
        <li v-for="fact in messages.landing.facts" :key="fact">{{ fact }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 100dvh;
}

.auth__words {
  display: flex;
  flex-direction: column;
  gap: var(--s-7);
  padding: calc(var(--s-6) + var(--safe-top)) clamp(24px, 6vw, 96px) var(--s-6);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.mark {
  width: 24px;
  height: 24px;
  background: var(--primary);
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill-rule='evenodd' d='M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z'/%3E%3C/svg%3E")
    center / contain no-repeat;
}

.auth__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  max-width: 480px;
}

.auth__foot {
  color: var(--muted);
  font-size: var(--t-label);
}

.auth__visual {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  margin: var(--s-4);
  border: 1px solid var(--outline);
  border-radius: var(--r-lg);
  background: var(--surface-low);
}

.rings {
  position: relative;
  width: min(72%, 520px);
  aspect-ratio: 1;
}

.ring {
  position: absolute;
  inset: calc((var(--i) - 1) * 9%);
  border: 1px solid rgba(159, 199, 184, calc(0.1 + var(--i) * 0.06));
  border-radius: 50%;
  animation: ring-in 900ms var(--ease-enter) both;
  animation-delay: calc(var(--i) * 70ms);
}

.core {
  position: absolute;
  inset: 41%;
  border: 14px solid var(--primary);
  border-radius: 50%;
  animation: ring-in 900ms var(--ease-enter) 420ms both;
}

.facts {
  position: absolute;
  left: var(--s-5);
  right: var(--s-5);
  bottom: var(--s-5);
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.facts li {
  padding: 6px 14px;
  border: 1px solid var(--outline);
  border-radius: 999px;
  background: var(--bg);
  color: var(--on-surface);
  font-size: var(--t-small);
}

@keyframes ring-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
}

@media (max-width: 899px) {
  .auth {
    grid-template-columns: 1fr;
  }

  .auth__visual {
    display: none;
  }

  .auth__words {
    gap: var(--s-6);
  }
}
</style>
