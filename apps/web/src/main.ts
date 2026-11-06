import { createApp } from 'vue';
import { ApiClient } from './api/ApiClient';
import { apiKey } from './api/apiKey';
import App from './App.vue';
import { Session } from './auth/Session';
import { sessionKey } from './auth/sessionKey';
import { createAppRouter } from './router/createAppRouter';
import { installAuthGuard } from './router/installAuthGuard';
import './style.css';

const api = new ApiClient(undefined, () => {
  session.forget();
  const next = router.currentRoute.value.fullPath;
  void router.push({ name: 'login', query: next === '/' ? {} : { next } });
});
const session = new Session(api);
const router = createAppRouter();
installAuthGuard(router, session);

createApp(App).provide(apiKey, api).provide(sessionKey, session).use(router).mount('#app');
