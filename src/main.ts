// Vue.js
import { createApp } from 'vue';

// Quasar
import { Quasar, lang, iconSet } from '@/plugins/quasar';

// App
import App from '@/app.vue';

// create the root component
const app = createApp(App);

// use the quasar
app.use(Quasar, {
  lang,
  iconSet,
});

// mount the app
app.mount('#app');
