
"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";

import {
  extractVideoFrames,
  type ExtractedFrame,
} from "../../../../lib/video/frameExtractor";

import {
  detectAccPedalsBatch,
  type PedalDetectionResult,
} from "../../../../lib/video/hudDetector";

import {
  readAccPedalIndicatorsBatch,
  comparePedalVisualReadings,
  type PedalReadingResult,
  type PedalVisualChange,
  type PedalVisualMetrics,
} from "../../../../lib/video/pedalReader";

type PedalTestResult = {
  frame: ExtractedFrame;
  detection: PedalDetectionResult;
  reading: PedalReadingResult;
};

function formatDecimal(value: number): string {
  return value.toFixed(4);
}

function formatChange(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(4)}`;
}

function VisualMetricCard({
  title,
  metrics,
}: {
  title: string;
  metrics: PedalVisualMetrics;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
      <h4 className="font-bold text-cyan-400">
        {title}
      </h4>

      <div className="mt-4 space-y-3 text-sm">
        <p className="flex justify-between gap-4">
          <span className="text-slate-400">
            Pixels coloridos
          </span>
          <span>
            {formatDecimal(metrics.coloredPixelRatio)}
          </span>
        </p>

        <p className="flex justify-between gap-4">
          <span className="text-slate-400">
            Pixels brilhantes
          </span>
          <span>
            {formatDecimal(metrics.brightPixelRatio)}
          </span>
        </p>

        <p className="flex justify-between gap-4">
          <span className="text-slate-400">
            Brilho médio
          </span>
          <span>
            {formatDecimal(metrics.averageBrightness)}
          </span>
        </p>

        <p className="flex justify-between gap-4">
          <span className="text-slate-400">
            Saturação média
          </span>
          <span>
            {formatDecimal(metrics.averageSaturation)}
          </span>
        </p>

        <p className="flex justify-between gap-4">
          <span className="text-slate-400">
            Pixels analisados
          </span>
          <span>
            {metrics.sampledPixels.toLocaleString("pt-BR")}
          </span>
        </p>
      </div>
    </div>
  );
}

function ComparisonCard({
  comparison,
}: {
  comparison: PedalVisualChange;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-cyan-800 bg-slate-900 p-6">
      <h2 className="text-xl font-bold text-cyan-400">
        3. Comparação automática das imagens
      </h2>

      <p className="mt-3 text-sm text-slate-400">
        Diferenças visuais entre{" "}
        {comparison.fromSeconds.toFixed(3)} s e{" "}
        {comparison.toSeconds.toFixed(3)} s.
        Os números representam variações
        de características dos pixels,
        não porcentagens dos pedais.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="p-3">Indicador</th>
              <th className="p-3">
                Variação de pixels coloridos
              </th>
              <th className="p-3">
                Variação do brilho médio
              </th>
            </tr>
          </thead>

          <tbody>
            <tr className="border-b border-slate-800">
              <td className="p-3 font-semibold">
                Acelerador
              </td>
              <td className="p-3">
                {formatChange(
                  comparison.throttleColorChange
                )}
              </td>
              <td className="p-3">
                {formatChange(
                  comparison.throttleBrightnessChange
                )}
              </td>
            </tr>

            <tr>
              <td className="p-3 font-semibold">
                Freio
              </td>
              <td className="p-3">
                {formatChange(
                  comparison.brakeColorChange
                )}
              </td>
              <td className="p-3">
                {formatChange(
                  comparison.brakeBrightnessChange
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-sm text-amber-300">
        Uma diferença positiva ou negativa
        não comprova, sozinha, aumento ou
        redução da pressão no pedal.
        Precisamos validar a localização
        exata das barras e calibrar
        o preenchimento.
      </p>
    </section>
  );
}

function CropPanel({
  title,
  description,
  imageDataUrl,
  width,
  height,
  alt,
}: {
  title: string;
  description: string;
  imageDataUrl: string;
  width: number;
  height: number;
  alt: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-5">
      <h4 className="font-semibold">
        {title}
      </h4>

      <p className="mt-2 text-sm text-slate-400">
        {description}
      </p>

      <div className="mt-5 flex min-h-32 items-center justify-center overflow-hidden rounded-xl bg-black p-4">
        <img
          src={imageDataUrl}
          alt={alt}
          className="max-h-96 max-w-full object-contain"
          style={{
            imageRendering: "pixelated",
          }}
        />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Resolução: {width} × {height}
      </p>
    </div>
  );
}

export default function PedalsTestPage() {
  const [file, setFile] = useState<File | null>(null);

  const [results, setResults] = useState<
    PedalTestResult[]
  >([]);

  const [comparison, setComparison] =
    useState<PedalVisualChange | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setFile(event.target.files?.[0] ?? null);
    setResults([]);
    setComparison(null);
    setError("");
  }

  async function runTest() {
    if (!file || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);
    setComparison(null);

    try {
      const frames = await extractVideoFrames(file, {
        startSeconds: 2,
        endSeconds: 2.5,
        intervalSeconds: 0.5,
        maxFrames: 2,
        maxWidth: 1280,
        quality: 0.9,
      });

      if (frames.length !== 2) {
        throw new Error(
          "Não foi possível extrair os dois instantes do vídeo."
        );
      }

      const detections =
        await detectAccPedalsBatch(frames);

      const readings =
        await readAccPedalIndicatorsBatch(
          detections
        );

      if (
        detections.length !== frames.length ||
        readings.length !== frames.length
      ) {
        throw new Error(
          "Os resultados do detector estão incompletos."
        );
      }

      const combinedResults = frames.map(
        (frame, index) => ({
          frame,
          detection: detections[index],
          reading: readings.find(
            (item) =>
              item.timeSeconds === frame.timeSeconds
          ) ?? readings[index],
        })
      );

      setResults(combinedResults);

      if (readings.length >= 2) {
        setComparison(
          comparePedalVisualReadings(
            readings[0],
            readings[1]
          )
        );
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível analisar o vídeo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/analyze/video/frames"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Voltar ao Apex AI Vision
        </Link>

        <p className="mt-10 text-sm font-bold tracking-widest text-cyan-400">
          APEX AI VISION
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Análise experimental dos pedais
        </h1>

        <p className="mt-4 text-slate-400">
          Compare os quadros do ACC e examine
          métricas visuais das regiões associadas
          aos indicadores de acelerador e freio.
        </p>

        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">
            1. Selecionar vídeo
          </h2>

          <p className="mt-3 text-sm text-slate-400">
            Selecione hud test.MP4.
            O teste utiliza os instantes
            2,000 e 2,500 segundos.
          </p>

          <input
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            onChange={handleFileChange}
            disabled={loading}
            className="mt-5 block w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm"
          />

          {file && (
            <p className="mt-4 break-all text-sm text-slate-300">
              Arquivo: {file.name}
            </p>
          )}

          <button
            type="button"
            disabled={!file || loading}
            onClick={runTest}
            className="mt-6 w-full rounded-xl bg-cyan-400 px-6 py-4 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-40"
          >
            {loading
              ? "Analisando imagens..."
              : "Analisar indicadores de pedais"}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-700 bg-red-950 p-4 text-sm text-red-200"
            >
              {error}
            </p>
          )}
        </section>

        {results.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold">
              2. Leituras experimentais
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Valores normalizados de 0 a 1
              descrevem características visuais,
              e não a pressão dos pedais.
              As áreas analisadas ainda
              precisam ser validadas.
            </p>

            <div className="mt-6 space-y-8">
              {results.map(
                ({ frame, detection, reading }) => (
                  <div
                    key={frame.timeSeconds}
                    className="rounded-2xl border border-slate-700 bg-slate-900 p-6"
                  >
                    <h3 className="text-lg font-bold text-cyan-400">
                      Instante:{" "}
                      {frame.timeSeconds.toFixed(3)} s
                    </h3>

                    <div className="mt-6">
                      <p className="mb-3 font-semibold">
                        Imagem original
                      </p>

                      <img
                        src={frame.imageDataUrl}
                        alt={`Imagem original aos ${frame.timeSeconds.toFixed(3)} segundos`}
                        className="w-full rounded-xl border border-slate-700"
                      />
                    </div>

                    <CropPanel
                      title="Recorte anterior do HUD"
                      description="Região utilizada no primeiro teste de localização."
                      imageDataUrl={
                        detection.crop.imageDataUrl
                      }
                      width={detection.crop.width}
                      height={detection.crop.height}
                      alt="Recorte experimental original"
                    />

                    <CropPanel
                      title="Recorte ampliado do HUD"
                      description="Área maior para investigar as barras e outros elementos próximos."
                      imageDataUrl={
                        detection.contextCrop.imageDataUrl
                      }
                      width={
                        detection.contextCrop.width
                      }
                      height={
                        detection.contextCrop.height
                      }
                      alt="Região ampliada do HUD"
                    />

                    <h4 className="mt-8 text-lg font-bold">
                      Métricas dos pixels
                    </h4>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <VisualMetricCard
                        title="Região do acelerador"
                        metrics={reading.throttle}
                      />

                      <VisualMetricCard
                        title="Região do freio"
                        metrics={reading.brake}
                      />
                    </div>

                    <p className="mt-5 text-sm text-amber-300">
                      Leitura ainda não calibrada.
                      Nenhuma porcentagem de pressão
                      foi calculada.
                    </p>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {comparison && (
          <ComparisonCard
            comparison={comparison}
          />
        )}

        {results.length > 0 && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-bold">
              Limitações do teste
            </h2>

            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
              {results[0].reading.warnings.map(
                (warning, index) => (
                  <li key={index}>
                    {warning}
                  </li>
                )
              )}
            </ul>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">
          Apex AI Vision · Leitura visual experimental
        </p>
      </div>
    </main>
  );
}
