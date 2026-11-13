
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  readVideoMetadata,
  prepareVideoAnalysis,
  formatLapTime,
  type VideoMetadata,
  type VideoAnalysisResult,
} from "../../../lib/video/videoAnalyzer";

import {
  extractVideoFrame,
  type ExtractedFrame,
} from "../../../lib/video/frameExtractor";

type HudForm = {
  speed: string;
  gear: string;
  rpm: string;
  fuel: string;
  frontLeft: string;
  frontRight: string;
  rearLeft: string;
  rearRight: string;
  notes: string;
};

type HudReading = {
  videoTime: number;
  speed: number;
  gear: number;
  rpm?: number;
  fuel?: number;
  pressures: {
    frontLeft?: number;
    frontRight?: number;
    rearLeft?: number;
    rearRight?: number;
  };
  notes: string;
};

const EMPTY_HUD: HudForm = {
  speed: "",
  gear: "",
  rpm: "",
  fuel: "",
  frontLeft: "",
  frontRight: "",
  rearLeft: "",
  rearRight: "",
  notes: "",
};

function MetricField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-slate-300">
      {label}

      <input
        type="number"
        step="any"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white"
      />
    </label>
  );
}

function parseHudNumber(
  value: string,
  label: string,
  minimum: number,
  maximum: number,
  required = false
): number | undefined {
  if (value.trim() === "") {
    if (required) {
      throw new Error(`Preencha o campo ${label}.`);
    }

    return undefined;
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < minimum ||
    number > maximum
  ) {
    throw new Error(`Confira o valor de ${label}.`);
  }

  return number;
}

export default function VideoAnalysisPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");

  const [metadata, setMetadata] =
    useState<VideoMetadata | null>(null);

  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [result, setResult] =
    useState<VideoAnalysisResult | null>(null);

  const [frame, setFrame] =
    useState<ExtractedFrame | null>(null);

  const [hud, setHud] = useState<HudForm>(EMPTY_HUD);
  const [readings, setReadings] = useState<HudReading[]>([]);

  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setVideoUrl("");
      return;
    }

    const url = URL.createObjectURL(file);

    setVideoUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!file) {
      setMetadata(null);
      return;
    }

    let cancelled = false;
    const selectedFile = file;

    async function loadVideo() {
      setLoading(true);
      setMetadata(null);
      setResult(null);
      setFrame(null);
      setError("");

      try {
        const info = await readVideoMetadata(selectedFile);

        if (cancelled) return;

        setMetadata(info);
        setStartSeconds(0);
        setEndSeconds(info.durationSeconds);
      } catch (caughtError) {
        if (cancelled) return;

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Não foi possível abrir o vídeo."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVideo();

    return () => {
      cancelled = true;
    };
  }, [file]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setFile(event.target.files?.[0] ?? null);
    setCurrentTime(0);
    setStartSeconds(0);
    setEndSeconds(0);
    setResult(null);
    setFrame(null);
    setHud({ ...EMPTY_HUD });
    setReadings([]);
    setError("");
  }

  function jumpToTime(seconds: number) {
    if (
      !videoRef.current ||
      !metadata ||
      !Number.isFinite(seconds)
    ) {
      return;
    }

    const safeTime = Math.max(
      0,
      Math.min(seconds, metadata.durationSeconds)
    );

    videoRef.current.currentTime = safeTime;
    setCurrentTime(safeTime);
  }

  function markBoundary(which: "start" | "end") {
    if (!videoRef.current) return;

    const time = Number(
      videoRef.current.currentTime.toFixed(3)
    );

    if (which === "start") {
      setStartSeconds(time);
    } else {
      setEndSeconds(time);
    }

    setResult(null);
    setError("");
  }

  function analyzeVideo() {
    if (!metadata) return;

    try {
      const analysis = prepareVideoAnalysis(
        metadata,
        startSeconds,
        endSeconds
      );

      setResult(analysis);
      setError("");
    } catch (caughtError) {
      setResult(null);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível preparar a volta."
      );
    }
  }

  async function captureHudFrame() {
    if (!file || !metadata || capturing) return;

    setCapturing(true);
    setError("");
    setFrame(null);
    setHud({ ...EMPTY_HUD });

    try {
      const requestedTime = Math.max(
        0,
        Math.min(
          videoRef.current?.currentTime ?? currentTime,
          metadata.durationSeconds - 0.05
        )
      );

      const captured = await extractVideoFrame(
        file,
        requestedTime,
        {
          maxWidth: 1920,
          quality: 0.9,
        }
      );

      setFrame(captured);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível capturar a imagem."
      );
    } finally {
      setCapturing(false);
    }
  }

  function updateHud(
    field: keyof HudForm,
    value: string
  ) {
    setHud((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function saveHudReading() {
    if (!frame) return;

    try {
      const speed = parseHudNumber(
        hud.speed,
        "velocidade",
        0,
        450,
        true
      )!;

      const gear = parseHudNumber(
        hud.gear,
        "marcha",
        -1,
        10,
        true
      )!;

      if (!Number.isInteger(gear)) {
        throw new Error(
          "A marcha deve ser um número inteiro (-1 a 10)."
        );
      }

      const rpm = parseHudNumber(
        hud.rpm,
        "RPM",
        0,
        15000
      );

      const fuel = parseHudNumber(
        hud.fuel,
        "combustível",
        0,
        250
      );

      const frontLeft = parseHudNumber(
        hud.frontLeft,
        "pneu dianteiro esquerdo",
        0,
        60
      );

      const frontRight = parseHudNumber(
        hud.frontRight,
        "pneu dianteiro direito",
        0,
        60
      );

      const rearLeft = parseHudNumber(
        hud.rearLeft,
        "pneu traseiro esquerdo",
        0,
        60
      );

      const rearRight = parseHudNumber(
        hud.rearRight,
        "pneu traseiro direito",
        0,
        60
      );

      setReadings((previous) => [
        ...previous,
        {
          videoTime: frame.timeSeconds,
          speed,
          gear,
          rpm,
          fuel,
          pressures: {
            frontLeft,
            frontRight,
            rearLeft,
            rearRight,
          },
          notes: hud.notes.trim(),
        },
      ]);

      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível registrar a leitura."
      );
    }
  }

  const selectedDuration =
    endSeconds - startSeconds;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <a
          href="/analyze"
          className="text-sm text-slate-400 hover:text-white"
        >
          ← Voltar à análise de telemetria
        </a>

        <p className="mt-10 font-bold tracking-widest text-cyan-400">
          APEX AI
        </p>

        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
          Análise de vídeo
        </h1>

        <p className="mt-4 text-slate-400">
          Prepare uma gravação do ACC, incluindo
          vídeos do PlayStation 5.
        </p>

        <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">
            1. Enviar vídeo
          </h2>

          <p className="mt-3 text-sm text-slate-400">
            Escolha uma gravação MP4, MOV ou WEBM
            de até 500 MB.
          </p>

          <input
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            onChange={handleFileChange}
            className="mt-6 block w-full text-sm"
          />

          {loading && (
            <p className="mt-4 text-cyan-400">
              Lendo vídeo...
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-800 bg-red-950 p-4 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          {metadata && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-400">
                  Arquivo
                </p>

                <p className="mt-1 break-all font-medium">
                  {metadata.fileName}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-400">
                  Duração
                </p>

                <p className="mt-1 font-bold">
                  {formatLapTime(
                    metadata.durationSeconds
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-400">
                  Resolução
                </p>

                <p className="mt-1 font-medium">
                  {metadata.width} × {metadata.height}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-400">
                  Tamanho
                </p>

                <p className="mt-1 font-medium">
                  {metadata.fileSizeMB.toFixed(2)} MB
                </p>
              </div>
            </div>
          )}
        </section>

        {videoUrl && metadata && (
          <>
            <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
              <h2 className="text-2xl font-semibold">
                2. Revisar a gravação
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Assista ao vídeo e localize os
                momentos importantes da volta.
              </p>

              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={(event) => {
                  setCurrentTime(
                    event.currentTarget.currentTime
                  );
                }}
                className="mt-6 w-full rounded-xl bg-black"
              />

              <div className="mt-5 rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">
                  Posição atual do vídeo
                </p>

                <p className="mt-1 text-2xl font-bold text-cyan-400">
                  {formatLapTime(currentTime)}
                </p>

                <input
                  type="range"
                  aria-label="Posição no vídeo"
                  min={0}
                  max={metadata.durationSeconds}
                  step={0.001}
                  value={Math.min(
                    currentTime,
                    metadata.durationSeconds
                  )}
                  onChange={(event) => {
                    jumpToTime(
                      Number(event.target.value)
                    );
                  }}
                  className="mt-4 w-full accent-cyan-400"
                />
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
              <h2 className="text-2xl font-semibold">
                3. Definir início e fim da volta
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Pause o vídeo no início e no fim
                da volta para marcar o intervalo.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <label
                    htmlFor="lap-start"
                    className="font-semibold text-green-400"
                  >
                    Início da volta (segundos)
                  </label>

                  <input
                    id="lap-start"
                    type="number"
                    min={0}
                    max={metadata.durationSeconds}
                    step={0.001}
                    value={startSeconds}
                    onChange={(event) => {
                      setStartSeconds(
                        Number(event.target.value)
                      );
                      setResult(null);
                    }}
                    className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 p-3"
                  />

                  <button
                    type="button"
                    onClick={() => markBoundary("start")}
                    className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 font-semibold hover:bg-green-500"
                  >
                    Marcar início aqui
                  </button>

                  <button
                    type="button"
                    onClick={() => jumpToTime(startSeconds)}
                    className="mt-3 w-full rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
                  >
                    Ver início no vídeo
                  </button>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <label
                    htmlFor="lap-end"
                    className="font-semibold text-red-400"
                  >
                    Fim da volta (segundos)
                  </label>

                  <input
                    id="lap-end"
                    type="number"
                    min={0}
                    max={metadata.durationSeconds}
                    step={0.001}
                    value={endSeconds}
                    onChange={(event) => {
                      setEndSeconds(
                        Number(event.target.value)
                      );
                      setResult(null);
                    }}
                    className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 p-3"
                  />

                  <button
                    type="button"
                    onClick={() => markBoundary("end")}
                    className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-500"
                  >
                    Marcar fim aqui
                  </button>

                  <button
                    type="button"
                    onClick={() => jumpToTime(endSeconds)}
                    className="mt-3 w-full rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
                  >
                    Ver fim no vídeo
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-slate-950 p-6 text-center">
                <p className="text-sm text-slate-400">
                  Tempo do intervalo selecionado
                </p>

                <p className="mt-2 text-4xl font-bold text-cyan-400">
                  {selectedDuration > 0
                    ? formatLapTime(selectedDuration)
                    : "--:--.---"}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  O tempo só corresponde à volta
                  real se os pontos estiverem corretos.
                </p>
              </div>

              <button
                type="button"
                onClick={analyzeVideo}
                className="mt-6 w-full rounded-xl bg-cyan-500 px-6 py-4 text-lg font-bold text-slate-950 hover:bg-cyan-400"
              >
                Preparar análise da volta
              </button>
            </section>

            <section className="mt-8 rounded-2xl border border-cyan-800 bg-slate-900 p-6 sm:p-8">
              <p className="font-semibold tracking-widest text-cyan-400">
                APEX AI VISION
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                4. Capturar imagem do HUD
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Pause o vídeo no instante desejado
                e capture uma imagem do painel.
              </p>

              <p className="mt-5 text-sm">
                Instante selecionado:{" "}
                <span className="font-bold text-cyan-400">
                  {formatLapTime(currentTime)}
                </span>
              </p>

              <button
                type="button"
                onClick={captureHudFrame}
                disabled={capturing}
                className="mt-5 w-full rounded-xl bg-cyan-500 px-6 py-4 font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                {capturing
                  ? "Capturando imagem..."
                  : "Capturar imagem do HUD"}
              </button>

              {frame && (
                <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <p className="font-semibold text-green-400">
                    Imagem capturada!
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    Instante:{" "}
                    {formatLapTime(frame.timeSeconds)}
                  </p>

                  <img
                    src={frame.imageDataUrl}
                    alt="Quadro extraído da gravação do ACC"
                    className="mt-4 w-full rounded-lg"
                  />

                  <p className="mt-3 text-xs text-slate-500">
                    A captura acontece no navegador.
                    Ainda não há leitura automática
                    dos números.
                  </p>
                </div>
              )}
            </section>

            {frame && (
              <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
                <p className="font-semibold tracking-widest text-cyan-400">
                  APEX AI HUD
                </p>

                <h2 className="mt-3 text-2xl font-bold">
                  5. Leitura experimental do HUD
                </h2>

                <p className="mt-3 text-sm text-slate-400">
                  Observe a imagem capturada acima
                  e digite os valores que conseguir ler.
                  Esta é uma anotação manual,
                  não um reconhecimento por IA.
                </p>

                <p className="mt-4 text-sm text-cyan-400">
                  Quadro:{" "}
                  {formatLapTime(frame.timeSeconds)}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <MetricField
                    label="Velocidade (km/h) *"
                    value={hud.speed}
                    onChange={(value) =>
                      updateHud("speed", value)
                    }
                    placeholder="Ex.: 171"
                  />

                  <MetricField
                    label="Marcha * (-1 a 10; 0 = neutro)"
                    value={hud.gear}
                    onChange={(value) =>
                      updateHud("gear", value)
                    }
                    placeholder="Ex.: 3"
                  />

                  <MetricField
                    label="RPM (opcional)"
                    value={hud.rpm}
                    onChange={(value) =>
                      updateHud("rpm", value)
                    }
                    placeholder="Ex.: 6815"
                  />

                  <MetricField
                    label="Combustível em litros (opcional)"
                    value={hud.fuel}
                    onChange={(value) =>
                      updateHud("fuel", value)
                    }
                  />
                </div>

                <h3 className="mt-6 font-semibold">
                  Pressão dos pneus em psi (opcional)
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <MetricField
                    label="Dianteiro esquerdo"
                    value={hud.frontLeft}
                    onChange={(value) =>
                      updateHud("frontLeft", value)
                    }
                  />

                  <MetricField
                    label="Dianteiro direito"
                    value={hud.frontRight}
                    onChange={(value) =>
                      updateHud("frontRight", value)
                    }
                  />

                  <MetricField
                    label="Traseiro esquerdo"
                    value={hud.rearLeft}
                    onChange={(value) =>
                      updateHud("rearLeft", value)
                    }
                  />

                  <MetricField
                    label="Traseiro direito"
                    value={hud.rearRight}
                    onChange={(value) =>
                      updateHud("rearRight", value)
                    }
                  />
                </div>

                <label className="mt-6 block text-sm text-slate-300">
                  Observações (opcional)

                  <textarea
                    rows={3}
                    value={hud.notes}
                    onChange={(event) =>
                      updateHud("notes", event.target.value)
                    }
                    placeholder="Ex.: saída da curva, início da aceleração..."
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white"
                  />
                </label>

                <p className="mt-3 text-xs text-slate-500">
                  * Campos obrigatórios
                </p>

                <button
                  type="button"
                  onClick={saveHudReading}
                  className="mt-5 w-full rounded-xl bg-green-600 px-6 py-4 font-bold hover:bg-green-500"
                >
                  Registrar leitura manual
                </button>
              </section>
            )}

            {readings.length > 0 && (
              <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-cyan-400">
                  Leituras registradas nesta sessão
                </h2>

                <p className="mt-3 text-sm text-slate-400">
                  Esses registros foram digitados
                  por você. Eles não são salvos em
                  uma conta e serão perdidos ao
                  atualizar a página.
                </p>

                <div className="mt-5 space-y-3">
                  {readings.map((reading, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                    >
                      <p className="font-semibold text-cyan-400">
                        {formatLapTime(
                          reading.videoTime
                        )}
                      </p>

                      <p className="mt-2">
                        {reading.speed} km/h · Marcha{" "}
                        {reading.gear === 0
                          ? "N"
                          : reading.gear === -1
                            ? "R"
                            : reading.gear}
                      </p>

                      {reading.rpm !== undefined && (
                        <p className="text-sm text-slate-300">
                          RPM: {reading.rpm}
                        </p>
                      )}

                      {reading.fuel !== undefined && (
                        <p className="text-sm text-slate-300">
                          Combustível: {reading.fuel} L
                        </p>
                      )}

                      {Object.values(
                        reading.pressures
                      ).some(
                        (value) => value !== undefined
                      ) && (
                        <p className="mt-1 text-sm text-slate-300">
                          Pneus (psi) DE:{" "}
                          {reading.pressures.frontLeft ?? "—"}{" "}
                          · DD:{" "}
                          {reading.pressures.frontRight ?? "—"}{" "}
                          · TE:{" "}
                          {reading.pressures.rearLeft ?? "—"}{" "}
                          · TD:{" "}
                          {reading.pressures.rearRight ?? "—"}
                        </p>
                      )}

                      {reading.notes && (
                        <p className="mt-2 text-sm text-slate-400">
                          {reading.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {result && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
            <p className="font-semibold tracking-widest text-cyan-400">
              APEX AI VIDEO
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              Intervalo preparado
            </h2>

            <p className="mt-6 text-4xl font-bold text-cyan-400">
              {formatLapTime(
                result.lap.lapTimeSeconds
              )}
            </p>

            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <p>
                Início:{" "}
                {formatLapTime(
                  result.lap.startSeconds
                )}
              </p>

              <p>
                Fim:{" "}
                {formatLapTime(
                  result.lap.endSeconds
                )}
              </p>

              <p>
                Trecho excluído do começo:{" "}
                {result.lap.excludedStartSeconds.toFixed(3)} s
              </p>

              <p>
                Trecho excluído do final:{" "}
                {result.lap.excludedEndSeconds.toFixed(3)} s
              </p>
            </div>

            <p className="mt-5 text-slate-300">
              {result.message}
            </p>

            <p className="mt-4 text-sm text-amber-300">
              O sistema ainda não identifica
              automaticamente erros de pilotagem.
              O vídeo permanece no seu navegador.
            </p>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">
          Apex AI · Módulo experimental de vídeo
        </p>
      </div>
    </main>
  );
}
