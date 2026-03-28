import {
  HASH_PREVIEW_LENGTH,
  MAIN_TIMER_INTERVAL_MS,
  MS_PER_SECOND,
  PARALLEL_DIFFICULTIES,
  PARALLEL_WORKER_COUNT,
  PERCENTAGE_FULL,
  RACE_BAR_MAX_MS,
  STRESS_CHUNK_MS,
  STRESS_RANDOM_MAX,
  STRESS_YIELD_MS,
} from "../../constants";

const getElement = <T extends HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);

  return element;
};

// Hash
const hashBtn = getElement<HTMLButtonElement>("#run-hash");
const hashResultDiv = getElement<HTMLDivElement>("#hash-result");

hashBtn.addEventListener("click", () => {
  hashBtn.classList.add("loading");
  hashBtn.disabled = true;
  hashBtn.textContent = "Computing";
  const worker = new Worker(
    new URL("../workers/hash.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (event: MessageEvent<{ hash: string; input: string }>) => {
    const { hash, input } = event.data;
    hashResultDiv.innerHTML = `
			<div class="result-row"><span>Input</span><span>${input}</span></div>
			<div class="result-row"><span>Hash</span><span>${hash.slice(0, HASH_PREVIEW_LENGTH)}...</span></div>
		`;

    hashBtn.classList.remove("loading");
    hashBtn.disabled = false;
    hashBtn.textContent = "Compute Hash";
    worker.terminate();
  };
  worker.postMessage({ text: "Hello, World!" });
});

// Prime
const primeBtn = getElement<HTMLButtonElement>("#run-prime");
const primeResultDiv = getElement<HTMLDivElement>("#prime-result");

primeBtn.addEventListener("click", () => {
  primeBtn.classList.add("loading");
  primeBtn.disabled = true;
  primeBtn.textContent = "Computing";
  const worker = new Worker(
    new URL("../workers/prime.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (
    event: MessageEvent<{ prime: number; n: number; duration: number }>,
  ) => {
    const { prime, n: nthPrime, duration } = event.data;
    primeResultDiv.innerHTML = `
			<div class="result-row"><span>Prime #${nthPrime}</span><span>${prime.toLocaleString()}</span></div>
			<div class="result-row"><span>Duration</span><span>${duration}ms</span></div>
		`;

    primeBtn.classList.remove("loading");
    primeBtn.disabled = false;
    primeBtn.textContent = "Find 10,000th Prime";
    worker.terminate();
  };
  worker.postMessage({ n: 10000 });
});

// Sort
const sortBtn = getElement<HTMLButtonElement>("#run-sort");
const sortResultDiv = getElement<HTMLDivElement>("#sort-result");

sortBtn.addEventListener("click", () => {
  sortBtn.classList.add("loading");
  sortBtn.disabled = true;
  sortBtn.textContent = "Sorting";
  const worker = new Worker(
    new URL("../workers/sort.worker.ts", import.meta.url),
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
    const { min, max, median, duration } = event.data;
    sortResultDiv.innerHTML = `
			<div class="result-row"><span>Min</span><span>${min.toLocaleString()}</span></div>
			<div class="result-row"><span>Max</span><span>${max.toLocaleString()}</span></div>
			<div class="result-row"><span>Median</span><span>${median.toLocaleString()}</span></div>
			<div class="result-row"><span>Duration</span><span>${duration}ms</span></div>
		`;

    sortBtn.classList.remove("loading");
    sortBtn.disabled = false;
    sortBtn.textContent = "Sort 1M Numbers";
    worker.terminate();
  };
  worker.postMessage({ size: 1000000 });
});

// Thread Race
const workerTimeEl = getElement<HTMLSpanElement>("#worker-time");
const mainTimeEl = getElement<HTMLSpanElement>("#main-time");
const workerBar = getElement<HTMLDivElement>("#worker-bar");
const mainBar = getElement<HTMLDivElement>("#main-bar");
const startRaceBtn = getElement<HTMLButtonElement>("#start-race");
const stopRaceBtn = getElement<HTMLButtonElement>("#stop-race");
const freezeBtn = getElement<HTMLButtonElement>("#freeze-btn");

let timerWorker: Worker | null = null;
let mainInterval: ReturnType<typeof setInterval> | null = null;

startRaceBtn.addEventListener("click", () => {
  startRaceBtn.disabled = true;
  stopRaceBtn.disabled = false;
  freezeBtn.disabled = false;

  workerTimeEl.textContent = "0.0s";
  mainTimeEl.textContent = "0.0s";
  workerBar.style.width = "0%";
  mainBar.style.width = "0%";

  const worker = new Worker(
    new URL("../workers/timer.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (event: MessageEvent<{ elapsed: number }>) => {
    const { elapsed } = event.data;
    workerTimeEl.textContent = `${(elapsed / MS_PER_SECOND).toFixed(1)}s`;
    workerBar.style.width = `${Math.min((elapsed / RACE_BAR_MAX_MS) * PERCENTAGE_FULL, PERCENTAGE_FULL)}%`;
  };
  worker.postMessage({ command: "start" });
  timerWorker = worker;

  let mainElapsed = 0;
  mainInterval = setInterval(() => {
    mainElapsed += MAIN_TIMER_INTERVAL_MS;
    mainTimeEl.textContent = `${(mainElapsed / MS_PER_SECOND).toFixed(1)}s`;
    mainBar.style.width = `${Math.min((mainElapsed / RACE_BAR_MAX_MS) * PERCENTAGE_FULL, PERCENTAGE_FULL)}%`;
  }, MAIN_TIMER_INTERVAL_MS);
});

stopRaceBtn.addEventListener("click", () => {
  startRaceBtn.disabled = false;
  stopRaceBtn.disabled = true;
  freezeBtn.disabled = true;
  timerWorker?.postMessage({ command: "stop" });
  timerWorker?.terminate();
  timerWorker = null;
  if (mainInterval) clearInterval(mainInterval);
  mainInterval = null;
});

freezeBtn.addEventListener("click", () => {
  if (freezeBtn.disabled) return;
  freezeBtn.disabled = true;
  freezeBtn.textContent = "Stressing...";
  const duration = 8000;
  const start = Date.now();
  const heavyChunk = () => {
    const chunkEnd = Date.now() + STRESS_CHUNK_MS;
    while (Date.now() < chunkEnd) {
      Math.sqrt(Math.random() * STRESS_RANDOM_MAX);
    }
    if (Date.now() - start < duration) {
      setTimeout(heavyChunk, STRESS_YIELD_MS);
    } else {
      freezeBtn.disabled = false;
      freezeBtn.textContent = "Stress Main Thread";
    }
  };
  heavyChunk();
});

// Image
const originalCanvas = getElement<HTMLCanvasElement>("#original-canvas");
const processedCanvas = getElement<HTMLCanvasElement>("#processed-canvas");
const imageBtn = getElement<HTMLButtonElement>("#run-image");
const imageInput = getElement<HTMLInputElement>("#image-input");
const imageUpload = getElement<HTMLLabelElement>("#image-upload");

const CANVAS_W = 200;
const CANVAS_H = 150;
originalCanvas.width = CANVAS_W;
originalCanvas.height = CANVAS_H;
processedCanvas.width = CANVAS_W;
processedCanvas.height = CANVAS_H;

const loadImageToCanvas = (file: File) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const ctx = originalCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    // Scale image to fit canvas while preserving aspect ratio
    const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    ctx.drawImage(
      img,
      (CANVAS_W - scaledWidth) / 2,
      (CANVAS_H - scaledHeight) / 2,
      scaledWidth,
      scaledHeight,
    );
    processedCanvas.getContext("2d")?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    URL.revokeObjectURL(url);
    imageBtn.disabled = false;
    imageBtn.textContent = "Apply Grayscale";
    const canvasRow = originalCanvas.closest<HTMLElement>(".canvas-row");
    if (canvasRow) canvasRow.style.display = "flex";
    const uploadSpan = imageUpload.querySelector("span");
    if (uploadSpan) uploadSpan.textContent = file.name;
  };
  img.src = url;
};

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (file) loadImageToCanvas(file);
});

imageUpload.addEventListener("dragover", (event) => {
  event.preventDefault();
  imageUpload.classList.add("dragover");
});
imageUpload.addEventListener("dragleave", () =>
  imageUpload.classList.remove("dragover"),
);
imageUpload.addEventListener("drop", (event) => {
  event.preventDefault();
  imageUpload.classList.remove("dragover");
  const file = event.dataTransfer?.files[0];
  if (file && file.type.startsWith("image/")) loadImageToCanvas(file);
});

imageBtn.addEventListener("click", () => {
  const ctx = originalCanvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = originalCanvas;
  if (!width || !height) return;
  imageBtn.classList.add("loading");
  imageBtn.disabled = true;
  imageBtn.textContent = "Processing";
  const imageData = ctx.getImageData(0, 0, width, height);
  const worker = new Worker(
    new URL("../workers/image.worker.ts", import.meta.url),
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
    const { pixels, width: imgWidth, height: imgHeight, duration } = event.data;
    const outCtx = processedCanvas.getContext("2d");
    if (!outCtx) return;
    const outData = new ImageData(
      new Uint8ClampedArray(pixels),
      imgWidth,
      imgHeight,
    );
    outCtx.putImageData(outData, 0, 0);
    imageBtn.classList.remove("loading");
    imageBtn.disabled = false;
    imageBtn.textContent = `Apply Grayscale — ${duration}ms`;
    worker.terminate();
  };
  worker.postMessage({ height, pixels: imageData.data, width });
});

// Parallel Race
const parallelBtn = getElement<HTMLButtonElement>("#run-parallel");
const difficulties = PARALLEL_DIFFICULTIES;
let parallelWorkerRefs: Worker[] = [];

const handleParallelMessage = (
  worker: Worker,
  completedCount: { value: number },
  event: MessageEvent<{
    id: number;
    percent: number;
    elapsed: number;
    totalDuration?: number;
  }>,
) => {
  const { id, percent, elapsed } = event.data;
  const fill = getElement<HTMLDivElement>(`#pw-fill-${id}`);
  fill.style.width = `${percent}%`;

  const statusEl = getElement<HTMLSpanElement>(`#pw-status-${id}`);
  if (percent < PERCENTAGE_FULL) {
    statusEl.textContent = elapsed > 0 ? `${elapsed}ms` : "";

    return;
  }
  fill.classList.add("done");
  statusEl.textContent = `${elapsed}ms`;
  completedCount.value++;
  worker.terminate();
  if (completedCount.value < PARALLEL_WORKER_COUNT) return;
  parallelBtn.classList.remove("loading");
  parallelBtn.disabled = false;
  parallelBtn.textContent = "Start Race";
};

const startParallelRace = () => {
  for (const worker of parallelWorkerRefs) worker.terminate();
  parallelWorkerRefs = [];

  parallelBtn.classList.add("loading");
  parallelBtn.disabled = true;
  parallelBtn.textContent = "Racing";

  // Reset progress (disable transition so bars snap to 0)
  for (let idx = 0; idx < PARALLEL_WORKER_COUNT; idx++) {
    const statusEl = getElement<HTMLSpanElement>(`#pw-status-${idx}`);
    statusEl.textContent = "";
    const fill = getElement<HTMLDivElement>(`#pw-fill-${idx}`);
    fill.style.transition = "none";
    fill.style.width = "0%";
    fill.classList.remove("done");
  }
  // Force reflow then re-enable transitions
  void document.body.offsetHeight;
  for (let idx = 0; idx < PARALLEL_WORKER_COUNT; idx++) {
    getElement<HTMLDivElement>(`#pw-fill-${idx}`).style.transition = "";
  }

  const completedCount: { value: number } = { value: 0 };

  for (let idx = 0; idx < PARALLEL_WORKER_COUNT; idx++) {
    const worker = new Worker(
      new URL("../workers/parallel.worker.ts", import.meta.url),
      { type: "module" },
    );
    parallelWorkerRefs.push(worker);
    worker.onmessage = (event) =>
      handleParallelMessage(worker, completedCount, event);
    worker.postMessage({ difficulty: difficulties[idx], id: idx });
  }
};

parallelBtn.addEventListener("click", startParallelRace);
