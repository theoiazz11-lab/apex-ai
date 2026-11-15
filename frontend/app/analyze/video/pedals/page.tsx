
"use client";

import { useState, type ChangeEvent } from "react";

import {
  extractVideoFrames,
  type ExtractedFrame,
} from "../../../../lib/video/frameExtractor";

import {
  detectAccPedalsBatch,
  type PedalDetectionResult,
} from "../../../../lib/video/hudDetector";

type PedalTestResult = {
  frame: ExtractedFrame;
  detection: PedalDetectionResult;
};

export default function PedalsTestPage() {
  const [file, setFile] = useState<File | null>(null);

  const [results, setResults] = useState<
    PedalTestResult[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setFile(event.target.files?.[0] ?? null);
    setResults([]);
    setError("");
  }

  async function runTest() {
    if (!file || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const frames = await extractVideoFrames(file, {
        startSeconds: 2,
        endSeconds: 2.5,
        intervalSeconds: 0.5,
        maxFrames: 2,
        maxWidth: 1280,
        quality: 0.9,
      });

      const detections =
        await detectAccPedalsBatch(frames);

      setResults(
        frames.map((frame, index) => ({
          frame,
          detection: detections[index],
        }))
      );
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
        <a
          href="/analyze/video/frames"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Voltar ao Apex AI Vision
        </a>

        <p className="mt-10 text-sm font-bold tracking-widest text-cyan-400">
          APEX AI VISION
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Teste dos indicadores de pedais
        </h1>

        <p className="mt-4 text-slate-400">
          Compare o vídeo original com o recorte
          experimental dos indicadores de freio
          e acelerador.
        </p>

        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="text-xl font-bold">
            1. Selecionar vídeo
          </h2>

          <p className="mt-3 text-sm text-slate-400">
            Selecione hud test.MP4.
            O teste utilizará os instantes
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
              ? "Extraindo imagens..."
              : "Testar indicadores de pedais"}
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
              2. Comparação dos indicadores
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Confira se as barras aparecem
              completamente dentro dos recortes.
              Ainda não calculamos porcentagens
              de freio ou acelerador.
            </p>

            <div className="mt-6 space-y-8">
              {results.map(
                ({ frame, detection }) => (
                  <div
                    key={frame.timeSeconds}
                    className="rounded-2xl border border-slate-700 bg-slate-900 p-6"
                  >
                    <h3 className="text-lg font-bold text-cyan-400">
                      Instante:{" "}
                      {frame.timeSeconds.toFixed(3)} s
                    </h3>

                    <p className="mb-3 mt-6 font-semibold">
                      Imagem original
                    </p>

                    <img
                      src={frame.imageDataUrl}
                      alt={`Imagem original aos ${frame.timeSeconds.toFixed(3)} segundos`}
                      className="w-full rounded-xl border border-slate-700"
                    />

                    <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-5">
                      <p className="font-semibold">
                        Recorte experimental dos pedais
                      </p>

                      <div className="mt-5 flex min-h-32 items-center justify-center overflow-hidden rounded-xl bg-black p-4">
                        <img
                          src={detection.crop.imageDataUrl}
                          alt={`Indicadores aos ${frame.timeSeconds.toFixed(3)} segundos`}
                          className="max-h-80 max-w-full object-contain"
                          style={{
                            imageRendering: "pixelated",
                          }}
                        />
                      </div>

                      <p className="mt-4 text-xs text-slate-500">
                        Resolução:{" "}
                        {detection.crop.width}
                        {" × "}
                        {detection.crop.height}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">
          Apex AI Vision · Teste experimental
          dos indicadores de pedais
        </p>
      </div>
    </main>
  );
}
