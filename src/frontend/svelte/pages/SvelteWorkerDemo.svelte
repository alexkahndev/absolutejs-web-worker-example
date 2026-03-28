<script lang="ts">
  import {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
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

  type WorkerDemoProps = {
    cssPath?: string;
  };

  let { cssPath }: WorkerDemoProps = $props();

  // Hash
  let hashResult = $state<{ hash: string; input: string } | null>(null);
  let hashLoading = $state(false);

  // Prime
  let primeResult = $state<{
    prime: number;
    n: number;
    duration: number;
  } | null>(null);
  let primeLoading = $state(false);

  // Sort
  let sortResult = $state<{
    size: number;
    min: number;
    max: number;
    median: number;
    duration: number;
  } | null>(null);
  let sortLoading = $state(false);

  // Thread Race
  let racing = $state(false);
  let workerTime = $state(0);
  let mainTime = $state(0);
  let timerWorker: Worker | null = null;
  let mainInterval: ReturnType<typeof setInterval> | null = null;

  // Image
  let imageLoading = $state(false);
  let imageDuration = $state<number | null>(null);
  let imageLoaded = $state(false);
  let imageFileName = $state<string | null>(null);
  let originalCanvas: HTMLCanvasElement;
  let processedCanvas: HTMLCanvasElement;
  let uploadLabel: HTMLLabelElement;

  // Parallel
  const difficulties = PARALLEL_DIFFICULTIES;
  const workerLabels = ["240K primes", "480K primes", "880K primes"];
  let parallelLoading = $state(false);
  let parallelResetting = $state(false);
  let parallelWorkers = $state([
    { percent: 0, elapsed: 0, done: false },
    { percent: 0, elapsed: 0, done: false },
    { percent: 0, elapsed: 0, done: false },
  ]);
  let parallelWorkerRefs: Worker[] = [];

  function startRace() {
    racing = true;
    workerTime = 0;
    mainTime = 0;

    const worker = new Worker(
      new URL("../../workers/timer.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<{ elapsed: number }>) => {
      workerTime = event.data.elapsed;
    };
    worker.postMessage({ command: "start" });
    timerWorker = worker;

    let mainElapsed = 0;
    mainInterval = setInterval(() => {
      mainElapsed += MAIN_TIMER_INTERVAL_MS;
      mainTime = mainElapsed;
    }, MAIN_TIMER_INTERVAL_MS);
  }

  function stopRace() {
    racing = false;
    timerWorker?.postMessage({ command: "stop" });
    timerWorker?.terminate();
    timerWorker = null;
    if (mainInterval) clearInterval(mainInterval);
    mainInterval = null;
  }

  const CANVAS_W = CANVAS_WIDTH;
  const CANVAS_H = CANVAS_HEIGHT;

  function loadImageFile(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ctx = originalCanvas.getContext("2d")!;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
      processedCanvas.getContext("2d")!.clearRect(0, 0, CANVAS_W, CANVAS_H);
      URL.revokeObjectURL(url);
      imageLoaded = true;
      imageFileName = file.name;
      imageDuration = null;
    };
    img.src = url;
  }

  $effect(() => {
    return () => {
      timerWorker?.terminate();
      if (mainInterval) clearInterval(mainInterval);
    };
  });

  function runHash() {
    hashLoading = true;
    const worker = new Worker(
      new URL("../../workers/hash.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (
      event: MessageEvent<{ hash: string; input: string }>,
    ) => {
      hashResult = event.data;
      hashLoading = false;
      worker.terminate();
    };
    worker.postMessage({ text: "Hello, World!" });
  }

  function runPrime() {
    primeLoading = true;
    const worker = new Worker(
      new URL("../../workers/prime.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (
      event: MessageEvent<{ prime: number; n: number; duration: number }>,
    ) => {
      primeResult = event.data;
      primeLoading = false;
      worker.terminate();
    };
    worker.postMessage({ n: 10000 });
  }

  function runSort() {
    sortLoading = true;
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
      sortResult = event.data;
      sortLoading = false;
      worker.terminate();
    };
    worker.postMessage({ size: 1000000 });
  }

  let stressing = $state(false);

  function stressMainThread() {
    if (stressing) return;
    stressing = true;
    const duration = 8000;
    const start = Date.now();
    function heavyChunk() {
      const chunkEnd = Date.now() + STRESS_CHUNK_MS;
      while (Date.now() < chunkEnd) {
        Math.sqrt(Math.random() * STRESS_RANDOM_MAX);
      }
      if (Date.now() - start < duration) {
        setTimeout(heavyChunk, STRESS_YIELD_MS);
      } else {
        stressing = false;
      }
    }
    heavyChunk();
  }

  function runImageProcess() {
    if (!originalCanvas || !originalCanvas.width || !originalCanvas.height)
      return;
    const ctx = originalCanvas.getContext("2d");
    if (!ctx) return;
    imageLoading = true;
    const { width, height } = originalCanvas;
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
      if (processedCanvas) {
        const outCtx = processedCanvas.getContext("2d");
        if (outCtx) {
          const outData = new ImageData(new Uint8ClampedArray(pixels), w, h);
          outCtx.putImageData(outData, 0, 0);
        }
      }
      imageDuration = duration;
      imageLoading = false;
      worker.terminate();
    };
    worker.postMessage({ pixels: imageData.data, width, height });
  }

  function runParallelRace() {
    for (const w of parallelWorkerRefs) w.terminate();
    parallelWorkerRefs = [];

    parallelResetting = true;
    parallelLoading = true;
    parallelWorkers = [
      { percent: 0, elapsed: 0, done: false },
      { percent: 0, elapsed: 0, done: false },
      { percent: 0, elapsed: 0, done: false },
    ];

    requestAnimationFrame(() => {
      parallelResetting = false;
      let completedCount = 0;

      for (let i = 0; i < PARALLEL_WORKER_COUNT; i++) {
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
          const entry = parallelWorkers[id];
          if (entry) {
            entry.percent = percent;
            entry.elapsed = elapsed;
            entry.done = percent >= PERCENTAGE_FULL;
          }
          if (percent >= PERCENTAGE_FULL) {
            completedCount++;
            worker.terminate();
            if (completedCount >= PARALLEL_WORKER_COUNT)
              parallelLoading = false;
          }
        };
        worker.postMessage({ id: i, difficulty: difficulties[i] });
      }
    }); // end requestAnimationFrame
  }

  function formatTime(ms: number) {
    return (ms / MS_PER_SECOND).toFixed(1) + "s";
  }
</script>

<svelte:head>
  <meta charset="utf-8" />
  <title>AbsoluteJS Workers - Svelte</title>
  <meta
    name="description"
    content="Web workers with Svelte, powered by AbsoluteJS."
  />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="/assets/ico/favicon.ico" />
  {#if cssPath}
    <link rel="stylesheet" href={cssPath} type="text/css" />
  {/if}
</svelte:head>

<header>
  <a href="/svelte" class="logo">
    <img src="/assets/png/absolutejs-temp.png" height="24" alt="AbsoluteJS" />
    AbsoluteJS
  </a>
  <nav>
    <a href="/">React</a>
    <a href="/svelte" class="active">Svelte</a>
    <a href="/vue">Vue</a>
    <a href="/angular">Angular</a>
    <a href="/html">HTML</a>
  </nav>
</header>

<main>
  <div class="page-title">
    <img src="/assets/svg/svelte-logo.svg" height="32" alt="Svelte" />
    <h1>Svelte</h1>
  </div>

  <div class="worker-cards">
    <div class="worker-card">
      <div class="card-title">SHA-256 Hash</div>
      <p class="card-desc">Offload cryptographic hashing to a worker thread.</p>
      <button
        onclick={runHash}
        class:loading={hashLoading}
        disabled={hashLoading}
      >
        {hashLoading ? "Computing" : "Compute Hash"}
      </button>
      <div class="worker-result">
        <div class="result-row">
          <span>Input</span><span
            >{hashResult ? hashResult.input : "\u2014"}</span
          >
        </div>
        <div class="result-row">
          <span>Hash</span><span
            >{hashResult
              ? `${hashResult.hash.slice(0, HASH_PREVIEW_LENGTH)}...`
              : "\u2014"}</span
          >
        </div>
      </div>
    </div>

    <div class="worker-card">
      <div class="card-title">Prime Finder</div>
      <p class="card-desc">CPU-bound computation off the main thread.</p>
      <button
        onclick={runPrime}
        class:loading={primeLoading}
        disabled={primeLoading}
      >
        {primeLoading ? "Computing" : "Find 10,000th Prime"}
      </button>
      <div class="worker-result">
        <div class="result-row">
          <span>Prime #10000</span><span
            >{primeResult ? primeResult.prime.toLocaleString() : "\u2014"}</span
          >
        </div>
        <div class="result-row">
          <span>Duration</span><span
            >{primeResult ? `${primeResult.duration}ms` : "\u2014"}</span
          >
        </div>
      </div>
    </div>

    <div class="worker-card">
      <div class="card-title">Sort Array</div>
      <p class="card-desc">Data processing without blocking the UI.</p>
      <button
        onclick={runSort}
        class:loading={sortLoading}
        disabled={sortLoading}
      >
        {sortLoading ? "Sorting" : "Sort 1M Numbers"}
      </button>
      <div class="worker-result">
        <div class="result-row">
          <span>Min</span><span
            >{sortResult ? sortResult.min.toLocaleString() : "\u2014"}</span
          >
        </div>
        <div class="result-row">
          <span>Max</span><span
            >{sortResult ? sortResult.max.toLocaleString() : "\u2014"}</span
          >
        </div>
        <div class="result-row">
          <span>Median</span><span
            >{sortResult ? sortResult.median.toLocaleString() : "\u2014"}</span
          >
        </div>
        <div class="result-row">
          <span>Duration</span><span
            >{sortResult ? `${sortResult.duration}ms` : "\u2014"}</span
          >
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
            <span>{formatTime(workerTime)}</span>
          </div>
          <div class="race-bar-track">
            <div
              class="race-bar-fill worker"
              style="width: {Math.min(
                (workerTime / RACE_BAR_MAX_MS) * PERCENTAGE_FULL,
                PERCENTAGE_FULL,
              )}%"
            ></div>
          </div>
        </div>
        <div class="race-bar-row">
          <div class="race-bar-label">
            <span>Main Thread</span>
            <span>{formatTime(mainTime)}</span>
          </div>
          <div class="race-bar-track">
            <div
              class="race-bar-fill main-thread"
              style="width: {Math.min(
                (mainTime / RACE_BAR_MAX_MS) * PERCENTAGE_FULL,
                PERCENTAGE_FULL,
              )}%"
            ></div>
          </div>
        </div>
      </div>
      <div class="race-controls">
        <button onclick={startRace} disabled={racing}>Start Race</button>
        <button onclick={stopRace} disabled={!racing}>Stop Race</button>
        <button
          class="stress"
          onclick={stressMainThread}
          disabled={stressing || !racing}
        >
          {stressing ? "Stressing..." : "Stress Main Thread"}
        </button>
      </div>
    </div>

    <div class="worker-card">
      <div class="card-title">Image Processing</div>
      <p class="card-desc">Grayscale conversion via worker on pixel data.</p>
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <label
        bind:this={uploadLabel}
        class="file-upload"
        ondragover={(e: DragEvent) => {
          e.preventDefault();
          uploadLabel?.classList.add("dragover");
        }}
        ondragleave={() => uploadLabel?.classList.remove("dragover")}
        ondrop={(e: DragEvent) => {
          e.preventDefault();
          uploadLabel?.classList.remove("dragover");
          const f = e.dataTransfer?.files[0];
          if (f && f.type.startsWith("image/")) loadImageFile(f);
        }}
      >
        <input
          type="file"
          accept="image/*"
          onchange={(e) => {
            const input = e.currentTarget;
            if (input instanceof HTMLInputElement) {
              const f = input.files?.[0];
              if (f) loadImageFile(f);
            }
          }}
        />
        <span>{imageFileName ?? "Drop an image or click to upload"}</span>
      </label>
      <button
        onclick={runImageProcess}
        class:loading={imageLoading}
        disabled={imageLoading || !imageLoaded}
      >
        {imageLoading
          ? "Processing"
          : imageDuration !== null
            ? `Apply Grayscale \u2014 ${imageDuration}ms`
            : "Apply Grayscale"}
      </button>
      <div class="canvas-row" style:display={imageLoaded ? "flex" : "none"}>
        <canvas bind:this={originalCanvas} width="200" height="150"></canvas>
        <canvas bind:this={processedCanvas} width="200" height="150"></canvas>
      </div>
    </div>

    <div class="worker-card">
      <div class="card-title">Parallel Race</div>
      <p class="card-desc">
        3 workers with different workloads running simultaneously.
      </p>
      <button
        onclick={runParallelRace}
        class:loading={parallelLoading}
        disabled={parallelLoading}
      >
        {parallelLoading ? "Racing" : "Start Race"}
      </button>
      <div class="parallel-workers">
        {#each parallelWorkers as w, i}
          <div class="parallel-worker">
            <div class="parallel-worker-header">
              <span>{workerLabels[i]}</span>
              <span>{w.elapsed > 0 ? `${w.elapsed}ms` : ""}</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                class:done={w.done}
                style="width: {w.percent}%; {parallelResetting
                  ? 'transition: none'
                  : ''}"
              ></div>
            </div>
          </div>
        {/each}
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
