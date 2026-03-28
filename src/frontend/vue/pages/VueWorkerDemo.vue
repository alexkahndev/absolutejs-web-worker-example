<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

// Hash
const hashResult = ref<{ hash: string; input: string } | null>(null);
const hashLoading = ref(false);

// Prime
const primeResult = ref<{ prime: number; n: number; duration: number } | null>(
  null,
);
const primeLoading = ref(false);

// Sort
const sortResult = ref<{
  size: number;
  min: number;
  max: number;
  median: number;
  duration: number;
} | null>(null);
const sortLoading = ref(false);

// Thread Race
const racing = ref(false);
const workerTime = ref(0);
const mainTime = ref(0);
let timerWorker: Worker | null = null;
let mainInterval: ReturnType<typeof setInterval> | null = null;

// Image
const imageLoading = ref(false);
const imageDuration = ref<number | null>(null);
const imageLoaded = ref(false);
const imageFileName = ref<string | null>(null);
const originalCanvas = ref<HTMLCanvasElement | null>(null);
const processedCanvas = ref<HTMLCanvasElement | null>(null);
const uploadLabel = ref<HTMLLabelElement | null>(null);

function onImageDragOver(e: DragEvent) {
  e.preventDefault();
  uploadLabel.value?.classList.add("dragover");
}
function onImageDragLeave() {
  uploadLabel.value?.classList.remove("dragover");
}
function onImageDrop(e: DragEvent) {
  e.preventDefault();
  uploadLabel.value?.classList.remove("dragover");
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith("image/")) loadImageFile(file);
}
function onImageFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) loadImageFile(file);
}

// Parallel
const difficulties = [3, 6, 11];
const workerLabels = ["240K primes", "480K primes", "880K primes"];
const parallelLoading = ref(false);
const parallelWorkers = ref([
  { percent: 0, elapsed: 0, done: false },
  { percent: 0, elapsed: 0, done: false },
  { percent: 0, elapsed: 0, done: false },
]);
let parallelWorkerRefs: Worker[] = [];

const CANVAS_W = 200;
const CANVAS_H = 150;

function loadImageFile(file: File) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const canvas = originalCanvas.value;
    const processed = processedCanvas.value;
    if (canvas && processed) {
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
      processed.getContext("2d")!.clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    URL.revokeObjectURL(url);
    imageLoaded.value = true;
    imageFileName.value = file.name;
    imageDuration.value = null;
  };
  img.src = url;
}

onUnmounted(() => {
  timerWorker?.terminate();
  if (mainInterval) clearInterval(mainInterval);
});

function startRace() {
  racing.value = true;
  workerTime.value = 0;
  mainTime.value = 0;

  const worker = new Worker(
    new URL("../../workers/timer.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (event: MessageEvent<{ elapsed: number }>) => {
    workerTime.value = event.data.elapsed;
  };
  worker.postMessage({ command: "start" });
  timerWorker = worker;

  let mainElapsed = 0;
  mainInterval = setInterval(() => {
    mainElapsed += 100;
    mainTime.value = mainElapsed;
  }, 100);
}

function stopRace() {
  racing.value = false;
  timerWorker?.postMessage({ command: "stop" });
  timerWorker?.terminate();
  timerWorker = null;
  if (mainInterval) clearInterval(mainInterval);
  mainInterval = null;
}

function runHash() {
  hashLoading.value = true;
  const worker = new Worker(
    new URL("../../workers/hash.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (event: MessageEvent<{ hash: string; input: string }>) => {
    hashResult.value = event.data;
    hashLoading.value = false;
    worker.terminate();
  };
  worker.postMessage({ text: "Hello, World!" });
}

function runPrime() {
  primeLoading.value = true;
  const worker = new Worker(
    new URL("../../workers/prime.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (
    event: MessageEvent<{ prime: number; n: number; duration: number }>,
  ) => {
    primeResult.value = event.data;
    primeLoading.value = false;
    worker.terminate();
  };
  worker.postMessage({ n: 10000 });
}

function runSort() {
  sortLoading.value = true;
  const worker = new Worker(
    new URL("../../workers/sort.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (
    event: MessageEvent<{
      size: number;
      min: number;
      max: number;
      median: number;
      duration: number;
    }>,
  ) => {
    sortResult.value = event.data;
    sortLoading.value = false;
    worker.terminate();
  };
  worker.postMessage({ size: 1000000 });
}

const stressing = ref(false);

function stressMainThread() {
  if (stressing.value) return;
  stressing.value = true;
  const duration = 8000;
  const start = Date.now();
  function heavyChunk() {
    const chunkEnd = Date.now() + 200;
    while (Date.now() < chunkEnd) {
      Math.sqrt(Math.random() * 999999);
    }
    if (Date.now() - start < duration) {
      setTimeout(heavyChunk, 5);
    } else {
      stressing.value = false;
    }
  }
  heavyChunk();
}

function runImageProcess() {
  const canvas = originalCanvas.value;
  if (!canvas || !canvas.width || !canvas.height) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  imageLoading.value = true;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const worker = new Worker(
    new URL("../../workers/image.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (
    event: MessageEvent<{
      pixels: Uint8ClampedArray;
      width: number;
      height: number;
      duration: number;
    }>,
  ) => {
    const { pixels, width: w, height: h, duration } = event.data;
    const outCanvas = processedCanvas.value;
    if (outCanvas) {
      const outCtx = outCanvas.getContext("2d");
      if (outCtx) {
        const outData = new ImageData(new Uint8ClampedArray(pixels), w, h);
        outCtx.putImageData(outData, 0, 0);
      }
    }
    imageDuration.value = duration;
    imageLoading.value = false;
    worker.terminate();
  };
  worker.postMessage({ pixels: imageData.data, width, height });
}

const parallelResetting = ref(false);

function runParallelRace() {
  for (const w of parallelWorkerRefs) w.terminate();
  parallelWorkerRefs = [];

  parallelResetting.value = true;
  parallelLoading.value = true;
  parallelWorkers.value = [
    { percent: 0, elapsed: 0, done: false },
    { percent: 0, elapsed: 0, done: false },
    { percent: 0, elapsed: 0, done: false },
  ];

  requestAnimationFrame(() => {
    parallelResetting.value = false;
    let completedCount = 0;

    for (let i = 0; i < 3; i++) {
      const worker = new Worker(
        new URL("../../workers/parallel.worker.ts", import.meta.url),
        { type: "module" },
      );
      parallelWorkerRefs.push(worker);
      worker.onmessage = (
        event: MessageEvent<{
          id: number;
          percent: number;
          elapsed: number;
          totalDuration?: number;
        }>,
      ) => {
        const { id, percent, elapsed } = event.data;
        const entry = parallelWorkers.value[id];
        if (entry) {
          entry.percent = percent;
          entry.elapsed = elapsed;
          entry.done = percent >= 100;
        }
        if (percent >= 100) {
          completedCount++;
          worker.terminate();
          if (completedCount >= 3) parallelLoading.value = false;
        }
      };
      worker.postMessage({ id: i, difficulty: difficulties[i] });
    }
  }); // end requestAnimationFrame
}

function formatTime(ms: number) {
  return (ms / 1000).toFixed(1) + "s";
}
</script>

<template>
  <header>
    <a href="/vue" class="logo">
      <img src="/assets/png/absolutejs-temp.png" height="24" alt="AbsoluteJS" />
      AbsoluteJS
    </a>
    <nav>
      <a href="/">React</a>
      <a href="/svelte">Svelte</a>
      <a href="/vue" class="active">Vue</a>
      <a href="/angular">Angular</a>
      <a href="/html">HTML</a>
    </nav>
  </header>

  <main>
    <div class="page-title">
      <img src="/assets/svg/vue-logo.svg" height="32" alt="Vue" />
      <h1>Vue</h1>
    </div>

    <div class="worker-cards">
      <div class="worker-card">
        <div class="card-title">SHA-256 Hash</div>
        <p class="card-desc">
          Offload cryptographic hashing to a worker thread.
        </p>
        <button
          @click="runHash"
          :class="{ loading: hashLoading }"
          :disabled="hashLoading"
        >
          {{ hashLoading ? "Computing" : "Compute Hash" }}
        </button>
        <div class="worker-result">
          <div class="result-row">
            <span>Input</span
            ><span>{{ hashResult ? hashResult.input : "\u2014" }}</span>
          </div>
          <div class="result-row">
            <span>Hash</span
            ><span>{{
              hashResult ? `${hashResult.hash.slice(0, 16)}...` : "\u2014"
            }}</span>
          </div>
        </div>
      </div>

      <div class="worker-card">
        <div class="card-title">Prime Finder</div>
        <p class="card-desc">CPU-bound computation off the main thread.</p>
        <button
          @click="runPrime"
          :class="{ loading: primeLoading }"
          :disabled="primeLoading"
        >
          {{ primeLoading ? "Computing" : "Find 10,000th Prime" }}
        </button>
        <div class="worker-result">
          <div class="result-row">
            <span>Prime #10000</span
            ><span>{{
              primeResult ? primeResult.prime.toLocaleString() : "\u2014"
            }}</span>
          </div>
          <div class="result-row">
            <span>Duration</span
            ><span>{{
              primeResult ? `${primeResult.duration}ms` : "\u2014"
            }}</span>
          </div>
        </div>
      </div>

      <div class="worker-card">
        <div class="card-title">Sort Array</div>
        <p class="card-desc">Data processing without blocking the UI.</p>
        <button
          @click="runSort"
          :class="{ loading: sortLoading }"
          :disabled="sortLoading"
        >
          {{ sortLoading ? "Sorting" : "Sort 1M Numbers" }}
        </button>
        <div class="worker-result">
          <div class="result-row">
            <span>Min</span
            ><span>{{
              sortResult ? sortResult.min.toLocaleString() : "\u2014"
            }}</span>
          </div>
          <div class="result-row">
            <span>Max</span
            ><span>{{
              sortResult ? sortResult.max.toLocaleString() : "\u2014"
            }}</span>
          </div>
          <div class="result-row">
            <span>Median</span
            ><span>{{
              sortResult ? sortResult.median.toLocaleString() : "\u2014"
            }}</span>
          </div>
          <div class="result-row">
            <span>Duration</span
            ><span>{{
              sortResult ? `${sortResult.duration}ms` : "\u2014"
            }}</span>
          </div>
        </div>
      </div>

      <div class="worker-card">
        <div class="card-title">Thread Race</div>
        <p class="card-desc">Worker and main thread timers side by side.</p>
        <div class="race-bars">
          <div class="race-bar-row">
            <div class="race-bar-label">
              <span>Worker Timer</span>
              <span>{{ formatTime(workerTime) }}</span>
            </div>
            <div class="race-bar-track">
              <div
                class="race-bar-fill worker"
                :style="{
                  width: `${Math.min((workerTime / 10000) * 100, 100)}%`,
                }"
              ></div>
            </div>
          </div>
          <div class="race-bar-row">
            <div class="race-bar-label">
              <span>Main Thread</span>
              <span>{{ formatTime(mainTime) }}</span>
            </div>
            <div class="race-bar-track">
              <div
                class="race-bar-fill main-thread"
                :style="{
                  width: `${Math.min((mainTime / 10000) * 100, 100)}%`,
                }"
              ></div>
            </div>
          </div>
        </div>
        <div class="race-controls">
          <button @click="startRace" :disabled="racing">Start Race</button>
          <button @click="stopRace" :disabled="!racing">Stop Race</button>
          <button
            class="stress"
            @click="stressMainThread"
            :disabled="stressing || !racing"
          >
            {{ stressing ? "Stressing..." : "Stress Main Thread" }}
          </button>
        </div>
      </div>

      <div class="worker-card">
        <div class="card-title">Image Processing</div>
        <p class="card-desc">Grayscale conversion via worker on pixel data.</p>
        <label
          ref="uploadLabel"
          class="file-upload"
          @dragover="onImageDragOver"
          @dragleave="onImageDragLeave"
          @drop="onImageDrop"
        >
          <input type="file" accept="image/*" @change="onImageFileChange" />
          <span>{{ imageFileName ?? "Drop an image or click to upload" }}</span>
        </label>
        <button
          @click="runImageProcess"
          :class="{ loading: imageLoading }"
          :disabled="imageLoading || !imageLoaded"
        >
          {{
            imageLoading
              ? "Processing"
              : imageDuration !== null
                ? `Apply Grayscale \u2014 ${imageDuration}ms`
                : "Apply Grayscale"
          }}
        </button>
        <div class="canvas-row" v-show="imageLoaded">
          <canvas ref="originalCanvas" width="200" height="150"></canvas>
          <canvas ref="processedCanvas" width="200" height="150"></canvas>
        </div>
      </div>

      <div class="worker-card">
        <div class="card-title">Parallel Race</div>
        <p class="card-desc">
          3 workers with different workloads running simultaneously.
        </p>
        <button
          @click="runParallelRace"
          :class="{ loading: parallelLoading }"
          :disabled="parallelLoading"
        >
          {{ parallelLoading ? "Racing" : "Start Race" }}
        </button>
        <div class="parallel-workers">
          <div
            v-for="(w, i) in parallelWorkers"
            :key="i"
            class="parallel-worker"
          >
            <div class="parallel-worker-header">
              <span>{{ workerLabels[i] }}</span>
              <span>{{ w.elapsed > 0 ? `${w.elapsed}ms` : "" }}</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="{ done: w.done }"
                :style="{
                  width: `${w.percent}%`,
                  transition: parallelResetting ? 'none' : '',
                }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p class="footer">
      <img src="/assets/png/absolutejs-temp.png" alt="" />
      Powered by
      <a href="https://absolutejs.com" target="_blank" rel="noopener noreferrer"
        >AbsoluteJS</a
      >
    </p>
  </main>
</template>
