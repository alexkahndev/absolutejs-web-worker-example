import { type RefObject, useCallback, useRef, useState } from "react";
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
import { Head } from "../components/Head";

type HashResult = { hash: string; input: string };
type PrimeResult = { prime: number; n: number; duration: number };
type SortResult = {
  size: number;
  min: number;
  max: number;
  median: number;
  duration: number;
};
type ParallelWorkerState = {
  percent: number;
  elapsed: number;
  done: boolean;
};

type WorkerDemoProps = {
  cssPath?: string;
};

const HashCard = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HashResult | null>(null);

  const runHash = useCallback(() => {
    setLoading(true);
    const worker = new Worker(
      new URL("../../workers/hash.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<HashResult>) => {
      setResult(event.data);
      setLoading(false);
      worker.terminate();
    };
    worker.postMessage({ text: "Hello, World!" });
  }, []);

  return (
    <div className="worker-card">
      <div className="card-title">SHA-256 Hash</div>
      <p className="card-desc">
        Offload cryptographic hashing to a worker thread.
      </p>
      <button
        className={loading ? "loading" : ""}
        disabled={loading}
        onClick={runHash}
      >
        {loading ? "Computing" : "Compute Hash"}
      </button>
      <div className="worker-result">
        <div className="result-row">
          <span>Input</span>
          <span>{result ? result.input : "\u2014"}</span>
        </div>
        <div className="result-row">
          <span>Hash</span>
          <span>
            {result
              ? `${result.hash.slice(0, HASH_PREVIEW_LENGTH)}...`
              : "\u2014"}
          </span>
        </div>
      </div>
    </div>
  );
};

const PrimeCard = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrimeResult | null>(null);

  const runPrime = useCallback(() => {
    setLoading(true);
    const worker = new Worker(
      new URL("../../workers/prime.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<PrimeResult>) => {
      setResult(event.data);
      setLoading(false);
      worker.terminate();
    };
    worker.postMessage({ n: 10000 });
  }, []);

  return (
    <div className="worker-card">
      <div className="card-title">Prime Finder</div>
      <p className="card-desc">CPU-bound computation off the main thread.</p>
      <button
        className={loading ? "loading" : ""}
        disabled={loading}
        onClick={runPrime}
      >
        {loading ? "Computing" : "Find 10,000th Prime"}
      </button>
      <div className="worker-result">
        <div className="result-row">
          <span>Prime #10000</span>
          <span>{result ? result.prime.toLocaleString() : "\u2014"}</span>
        </div>
        <div className="result-row">
          <span>Duration</span>
          <span>{result ? `${result.duration}ms` : "\u2014"}</span>
        </div>
      </div>
    </div>
  );
};

const SortCard = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SortResult | null>(null);

  const runSort = useCallback(() => {
    setLoading(true);
    const worker = new Worker(
      new URL("../../workers/sort.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<SortResult>) => {
      setResult(event.data);
      setLoading(false);
      worker.terminate();
    };
    worker.postMessage({ size: 1000000 });
  }, []);

  return (
    <div className="worker-card">
      <div className="card-title">Sort Array</div>
      <p className="card-desc">Data processing without blocking the UI.</p>
      <button
        className={loading ? "loading" : ""}
        disabled={loading}
        onClick={runSort}
      >
        {loading ? "Sorting" : "Sort 1M Numbers"}
      </button>
      <div className="worker-result">
        <div className="result-row">
          <span>Min</span>
          <span>{result ? result.min.toLocaleString() : "\u2014"}</span>
        </div>
        <div className="result-row">
          <span>Max</span>
          <span>{result ? result.max.toLocaleString() : "\u2014"}</span>
        </div>
        <div className="result-row">
          <span>Median</span>
          <span>{result ? result.median.toLocaleString() : "\u2014"}</span>
        </div>
        <div className="result-row">
          <span>Duration</span>
          <span>{result ? `${result.duration}ms` : "\u2014"}</span>
        </div>
      </div>
    </div>
  );
};

type ThreadRaceCardProps = {
  racing: boolean;
  stressing: boolean;
  workerTime: number;
  mainTime: number;
  workerBarRef: RefObject<HTMLDivElement | null>;
  workerTimeRef: RefObject<HTMLSpanElement | null>;
  mainBarRef: RefObject<HTMLDivElement | null>;
  mainTimeLabelRef: RefObject<HTMLSpanElement | null>;
  formatTime: (milliseconds: number) => string;
  onStart: () => void;
  onStop: () => void;
  onStress: () => void;
};

const ThreadRaceCard = ({
  racing,
  stressing,
  workerTime,
  mainTime,
  workerBarRef,
  workerTimeRef,
  mainBarRef,
  mainTimeLabelRef,
  formatTime,
  onStart,
  onStop,
  onStress,
}: ThreadRaceCardProps) => (
  <div className="worker-card">
    <div className="card-title">Thread Race</div>
    <p className="card-desc">Worker and main thread timers side by side.</p>
    <div className="race-bars">
      <div className="race-bar-row">
        <div className="race-bar-label">
          <span>Worker Timer</span>
          <span ref={workerTimeRef}>{formatTime(workerTime)}</span>
        </div>
        <div className="race-bar-track">
          <div
            className="race-bar-fill worker"
            ref={workerBarRef}
            style={{
              width: `${Math.min((workerTime / RACE_BAR_MAX_MS) * PERCENTAGE_FULL, PERCENTAGE_FULL)}%`,
            }}
          />
        </div>
      </div>
      <div className="race-bar-row">
        <div className="race-bar-label">
          <span>Main Thread</span>
          <span ref={mainTimeLabelRef}>{formatTime(mainTime)}</span>
        </div>
        <div className="race-bar-track">
          <div
            className="race-bar-fill main-thread"
            ref={mainBarRef}
            style={{
              width: `${Math.min((mainTime / RACE_BAR_MAX_MS) * PERCENTAGE_FULL, PERCENTAGE_FULL)}%`,
            }}
          />
        </div>
      </div>
    </div>
    <div className="race-controls">
      <button disabled={racing} onClick={onStart}>
        Start Race
      </button>
      <button disabled={!racing} onClick={onStop}>
        Stop Race
      </button>
      <button
        className="stress"
        disabled={stressing || !racing}
        onClick={onStress}
      >
        {stressing ? "Stressing..." : "Stress Main Thread"}
      </button>
    </div>
  </div>
);

type ImageCardProps = {
  loading: boolean;
  duration: number | null;
  imageLoaded: boolean;
  imageFileName: string | null;
  originalCanvasRef: RefObject<HTMLCanvasElement | null>;
  processedCanvasRef: RefObject<HTMLCanvasElement | null>;
  onRun: () => void;
  onFileLoad: (file: File) => void;
};

const ImageCard = ({
  loading,
  duration,
  imageLoaded,
  imageFileName,
  originalCanvasRef,
  processedCanvasRef,
  onRun,
  onFileLoad,
}: ImageCardProps) => {
  const uploadRef = useRef<HTMLLabelElement>(null);

  return (
    <div className="worker-card">
      <div className="card-title">Image Processing</div>
      <p className="card-desc">
        Grayscale conversion via worker on pixel data.
      </p>
      <label
        className="file-upload"
        onDragLeave={() => uploadRef.current?.classList.remove("dragover")}
        onDragOver={(event) => {
          event.preventDefault();
          uploadRef.current?.classList.add("dragover");
        }}
        onDrop={(event) => {
          event.preventDefault();
          uploadRef.current?.classList.remove("dragover");
          const file = event.dataTransfer?.files[0];
          if (file && file.type.startsWith("image/")) onFileLoad(file);
        }}
        ref={uploadRef}
      >
        <input
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFileLoad(file);
          }}
          type="file"
        />
        <span>{imageFileName ?? "Drop an image or click to upload"}</span>
      </label>
      <button
        className={loading ? "loading" : ""}
        disabled={loading || !imageLoaded}
        onClick={onRun}
      >
        {loading && "Processing"}
        {!loading &&
          (duration !== null
            ? `Apply Grayscale \u2014 ${duration}ms`
            : "Apply Grayscale")}
      </button>
      <div
        className="canvas-row"
        style={imageLoaded ? {} : { display: "none" }}
      >
        <canvas
          height={CANVAS_HEIGHT}
          ref={originalCanvasRef}
          width={CANVAS_WIDTH}
        />
        <canvas
          height={CANVAS_HEIGHT}
          ref={processedCanvasRef}
          width={CANVAS_WIDTH}
        />
      </div>
    </div>
  );
};

type ParallelCardProps = {
  loading: boolean;
  resetting: boolean;
  workers: ParallelWorkerState[];
  onRun: () => void;
};

const ParallelCard = ({
  loading,
  resetting,
  workers,
  onRun,
}: ParallelCardProps) => {
  const labels = ["240K primes", "480K primes", "880K primes"];

  return (
    <div className="worker-card">
      <div className="card-title">Parallel Race</div>
      <p className="card-desc">
        3 workers with different workloads running simultaneously.
      </p>
      <button
        className={loading ? "loading" : ""}
        disabled={loading}
        onClick={onRun}
      >
        {loading ? "Racing" : "Start Race"}
      </button>
      <div className="parallel-workers">
        {workers.map((worker, idx) => (
          <div className="parallel-worker" key={idx}>
            <div className="parallel-worker-header">
              <span>{labels[idx]}</span>
              <span>{worker.elapsed > 0 ? `${worker.elapsed}ms` : ""}</span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill ${worker.done ? "done" : ""}`}
                style={{
                  width: `${worker.percent}%`,
                  ...(resetting ? { transition: "none" } : {}),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Nav = () => (
  <header>
    <a className="logo" href="/">
      <img alt="AbsoluteJS" height={24} src="/assets/png/absolutejs-temp.png" />
      AbsoluteJS
    </a>
    <nav>
      <a className="active" href="/">
        React
      </a>
      <a href="/svelte">Svelte</a>
      <a href="/vue">Vue</a>
      <a href="/angular">Angular</a>
      <a href="/html">HTML</a>
    </nav>
  </header>
);

const WorkerDemoApp = () => {
  // Thread Race
  const [racing, setRacing] = useState(false);
  const [workerTime, setWorkerTime] = useState(0);
  const [mainTime, setMainTime] = useState(0);
  const [stressing, setStressing] = useState(false);
  const timerWorkerRef = useRef<Worker | null>(null);
  const mainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainTimeRef = useRef(0);

  const [imageLoading, setImageLoading] = useState(false);
  const [imageDuration, setImageDuration] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [parallelLoading, setParallelLoading] = useState(false);
  const [parallelResetting, setParallelResetting] = useState(false);
  const [parallelWorkers, setParallelWorkers] = useState<ParallelWorkerState[]>(
    [
      { done: false, elapsed: 0, percent: 0 },
      { done: false, elapsed: 0, percent: 0 },
      { done: false, elapsed: 0, percent: 0 },
    ],
  );

  const CANVAS_W = CANVAS_WIDTH;
  const CANVAS_H = CANVAS_HEIGHT;

  const loadImageFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = originalCanvasRef.current;
      const processed = processedCanvasRef.current;
      if (canvas && processed) {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
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
        processed.getContext("2d")?.clearRect(0, 0, CANVAS_W, CANVAS_H);
      }
      URL.revokeObjectURL(url);
      setImageLoaded(true);
      setImageFileName(file.name);
      setImageDuration(null);
    };
    img.src = url;
  }, []);

  const workerBarRef = useRef<HTMLDivElement>(null);
  const workerTimeRef = useRef<HTMLSpanElement>(null);
  const mainBarRef = useRef<HTMLDivElement>(null);
  const mainTimeLabelRef = useRef<HTMLSpanElement>(null);

  const startRace = useCallback(() => {
    setRacing(true);
    setWorkerTime(0);
    setMainTime(0);
    mainTimeRef.current = 0;

    // Start worker timer — update DOM directly for smoothest visual
    const worker = new Worker(
      new URL("../../workers/timer.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<{ elapsed: number }>) => {
      const { elapsed } = event.data;
      setWorkerTime(elapsed);
      // Direct DOM update bypasses React batching
      if (workerBarRef.current)
        workerBarRef.current.style.width = `${Math.min((elapsed / RACE_BAR_MAX_MS) * PERCENTAGE_FULL, PERCENTAGE_FULL)}%`;
      if (workerTimeRef.current)
        workerTimeRef.current.textContent = `${(elapsed / MS_PER_SECOND).toFixed(1)}s`;
    };
    worker.postMessage({ command: "start" });
    timerWorkerRef.current = worker;

    // Main thread timer — also direct DOM update
    let mainElapsed = 0;
    mainIntervalRef.current = setInterval(() => {
      mainElapsed += MAIN_TIMER_INTERVAL_MS;
      mainTimeRef.current = mainElapsed;
      setMainTime(mainElapsed);
      if (mainBarRef.current)
        mainBarRef.current.style.width = `${Math.min((mainElapsed / RACE_BAR_MAX_MS) * PERCENTAGE_FULL, PERCENTAGE_FULL)}%`;
      if (mainTimeLabelRef.current)
        mainTimeLabelRef.current.textContent = `${(mainElapsed / MS_PER_SECOND).toFixed(1)}s`;
    }, MAIN_TIMER_INTERVAL_MS);
  }, []);

  const stopRace = useCallback(() => {
    setRacing(false);
    timerWorkerRef.current?.postMessage({ command: "stop" });
    timerWorkerRef.current?.terminate();
    timerWorkerRef.current = null;
    if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
    mainIntervalRef.current = null;
  }, []);

  const stressMainThread = useCallback(() => {
    setStressing(true);
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
        setStressing(false);
      }
    };
    heavyChunk();
  }, []);

  const runImageProcess = useCallback(() => {
    const canvas = originalCanvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setImageLoading(true);
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
      const {
        pixels,
        width: imgWidth,
        height: imgHeight,
        duration,
      } = event.data;
      const outCtx = processedCanvasRef.current?.getContext("2d");
      if (outCtx) {
        const outData = new ImageData(
          new Uint8ClampedArray(pixels),
          imgWidth,
          imgHeight,
        );
        outCtx.putImageData(outData, 0, 0);
      }
      setImageDuration(duration);
      setImageLoading(false);
      worker.terminate();
    };
    worker.postMessage({ height, pixels: imageData.data, width });
  }, []);

  const difficulties = PARALLEL_DIFFICULTIES;

  const activeWorkersRef = useRef<Worker[]>([]);

  const runParallelRace = useCallback(() => {
    // Terminate any workers still running from a previous race
    activeWorkersRef.current.forEach((worker) => worker.terminate());
    activeWorkersRef.current = [];

    // Reset progress instantly (no CSS transition)
    setParallelResetting(true);
    setParallelWorkers([
      { done: false, elapsed: 0, percent: 0 },
      { done: false, elapsed: 0, percent: 0 },
      { done: false, elapsed: 0, percent: 0 },
    ]);
    setParallelLoading(true);

    // Re-enable transitions after a frame, then start workers
    requestAnimationFrame(() => {
      setParallelResetting(false);

      const completedCount: { value: number } = { value: 0 };
      const workers: Worker[] = [];

      const onMessage = (
        targetWorker: Worker,
        event: MessageEvent<{ id: number; percent: number; elapsed: number }>,
      ) => {
        const { id, percent, elapsed } = event.data;
        setParallelWorkers((prev) => {
          const next = [...prev];
          const entry = next[id];
          if (entry) {
            next[id] = { done: percent >= PERCENTAGE_FULL, elapsed, percent };
          }

          return next;
        });
        if (percent < PERCENTAGE_FULL) return;
        completedCount.value++;
        targetWorker.terminate();
        if (completedCount.value >= PARALLEL_WORKER_COUNT)
          setParallelLoading(false);
      };

      for (let idx = 0; idx < PARALLEL_WORKER_COUNT; idx++) {
        const worker = new Worker(
          new URL("../../workers/parallel.worker.ts", import.meta.url),
          { type: "module" },
        );
        workers.push(worker);
        worker.onmessage = (event) => onMessage(worker, event);
        worker.postMessage({ difficulty: difficulties[idx], id: idx });
      }
      activeWorkersRef.current = workers;
    }); // end requestAnimationFrame
  }, []);

  const formatTime = (milliseconds: number) =>
    `${(milliseconds / MS_PER_SECOND).toFixed(1)}s`;

  return (
    <main>
      <div className="page-title">
        <img alt="React" height={32} src="/assets/svg/react.svg" />
        <h1>React</h1>
      </div>

      <div className="worker-cards">
        <HashCard />
        <PrimeCard />
        <SortCard />
        <ThreadRaceCard
          formatTime={formatTime}
          mainBarRef={mainBarRef}
          mainTime={mainTime}
          mainTimeLabelRef={mainTimeLabelRef}
          onStart={startRace}
          onStop={stopRace}
          onStress={stressMainThread}
          racing={racing}
          stressing={stressing}
          workerBarRef={workerBarRef}
          workerTime={workerTime}
          workerTimeRef={workerTimeRef}
        />
        <ImageCard
          duration={imageDuration}
          imageFileName={imageFileName}
          imageLoaded={imageLoaded}
          loading={imageLoading}
          onFileLoad={loadImageFile}
          onRun={runImageProcess}
          originalCanvasRef={originalCanvasRef}
          processedCanvasRef={processedCanvasRef}
        />
        <ParallelCard
          loading={parallelLoading}
          onRun={runParallelRace}
          resetting={parallelResetting}
          workers={parallelWorkers}
        />
      </div>

      <p className="footer">
        <img alt="" src="/assets/png/absolutejs-temp.png" />
        Powered by{" "}
        <a
          href="https://absolutejs.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          AbsoluteJS
        </a>
      </p>
    </main>
  );
};

export const ReactWorkerDemo = ({ cssPath }: WorkerDemoProps) => (
  <html lang="en">
    <Head cssPath={cssPath} />
    <body>
      <Nav />
      <WorkerDemoApp />
    </body>
  </html>
);
