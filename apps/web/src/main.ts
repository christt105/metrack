import { createApp } from 'vue';
import { ApiClient } from './api/ApiClient';
import { apiKey } from './api/apiKey';
import App from './App.vue';
import { Connectivity } from './connectivity/Connectivity';
import { connectivityKey } from './connectivity/connectivityKey';
import { Session } from './auth/Session';
import { sessionKey } from './auth/sessionKey';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { createAppRouter } from './router/createAppRouter';
import { installAuthGuard } from './router/installAuthGuard';
import './style.css';

const connectivity = new Connectivity(window, navigator.onLine);
const api = new ApiClient(
  undefined,
  () => {
    session.forget();
    const next = router.currentRoute.value.fullPath;
    void router.push({ name: 'login', query: next === '/' ? {} : { next } });
  },
  undefined,
  (reachable) => connectivity.report(reachable),
);
const session = new Session(api);
const router = createAppRouter();
installAuthGuard(router, session);

createApp(App)
  .provide(apiKey, api)
  .provide(sessionKey, session)
  .provide(connectivityKey, connectivity)
  .use(router)
  .mount('#app');

if (import.meta.env.PROD) registerServiceWorker(window, navigator.serviceWorker);
