<script lang="ts" setup>
// Vue.js
import { computed, ref, watchEffect } from 'vue';

// Quasar
import { useQuasar } from 'quasar';

// get the $q object
const $q = useQuasar();

// set dark mode status
$q.dark.set(true);

// server status
const status = ref<'OutOfService' | 'Creating' | 'InService' | 'Deleting' | 'Loading'>();

// watch server status
watchEffect(() => {
  document.body.classList[status.value === 'InService' ? 'remove' : 'add']('no-scroll');
});

// start server
const start = async () => {
  try {
    await fetch(import.meta.env.VITE_API_ENDPOINT, {
      method: 'POST',
    });
  } finally {
    update();
  }
};

// update server status
const update = async () => {
  try {
    status.value = await fetch(import.meta.env.VITE_API_ENDPOINT)
      .then((response) => response.json())
      .then((response) => response.status ?? 'OutOfService');
  } catch {
    //
  }
};

// stop server
const stop = async () => {
  try {
    await fetch(import.meta.env.VITE_API_ENDPOINT, {
      method: 'DELETE',
    });
  } finally {
    update();
  }
};

// update server status regularly
setInterval(update, 30 * 1000);

// update server status
update();

// model ids
const modelIds = [
  {
    label: 'ずんだもん',
    value: 0,
  },
];

// examples
const examples = [
  'こんにちは、初めまして。あなたの名前はなんていうの？',
  'えっと、私、あなたのことが好きです！もしよければ付き合ってくれませんか？',
  '吾輩は猫である。名前はまだ無い。',
  '桜の樹の下には屍体が埋まっている！これは信じていいことなんだよ。',
  'やったー！テストで満点取れたよ！私とっても嬉しいな！',
  'どうして私の意見を無視するの？許せない！ムカつく！あんたなんか死ねばいいのに。',
  'あはははっ！この漫画めっちゃ笑える、見てよこれ、ふふふ、あはは。',
  'あなたがいなくなって、私は一人になっちゃって、泣いちゃいそうなほど悲しい。',
  '深層学習の応用により、感情やアクセントを含む声質の微妙な変化も再現されている。',
];

// languages
const languages = [
  {
    label: '日本語',
    value: 'JP',
  },
  {
    label: '英語',
    value: 'EN',
    disable: true,
  },
  {
    label: '中国語',
    value: 'ZH',
    disable: true,
  },
];

// model id
const modelId = ref(modelIds[0]);

// text
const text = ref(examples[0]);

// auto split
const autoSplit = ref(true);

// split interval
const splitInterval = ref(0.5);

// language
const language = ref(languages[0]);

// sdp ratio
const sdpRatio = ref(0.2);

// noise
const noise = ref(0.6);

// noisew
const noisew = ref(0.8);

// length
const length = ref(1.0);

// params
const params = computed(() => new URLSearchParams([
  [
    'model_id',
    modelId.value.value.toString(),
  ],
  [
    'text',
    text.value,
  ],
  [
    'auto_split',
    autoSplit.value.toString(),
  ],
  [
    'split_interval',
    splitInterval.value.toString(),
  ],
  [
    'language',
    language.value.value,
  ],
  [
    'sdp_ratio',
    sdpRatio.value.toString(),
  ],
  [
    'noise',
    noise.value.toString(),
  ],
  [
    'noisew',
    noisew.value.toString(),
  ],
  [
    'length',
    length.value.toString(),
  ],
]));

// voice url
const voiceUrl = computed(() => new URL(`/voice?${params.value}`, import.meta.env.VITE_API_ENDPOINT));

// now
const now = ref(performance.now());

// result
const result = ref<string>();

// on error
const onError = (e: Event) => {
  if (e.target instanceof HTMLAudioElement) {
    result.value = e.target.error?.message;
    status.value = 'InService';
  }
};

// on loadeddata
const onLoadeddata = (e: Event) => {
  if (e.target instanceof HTMLAudioElement) {
    result.value = `Success, time: ${(performance.now() - now.value) / 1000} seconds.`;
    status.value = 'InService';
  }
};

// on play
const onPlay = (e: Event) => {
  if (e.target instanceof HTMLAudioElement) {
    if (e.target.readyState === 0) {
      now.value = performance.now();
      result.value = '';
      status.value = 'Loading';
    }
  }
};
</script>

<template>
  <q-layout view="hhh LpR fff">
    <q-header class="bg-dark">
      <q-toolbar class="q-mx-auto">
        <q-toolbar-title shrink>
          Mallows TTS
        </q-toolbar-title>
        <q-space />
        <q-btn dense flat round @click="stop">
          <q-icon name="mdi-power" />
          <q-tooltip class="text-no-wrap">
            TTSサーバーを停止する
          </q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>
    <q-page-container>
      <q-page class="q-mx-auto" padding>
        <q-card class="bg-transparent" flat>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <div class="column q-col-gutter-md">
                <div class="col">
                  <q-card flat>
                    <q-card-section>
                      <div>
                        モデル一覧
                      </div>
                    </q-card-section>
                    <q-card-section class="q-pt-none">
                      <q-select v-model="modelId" filled :options="modelIds" popup-content-class="no-shadow" />
                    </q-card-section>
                  </q-card>
                </div>
                <div class="col">
                  <q-card flat>
                    <q-card-section>
                      <div>
                        テキスト
                      </div>
                    </q-card-section>
                    <q-card-section class="q-py-none">
                      <q-input v-model="text" counter filled maxlength="100" type="textarea" />
                    </q-card-section>
                    <q-card-section class="q-pt-none q-pl-sm">
                      <q-checkbox v-model="autoSplit" label="改行で分けて生成（分けたほうが感情が乗ります）" />
                    </q-card-section>
                    <q-card-section class="q-pt-none">
                      <div>
                        改行ごとに挟む無音の長さ（秒）
                      </div>
                      <q-slider v-model="splitInterval" label markers :max="2.0" :min="0.0" :step="0.1" />
                    </q-card-section>
                    <q-card-section class="q-pt-none">
                      <div>
                        言語
                      </div>
                    </q-card-section>
                    <q-card-section class="q-pt-none">
                      <q-select v-model="language" filled :options="languages" popup-content-class="no-shadow" />
                    </q-card-section>
                  </q-card>
                </div>
                <div class="col">
                  <q-card flat>
                    <q-expansion-item label="詳細設定">
                      <q-card flat>
                        <q-card-section>
                          <div>
                            SDP Ratio
                          </div>
                          <q-slider v-model="sdpRatio" label markers :max="1.0" :min="0.0" :step="0.1" />
                          <div>
                            Noise
                          </div>
                          <q-slider v-model="noise" label markers :max="2.0" :min="0.1" :step="0.1" />
                          <div>
                            Noise_W
                          </div>
                          <q-slider v-model="noisew" label markers :max="2.0" :min="0.1" :step="0.1" />
                          <div>
                            Length
                          </div>
                          <q-slider v-model="length" label markers :max="2.0" :min="0.1" :step="0.1" />
                        </q-card-section>
                      </q-card>
                    </q-expansion-item>
                  </q-card>
                </div>
              </div>
            </div>
            <div class="col-12 col-md-6">
              <div class="column q-col-gutter-md">
                <div class="col">
                  <q-card flat>
                    <q-card-section>
                      <div>
                        情報
                      </div>
                    </q-card-section>
                    <q-card-section class="q-pt-none">
                      <q-input autogrow disable filled :model-value="result" type="textarea" />
                    </q-card-section>
                  </q-card>
                </div>
                <div class="col">
                  <q-card flat>
                    <q-card-section>
                      <div>
                        結果
                      </div>
                    </q-card-section>
                    <q-card-section class="q-pt-none">
                      <audio class="block full-width" controls preload="none" :src="voiceUrl.toString()" @error="onError" @loadeddata="onLoadeddata" @play="onPlay" />
                    </q-card-section>
                    <q-inner-loading :showing="status === 'Loading'">
                      <q-circular-progress indeterminate size="xl" />
                    </q-inner-loading>
                  </q-card>
                </div>
                <div class="col full-width">
                  <q-card flat>
                    <q-expansion-item default-opened label="テキスト例">
                      <q-list>
                        <q-item v-for="example in examples" clickable v-ripple @click="text = example">
                          <q-item-section>
                            <q-item-label lines="1">
                              {{ example }}
                            </q-item-label>
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </q-expansion-item>
                  </q-card>
                </div>
              </div>
            </div>
          </div>
        </q-card>
        <template v-if="!status || ['OutOfService', 'Creating', 'Deleting'].includes(status)">
          <div class="fullscreen dimmed">
            <div class="absolute-center full-width">
              <div class="column items-center q-gutter-lg">
                <template v-if="status === 'OutOfService'">
                  <q-btn color="grey-8" glossy size="lg" @click="start">
                    TTSサーバーを起動する
                  </q-btn>
                  <div class="text-center">
                    <p>
                      音声合成には起動中のTTSサーバーが必要です
                    </p>
                    <p>
                      TTSサーバーは30分で自動的に停止します
                    </p>
                  </div>
                </template>
                <template v-else>
                  <q-circular-progress indeterminate size="xl" />
                  <template v-if="status === 'Creating'">
                    <div class="text-center">
                      <p>
                        TTSサーバーを起動しています…
                      </p>
                      <p>
                        この処理には5分程度かかる場合があります
                      </p>
                    </div>
                  </template>
                  <template v-if="status === 'Deleting'">
                    <div class="text-center">
                      <p>
                        TTSサーバーを停止しています…
                      </p>
                    </div>
                  </template>
                </template>
              </div>
            </div>
          </div>
        </template>
      </q-page>
    </q-page-container>
    <q-footer class="q-px-sm q-pb-sm text-center bg-transparent">
      &copy; {{ new Date().getFullYear() }} tts.mallows.io
    </q-footer>
  </q-layout>
</template>

<style lang="scss" scoped>
.q-toolbar {
  max-width: $breakpoint-lg-min;
}

.q-page {
  max-width: $breakpoint-lg-min;
}

.dimmed:after {
  background-color: rgba(0, 0, 0, 0.6) !important;
}

.absolute-center {
  z-index: 6000;
}
</style>
