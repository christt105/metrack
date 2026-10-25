import { createApp } from 'vue';
import { ApiClient } from './api/ApiClient';
import { apiKey } from './api/apiKey';
import App from './App.vue';
import { createAppRouter } from './router/createAppRouter';
import './style.css';

createApp(App).provide(apiKey, new ApiClient()).use(createAppRouter()).mount('#app');
