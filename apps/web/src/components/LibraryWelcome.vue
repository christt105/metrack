<script setup lang="ts">
import { useRouter } from 'vue-router';
import { messages } from '../i18n/messages';

const router = useRouter();
</script>

<template>
  <div class="welcome">
    <h2>{{ messages.list.welcomeTitle }}</h2>
    <p>{{ messages.list.welcomeIntro }}</p>
    <ul>
      <li v-for="point in messages.list.welcomePoints" :key="point">{{ point }}</li>
    </ul>
    <button type="button" class="primary" @click="router.push({ name: 'search' })">
      {{ messages.list.welcomeAction }}
    </button>
  </div>
</template>

<style scoped>
.welcome {
  max-width: 460px;
  margin: 24px auto;
}

ul {
  padding-left: 20px;
  margin: 12px 0 20px;
}

li {
  margin-bottom: 6px;
}
</style>
