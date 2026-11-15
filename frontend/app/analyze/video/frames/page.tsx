
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  extractVideoFrames,
  type ExtractedFrame,
} from "../../../../lib/video/frameExtractor";

import {
  detectAccHudBatch,
  type HudDetectionResult,
  type HudRegionName,
} from "../../../../lib/video/hudDetector";

import {
  readAccHudBatch,
  type HudOcrValue,
  type HudReadingResult,
} from "../../../../lib/video/hudReader";

import {
  analyzeDrivingFromVideo,
  type DrivingObservation,
} from "../../../../lib/video/drivingAnalyzer";

type AnalysisMode = "quick" | "full";

type AnalysisStage =
  | "idle"
  | "extracting"
  | "detecting"
  | "reading"
  | "complete";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const MAX_FRAMES = 40;
const MIN_INTERVAL = 0.5;
const MAX_INTERVAL = 30;

const REGION_LABELS: Record<
  HudRegionName,
  string
> = {
  gear: "Marcha",
  speed: "Velocidade",
  dashboard: "Painel completo",
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return "--:--.---";
  }

  const totalMilliseconds = Math.round(
    Math.max(0, seconds) * 1000
  );

  const minutes = Math.floor(
    totalMilliseconds / 60000
  );

  const remaining = totalMilliseconds % 60000;

  const wholeSeconds = Math.floor(
    remaining / 1000
  );

  const milliseconds = remaining % 1000;

  return (
    `${minutes}:` +
    `${String(wholeSeconds).padStart(2, "0")}.` +
    `${String(milliseconds).padStart(3, "0")}`
  );
}

function ResultCard({
  label,
  unit,
  reading,
}: {
  label: string;
  unit: string;
  reading?: HudOcrValue;
}) {
  const valid =
    reading !== undefined &&
    reading.value !== null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p
        className={`mt-3 text-2xl font-bold ${
          valid
            ? "text-green-400"
            : "text-amber-300"
        }`}
      >
        {valid
          ? `${reading.value}${unit ? ` ${unit}` : ""}`
          : "Não identificado"}
      </p>

      {reading && (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Confiança:{" "}
            {reading.confidence.toFixed(1)}%
          </p>

          <p className="mt-2 break-all text-xs text-slate-500">
            Texto detectado:{" "}
            {reading.rawText.trim() || "(vazio)"}
          </p>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-2xl font-bold text-cyan-400">
        {value}
      </p>

      {detail && (
        <p className="mt-2 text-xs text-slate-500">
          {detail}
        </p>
      )}
    </div>
  );
}

function observationLabel(
  observation: DrivingObservation
): string {
  switch (observation.type) {
    case "speed-increase":
      return "Aumento observado";

    case "speed-decrease":
      return "Redução observada";

    case "gear-change":
      return "Mudança de marcha";
  }
}

export default function VideoFramesPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [duration, setDuration] =
    useState<number | null>(null);

  const [metadataLoading, setMetadataLoading] =
    useState(false);

  const [mode, setMode] =
    useState<AnalysisMode>("quick");

  const [startSeconds, setStartSeconds] =
    useState(0);

  const [endSeconds, setEndSeconds] =
    useState(0);

  const [intervalSeconds, setIntervalSeconds] =
    useState(10);

  const [frames, setFrames] =
    useState<ExtractedFrame[]>([]);

  const [hudResults, setHudResults] =
    useState<HudDetectionResult[]>([]);

  const [ocrResults, setOcrResults] =
    useState<HudReadingResult[]>([]);

  const [
    selectedFrameIndex,
    setSelectedFrameIndex,
  ] = useState(0);

  const [loading, setLoading] =
    useState(false);

  const [dragging, setDragging] =
    useState(false);

  const [stage, setStage] =
    useState<AnalysisStage>("idle");

  const [error, setError] =
    useState("");

  const [ocrError, setOcrError] =
    useState("");

  const selectedFrame =
    frames[selectedFrameIndex];

  const selectedHud =
    hudResults[selectedFrameIndex];

  const selectedOcr =
    ocrResults[selectedFrameIndex];

  const drivingAnalysis = useMemo(() => {
    if (ocrResults.length === 0) {
      return null;
    }

    return analyzeDrivingFromVideo(ocrResults);
  }, [ocrResults]);

  const estimatedFrames =
    mode === "quick"
      ? 5
      : Number.isFinite(intervalSeconds) &&
          intervalSeconds > 0 &&
          endSeconds > startSeconds
        ? Math.floor(
            (endSeconds - startSeconds) /
              intervalSeconds +
              1e-9
          ) + 1
        : 0;

  const validRange =
    mode === "quick"
      ? duration !== null &&
        duration >= 20
      : duration !== null &&
        Number.isFinite(startSeconds) &&
        Number.isFinite(endSeconds) &&
        Number.isFinite(intervalSeconds) &&
        startSeconds >= 0 &&
        endSeconds > startSeconds &&
        endSeconds <= duration &&
        intervalSeconds >= MIN_INTERVAL &&
        intervalSeconds <= MAX_INTERVAL &&
        estimatedFrames >= 2 &&
        estimatedFrames <= MAX_FRAMES;

  function resetResults() {
    setFrames([]);
    setHudResults([]);
    setOcrResults([]);
    setSelectedFrameIndex(0);
    setStage("idle");
    setError("");
    setOcrError("");
  }

  function selectFile(selectedFile?: File) {
    if (!selectedFile || loading) {
      return;
    }

    const extension = selectedFile.name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (
      !extension ||
      !["mp4", "mov", "webm"].includes(
        extension
      )
    ) {
      setError(
        "Selecione um vídeo MP4, MOV ou WEBM."
      );
      return;
    }

    if (
      selectedFile.size === 0 ||
      selectedFile.size > MAX_VIDEO_SIZE
    ) {
      setError(
        "O vídeo precisa ter entre 1 byte e 500 MB."
      );
      return;
    }

    setDuration(null);
    setFile(selectedFile);
    resetResults();
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    selectFile(
      event.target.files?.[0]
    );
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setDragging(false);

    if (!loading) {
      selectFile(
        event.dataTransfer.files?.[0]
      );
    }
  }

  function removeFile() {
    if (loading) {
      return;
    }

    setFile(null);
    setDuration(null);
    resetResults();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Le os metadados do video localmente.

  useEffect(() => {
    if (!file) {
      setDuration(null);
      setMetadataLoading(false);
      return;
    }

    let cancelled = false;

    const video =
      document.createElement("video");

    const url =
      URL.createObjectURL(file);

    setMetadataLoading(true);
    setDuration(null);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      if (cancelled) {
        return;
      }

      const seconds = video.duration;

      if (
        !Number.isFinite(seconds) ||
        seconds <= 0
      ) {
        setError(
          "Não foi possível obter a duração do vídeo."
        );
      } else {
        setDuration(seconds);
        setStartSeconds(0);
        setEndSeconds(
          Number(seconds.toFixed(3))
        );
      }

      setMetadataLoading(false);
    };

    video.onerror = () => {
      if (cancelled) {
        return;
      }

      setMetadataLoading(false);
      setError(
        "O navegador não conseguiu abrir esse vídeo."
      );
    };

    video.src = url;
    video.load();

    return () => {
      cancelled = true;

      video.pause();
      video.removeAttribute("src");
      video.load();

      URL.revokeObjectURL(url);
    };
  }, [file]);

  async function analyzeFrames() {
    if (
      !file ||
      loading ||
      !validRange
    ) {
      setError(
        "Confira o vídeo e as configurações da análise."
      );
      return;
    }

    setLoading(true);
    resetResults();

    try {
      setStage("extracting");

      const options =
        mode === "quick"
          ? {
              startSeconds: 0,
              endSeconds: 20,
              intervalSeconds: 5,
              maxFrames: 5,
              maxWidth: 1280,
              quality: 0.85,
            }
          : {
              startSeconds,
              endSeconds,
              intervalSeconds,
              maxFrames: MAX_FRAMES,
              maxWidth: 1280,
              quality: 0.85,
            };

      const extracted =
        await extractVideoFrames(
          file,
          options
        );

      setFrames(extracted);

      setStage("detecting");

      const detections =
        await detectAccHudBatch(
          extracted
        );

      setHudResults(detections);

      setStage("reading");

      try {
        const readings =
          await readAccHudBatch(
            detections,
            {
              minimumConfidence: 50,
            }
          );

        setOcrResults(readings);
      } catch (caughtError) {
        setOcrError(
          caughtError instanceof Error
            ? caughtError.message
            : "Falha no reconhecimento OCR."
        );
      }

      setSelectedFrameIndex(0);
      setStage("complete");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível analisar o vídeo."
      );

      setStage("idle");
    } finally {
      setLoading(false);
    }
  }

  function stageMessage() {
    switch (stage) {
      case "extracting":
        return "Extraindo os quadros do vídeo...";

      case "detecting":
        return "Localizando velocidade e marcha...";

      case "reading":
        return "Reconhecendo os números com OCR...";

      case "complete":
        return "Processamento concluído.";

      default:
        return "Aguardando análise.";
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <a
          href="/analyze/video"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Voltar à análise de vídeo
        </a>

        <p className="mt-10 font-bold tracking-widest text-cyan-400">
          APEX AI VISION
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Análise de vídeo do ACC
        </h1>

        <p className="mt-4 text-slate-400">
          Extraia imagens do vídeo, reconheça
          velocidade e marcha e visualize
          mudanças entre amostras.
        </p>

        {/* SECAO 1: VIDEO */}

        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">
            1. Enviar vídeo
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            onChange={handleFileChange}
            className="sr-only"
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();

              if (!loading) {
                setDragging(true);
              }
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDrop={handleDrop}
            className={`mt-5 rounded-xl border-2 border-dashed p-8 text-center ${
              dragging
                ? "border-cyan-400 bg-cyan-950"
                : "border-slate-600 bg-slate-950"
            }`}
          >
            <p className="text-slate-300">
              Arraste o vídeo para esta área
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="mt-5 rounded-xl bg-cyan-400 px-8 py-4 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              Selecionar vídeo
            </button>

            <p className="mt-4 text-xs text-slate-500">
              MP4, MOV ou WEBM · Máximo 500 MB
            </p>
          </div>

          {file && (
            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="break-all font-semibold">
                {file.name}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Tamanho:{" "}
                {(
                  file.size /
                  (1024 * 1024)
                ).toFixed(2)}{" "}
                MB
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Duração:{" "}
                {metadataLoading
                  ? "Carregando..."
                  : duration === null
                    ? "Não disponível"
                    : formatTime(duration)}
              </p>

              <button
                type="button"
                disabled={loading}
                onClick={removeFile}
                className="mt-4 text-sm text-slate-400 underline hover:text-white disabled:opacity-50"
              >
                Remover arquivo
              </button>
            </div>
          )}
        </section>

        {/* SECAO 2: CONFIGURACAO */}

        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">
            2. Configurar análise
          </h2>

          <p className="mt-3 text-sm text-slate-400">
            Escolha entre verificar cinco
            quadros ou analisar amostras
            de um intervalo do vídeo.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setMode("quick");
                resetResults();
              }}
              className={`rounded-xl border-2 p-5 text-left ${
                mode === "quick"
                  ? "border-cyan-400 bg-slate-950"
                  : "border-slate-700 bg-slate-950"
              }`}
            >
              <p className="font-bold">
                Teste rápido
              </p>

              <p className="mt-2 text-sm text-slate-400">
                5 imagens: 0, 5, 10, 15 e 20 s
              </p>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setMode("full");
                resetResults();
              }}
              className={`rounded-xl border-2 p-5 text-left ${
                mode === "full"
                  ? "border-cyan-400 bg-slate-950"
                  : "border-slate-700 bg-slate-950"
              }`}
            >
              <p className="font-bold">
                Volta completa ou trecho
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Escolha o início, o fim
                e o intervalo entre imagens
              </p>
            </button>
          </div>

          {mode === "full" && (
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <label className="text-sm text-slate-300">
                Início (segundos)

                <input
                  type="number"
                  min={0}
                  step={0.001}
                  disabled={loading}
                  value={startSeconds}
                  onChange={(event) => {
                    setStartSeconds(
                      Number(event.target.value)
                    );
                    resetResults();
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white"
                />
              </label>

              <label className="text-sm text-slate-300">
                Fim (segundos)

                <input
                  type="number"
                  min={0}
                  step={0.001}
                  disabled={loading}
                  value={endSeconds}
                  onChange={(event) => {
                    setEndSeconds(
                      Number(event.target.value)
                    );
                    resetResults();
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white"
                />
              </label>

              <label className="text-sm text-slate-300">
                Intervalo entre imagens (s)

                <input
                  type="number"
                  min={MIN_INTERVAL}
                  max={MAX_INTERVAL}
                  step={0.5}
                  disabled={loading}
                  value={intervalSeconds}
                  onChange={(event) => {
                    setIntervalSeconds(
                      Number(event.target.value)
                    );
                    resetResults();
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white"
                />
              </label>
            </div>
          )}

          {mode === "full" && (
            <p className="mt-4 text-sm text-slate-400">
              Amostras previstas:{" "}
              <strong>{estimatedFrames}</strong>
              {" · "}Máximo: {MAX_FRAMES}
            </p>
          )}

          <p className="mt-4 text-sm text-amber-300">
            O reconhecimento é experimental.
            Agora é possível selecionar
            intervalos de 0,5 segundo,
            respeitando o limite de
            40 imagens por análise.
          </p>

          {!validRange && file && (
            <p className="mt-4 text-sm text-amber-300">
              Confira o início, fim e
              intervalo. Use de 0,5 a
              30 segundos entre capturas,
              com no máximo 40 imagens.
            </p>
          )}

          <button
            type="button"
            disabled={
              !file ||
              loading ||
              metadataLoading ||
              !validRange
            }
            onClick={analyzeFrames}
            className="mt-6 w-full rounded-xl bg-cyan-400 px-6 py-4 font-bold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading
              ? "Analisando..."
              : "Extrair imagens e ler HUD"}
          </button>

          {stage !== "idle" && (
            <div
              aria-live="polite"
              className="mt-5 rounded-lg bg-slate-950 p-4"
            >
              <p className="font-semibold text-cyan-400">
                {stageMessage()}
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-800 bg-red-950 p-4 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          {ocrError && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-amber-700 bg-slate-950 p-4 text-sm text-amber-300"
            >
              Os quadros foram extraídos,
              mas o OCR falhou: {ocrError}
            </p>
          )}
        </section>

        {/* SECAO 3: LEITURAS OCR */}

        {ocrResults.length > 0 && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">
              3. Telemetria estimada pelo vídeo
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Esta tabela contém leituras
              do HUD realizadas por OCR.
              Ainda não equivale à
              telemetria oficial do ACC.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="p-3">
                      Tempo
                    </th>

                    <th className="p-3">
                      Velocidade
                    </th>

                    <th className="p-3">
                      Marcha
                    </th>

                    <th className="p-3">
                      Conf. velocidade
                    </th>

                    <th className="p-3">
                      Conf. marcha
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {ocrResults.map(
                    (reading, index) => (
                      <tr
                        key={`${reading.timeSeconds}-${index}`}
                        className="border-b border-slate-800"
                      >
                        <td className="p-3">
                          {formatTime(
                            reading.timeSeconds
                          )}
                        </td>

                        <td className="p-3">
                          {reading.speed.value === null
                            ? "Não identificado"
                            : `${reading.speed.value} km/h`}
                        </td>

                        <td className="p-3">
                          {reading.gear.value === null
                            ? "Não identificado"
                            : reading.gear.value}
                        </td>

                        <td className="p-3">
                          {reading.speed.confidence.toFixed(1)}
                          %
                        </td>

                        <td className="p-3">
                          {reading.gear.confidence.toFixed(1)}
                          %
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* SECAO 4: ANALISE INICIAL */}

        {drivingAnalysis && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">
              4. Análise inicial da pilotagem
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Resumo descritivo produzido
              automaticamente com as
              leituras do HUD.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Velocidade mínima observada"
                value={
                  drivingAnalysis.minimumObservedSpeed === null
                    ? "Não disponível"
                    : `${drivingAnalysis.minimumObservedSpeed} km/h`
                }
              />

              <MetricCard
                label="Velocidade máxima observada"
                value={
                  drivingAnalysis.maximumObservedSpeed === null
                    ? "Não disponível"
                    : `${drivingAnalysis.maximumObservedSpeed} km/h`
                }
              />

              <MetricCard
                label="Velocidades identificadas"
                value={
                  `${drivingAnalysis.validSpeedSamples}` +
                  `/${drivingAnalysis.totalSamples}`
                }
                detail="Amostras com leitura numérica"
              />

              <MetricCard
                label="Marchas identificadas"
                value={
                  `${drivingAnalysis.validGearSamples}` +
                  `/${drivingAnalysis.totalSamples}`
                }
                detail="Amostras com leitura numérica"
              />
            </div>

            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-5">
              <h3 className="font-semibold text-cyan-400">
                Intervalo observado
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                {drivingAnalysis.durationSeconds.toFixed(3)}{" "}
                segundos entre a primeira
                e a última amostra.
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Esse intervalo não representa
                necessariamente a duração
                total do vídeo ou da volta.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-bold">
                Mudanças entre amostras
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                As diferenças abaixo não
                indicam o instante exato
                de uma frenagem, aceleração
                ou troca de marcha.
              </p>

              {drivingAnalysis.observations.length === 0 ? (
                <p className="mt-4 rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                  Não há amostras suficientes
                  para mostrar mudanças.
                </p>
              ) : (
                <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950">
                  {drivingAnalysis.observations.map(
                    (observation, index) => (
                      <div
                        key={`${observation.startSeconds}-${observation.endSeconds}-${observation.type}-${index}`}
                        className="border-b border-slate-800 p-4 last:border-b-0"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-cyan-400">
                            {observationLabel(
                              observation
                            )}
                          </p>

                          <p className="text-xs text-slate-500">
                            {formatTime(
                              observation.startSeconds
                            )}
                            {" até "}
                            {formatTime(
                              observation.endSeconds
                            )}
                          </p>
                        </div>

                        <p className="mt-2 text-sm text-slate-300">
                          {observation.description}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-amber-800 bg-slate-950 p-5">
              <h3 className="font-semibold text-amber-300">
                Limitações desta análise
              </h3>

              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                {drivingAnalysis.warnings.map(
                  (warning, index) => (
                    <li key={`${index}-${warning}`}>
                      {warning}
                    </li>
                  )
                )}
              </ul>
            </div>

            <p className="mt-5 text-sm text-slate-400">
              Amostras mais próximas
              melhoram a resolução temporal,
              mas ainda não substituem
              dados de frenagem, aceleração
              e trajetória.
            </p>
          </section>
        )}

        {/* SECAO 5: QUADROS */}

        {frames.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold">
              5. Quadros da análise
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              {frames.length} imagens extraídas.
              Selecione uma para visualizar
              o HUD e as leituras.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {frames.map(
                (frame, index) => (
                  <button
                    key={`${frame.timeSeconds}-${index}`}
                    type="button"
                    onClick={() =>
                      setSelectedFrameIndex(index)
                    }
                    className={`overflow-hidden rounded-xl border-2 bg-slate-900 text-left ${
                      selectedFrameIndex === index
                        ? "border-cyan-400"
                        : "border-slate-700"
                    }`}
                  >
                    <img
                      src={frame.imageDataUrl}
                      alt={`Quadro aos ${formatTime(
                        frame.timeSeconds
                      )}`}
                      className="w-full"
                    />

                    <div className="p-3">
                      <p className="font-semibold text-cyan-400">
                        {formatTime(
                          frame.timeSeconds
                        )}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {frame.width} × {frame.height}
                      </p>
                    </div>
                  </button>
                )
              )}
            </div>
          </section>
        )}

        {/* SECAO 6: CONFERIR HUD */}

        {selectedFrame && selectedHud && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">
              6. Conferir leitura do HUD
            </h2>

            <p className="mt-3 text-slate-400">
              Instante:{" "}
              {formatTime(
                selectedFrame.timeSeconds
              )}
            </p>

            {selectedOcr && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <ResultCard
                  label="Velocidade"
                  unit="km/h"
                  reading={selectedOcr.speed}
                />

                <ResultCard
                  label="Marcha"
                  unit=""
                  reading={selectedOcr.gear}
                />
              </div>
            )}

            <div className="mt-6 rounded-xl bg-slate-950 p-4">
              <p className="mb-4 font-semibold">
                Imagem original
              </p>

              <img
                src={selectedFrame.imageDataUrl}
                alt="Imagem do ACC"
                className="w-full rounded-lg"
              />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {selectedHud.crops.map(
                (crop) => (
                  <div
                    key={crop.name}
                    className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                  >
                    <p className="font-semibold text-cyan-400">
                      {REGION_LABELS[crop.name]}
                    </p>

                    <div className="mt-4 flex min-h-32 items-center justify-center overflow-hidden rounded-lg bg-black p-3">
                      <img
                        src={crop.imageDataUrl}
                        alt={REGION_LABELS[crop.name]}
                        className="max-h-64 max-w-full object-contain"
                        style={{
                          imageRendering: "pixelated",
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">
          Apex AI Vision · Protótipo de
          análise por vídeo
        </p>
      </div>
    </main>
  );
}
