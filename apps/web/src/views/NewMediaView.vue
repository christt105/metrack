<script setup lang="ts">
import ManualAddForm from '../components/ManualAddForm.vue';
import { messages } from '../i18n/messages';

defineProps<{ collection: 'games' | 'books' }>();
</script>

<template>
  <section>
    <h1>{{ messages.search.manualHeading }}: {{ messages.collectionLabels[collection] }}</h1>
    <ManualAddForm :collection="collection" />
  </section>
</template>
