
"use client";

import {
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
  type HudReadingResult,
  type HudOcrValue,
} from "../../../../lib/video/hudReader";

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

const REGION_LABELS: Record<HudRegionName, string> = {
  speed: "Velocidade",
  gear: "Marcha",
  dashboard: "Painel completo",
};

type AnalysisStage =
  | "idle"
  | "extracting"
  | "detecting"
  | "reading"
  | "complete";

function OcrResultCard({
  label,
  unit,
  reading,
}: {
  label: string;
  unit: string;
  reading: HudOcrValue | undefined;
}) {
  if (!reading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
        <p className="text-sm text-slate-400">
          {label}
        </p>

        <p className="mt-3 text-xl font-bold text-slate-500">
          Aguardando leitura
        </p>
      </div>
    );
  }

  const recognized = reading.value !== null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
      <p className="text-sm text-slate-400">
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-bold ${
          recognized
            ? "text-green-400"
            : "text-amber-300"
        }`}
      >
        {recognized
          ? `${reading.value} ${unit}`
          : "Não identificado"}
      </p>

      <p className="mt-3 text-sm text-slate-400">
        Confiança do OCR:{" "}
        {reading.confidence.toFixed(1)}%
      </p>

      <p className="mt-2 break-all text-xs text-slate-500">
        Texto detectado:{" "}
        {reading.rawText.trim() || "(vazio)"}
      </p>
    </div>
  );
}

export default function VideoFramesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);

  const [frames, setFrames] = useState<
    ExtractedFrame[]
  >([]);

  const [hudResults, setHudResults] = useState<
    HudDetectionResult[]
  >([]);

  const [ocrResults, setOcrResults] = useState<
    HudReadingResult[]
  >([]);

  const [selectedFrameIndex, setSelectedFrameIndex] =
    useState(0);

  const [loading, setLoading] = useState(false);

  const [dragging, setDragging] = useState(false);

  const [stage, setStage] =
    useState<AnalysisStage>("idle");

  const [error, setError] = useState("");

  const [ocrError, setOcrError] = useState("");

  const selectedFrame = frames[selectedFrameIndex];

  const selectedHud = hudResults[selectedFrameIndex];

  const selectedOcr = ocrResults.find(
    (reading) =>
      reading.timeSeconds === selectedHud?.timeSeconds
  );

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
      !["mp4", "mov", "webm"].includes(extension)
    ) {
      setError(
        "Selecione um vídeo MP4, MOV ou WEBM."
      );
      return;
    }

    if (selectedFile.size === 0) {
      setError("O arquivo está vazio.");
      return;
    }

    if (selectedFile.size > MAX_VIDEO_SIZE) {
      setError(
        "O vídeo deve ter no máximo 500 MB."
      );
      return;
    }

    setFile(selectedFile);
    resetResults();
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setDragging(false);

    if (!loading) {
      selectFile(event.dataTransfer.files?.[0]);
    }
  }

  function removeFile() {
    if (loading) {
      return;
    }

    setFile(null);
    resetResults();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function analyzeFrames() {
    if (!file || loading) {
      return;
    }

    setLoading(true);
    resetResults();

    try {
      // ETAPA 1
      // Extrair cinco imagens do vídeo.

      setStage("extracting");

      const extracted = await extractVideoFrames(
        file,
        {
          startSeconds: 0,
          endSeconds: 20,
          intervalSeconds: 5,
          maxFrames: 5,
          maxWidth: 1280,
          quality: 0.85,
        }
      );

      setFrames(extracted);

      // ETAPA 2
      // Recortar as regiões do HUD.

      setStage("detecting");

      const detections =
        await detectAccHudBatch(extracted);

      setHudResults(detections);

      // ETAPA 3
      // Reconhecer números com Tesseract.js.

      setStage("reading");

      try {
        const readings =
          await readAccHudBatch(detections, {
            minimumConfidence: 50,
          });

        setOcrResults(readings);
      } catch (caughtError) {
        setOcrError(
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível executar o OCR."
        );
      }

      setSelectedFrameIndex(0);
      setStage("complete");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Ocorreu um erro durante a análise."
      );

      setStage("idle");
    } finally {
      setLoading(false);
    }
  }

  function getStageText() {
    switch (stage) {
      case "extracting":
        return "Extraindo imagens do vídeo...";

      case "detecting":
        return "Localizando o HUD...";

      case "reading":
        return "Reconhecendo velocidade e marcha...";

      case "complete":
        return "Processamento concluído.";

      default:
        return "Aguardando vídeo.";
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
          Leitura automática do HUD
        </h1>

        <p className="mt-4 text-slate-400">
          O Apex AI extrai cinco imagens do vídeo,
          localiza os indicadores e tenta reconhecer
          velocidade e marcha automaticamente.
        </p>

        {/* ENVIO DO VÍDEO */}

        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">
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
            className={`mt-6 rounded-xl border-2 border-dashed p-8 text-center ${
              dragging
                ? "border-cyan-400 bg-cyan-950"
                : "border-slate-600 bg-slate-950"
            }`}
          >
            <p className="text-slate-300">
              Arraste seu vídeo até esta área
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Ou selecione pelo botão abaixo
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="mt-5 rounded-xl bg-cyan-400 px-8 py-4 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              Selecionar vídeo do computador
            </button>

            <p className="mt-4 text-xs text-slate-500">
              MP4, MOV ou WEBM · Máximo de 500 MB
            </p>
          </div>

          {file && (
            <div className="mt-6 rounded-xl border border-green-800 bg-slate-950 p-5">
              <p className="font-semibold text-green-400">
                Vídeo selecionado!
              </p>

              <p className="mt-2 break-all text-sm text-slate-300">
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

          <button
            type="button"
            disabled={!file || loading}
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
              <p className="font-medium text-cyan-400">
                {getStageText()}
              </p>

              {loading && (
                <p className="mt-2 text-xs text-slate-400">
                  O reconhecimento pode levar algum
                  tempo na primeira execução.
                </p>
              )}
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
            <div
              role="alert"
              className="mt-4 rounded-lg border border-amber-700 bg-slate-950 p-4"
            >
              <p className="font-semibold text-amber-300">
                As imagens foram extraídas,
                mas o OCR não funcionou.
              </p>

              <p className="mt-2 text-sm text-slate-300">
                {ocrError}
              </p>
            </div>
          )}
        </section>

        {/* QUADROS EXTRAÍDOS */}

        {frames.length > 0 && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold">
              2. Quadros extraídos
            </h2>

            <p className="mt-3 text-slate-400">
              {frames.length} imagens capturadas.
              Clique em uma para conferir a leitura.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {frames.map((frame, index) => (
                <button
                  type="button"
                  key={`${frame.timeSeconds}-${index}`}
                  onClick={() =>
                    setSelectedFrameIndex(index)
                  }
                  className={`overflow-hidden rounded-xl border-2 bg-slate-900 text-left ${
                    selectedFrameIndex === index
                      ? "border-cyan-400"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  <img
                    src={frame.imageDataUrl}
                    alt={`Quadro aos ${frame.timeSeconds} segundos`}
                    className="w-full"
                  />

                  <div className="p-4">
                    <p className="font-semibold text-cyan-400">
                      {frame.timeSeconds.toFixed(3)} s
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {frame.width} × {frame.height}
                    </p>

                    {selectedFrameIndex === index && (
                      <p className="mt-2 text-xs font-semibold text-green-400">
                        Quadro selecionado
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* RESULTADO AUTOMÁTICO */}

        {ocrResults.length > 0 && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <p className="font-semibold tracking-widest text-cyan-400">
              APEX AI OCR
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              3. Resultados automáticos
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Resultados experimentais do OCR.
              Uma confiança alta não garante
              que o número esteja correto.
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="p-3">
                      Instante
                    </th>

                    <th className="p-3">
                      Velocidade
                    </th>

                    <th className="p-3">
                      Marcha
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {ocrResults.map((reading) => (
                    <tr
                      key={reading.timeSeconds}
                      className="border-b border-slate-800"
                    >
                      <td className="p-3">
                        {reading.timeSeconds.toFixed(1)} s
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* RECORTES DO HUD */}

        {selectedFrame && selectedHud && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <p className="font-semibold tracking-widest text-cyan-400">
              APEX AI HUD DETECTOR
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              4. Conferir recortes e leituras
            </h2>

            <p className="mt-3 text-slate-400">
              Quadro selecionado:{" "}
              <span className="font-bold text-cyan-400">
                {selectedHud.timeSeconds.toFixed(3)} s
              </span>
            </p>

            {selectedOcr && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <OcrResultCard
                  label="Velocidade identificada"
                  unit="km/h"
                  reading={selectedOcr.speed}
                />

                <OcrResultCard
                  label="Marcha identificada"
                  unit=""
                  reading={selectedOcr.gear}
                />
              </div>
            )}

            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-4">
              <p className="mb-4 font-semibold">
                Imagem original
              </p>

              <img
                src={selectedFrame.imageDataUrl}
                alt="Imagem original do ACC"
                className="w-full rounded-lg"
              />
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {selectedHud.crops.map((crop) => (
                <div
                  key={crop.name}
                  className="rounded-xl border border-slate-700 bg-slate-950 p-5"
                >
                  <h3 className="font-semibold text-cyan-400">
                    {REGION_LABELS[crop.name]}
                  </h3>

                  <p className="mt-2 text-xs text-slate-400">
                    Recorte ampliado
                  </p>

                  <div className="mt-4 flex min-h-32 items-center justify-center overflow-hidden rounded-lg bg-black p-3">
                    <img
                      src={crop.imageDataUrl}
                      alt={`Recorte de ${REGION_LABELS[crop.name]}`}
                      className="max-h-64 max-w-full object-contain"
                      style={{
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Resolução:{" "}
                    {crop.width} × {crop.height}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm text-amber-300">
              Ainda não usamos estas leituras
              para avaliar a pilotagem.
              Primeiro precisamos testar e
              validar o reconhecimento.
            </p>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">
          Apex AI Vision · OCR experimental
        </p>
      </div>
    </main>
  );
}
