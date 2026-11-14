
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

import {
  SIMULATORS,
  ACC_YEARS,
  ACC_TRACKS,
  ACC_CATEGORIES,
  getCarsByCategory,
  getCategoriesByYear,
  getCarById,
  isValidSessionSelection,
  type SessionSelection,
} from "../../../lib/simulators/simulatorData";

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

const EMPTY_SESSION: SessionSelection = {
  simulatorId: "",
  year: 0,
  categoryId: "",
  trackId: "",
  carId: "",
};

const inputStyle =
  "mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white";

const sectionStyle =
  "mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8";

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
        onChange={(event) =>
          onChange(event.target.value)
        }
        className={inputStyle}
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
      throw new Error(
        `Preencha o campo ${label}.`
      );
    }

    return undefined;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw new Error(
      `Confira o valor de ${label}.`
    );
  }

  return parsed;
}

export default function VideoAnalysisPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Configuracao da sessao

  const [session, setSession] =
    useState<SessionSelection>(EMPTY_SESSION);

  // Video e metadados

  const [file, setFile] =
    useState<File | null>(null);

  const [videoUrl, setVideoUrl] = useState("");

  const [metadata, setMetadata] =
    useState<VideoMetadata | null>(null);

  const [startSeconds, setStartSeconds] =
    useState(0);

  const [endSeconds, setEndSeconds] =
    useState(0);

  const [currentTime, setCurrentTime] =
    useState(0);

  const [result, setResult] =
    useState<VideoAnalysisResult | null>(null);

  // Captura de HUD

  const [frame, setFrame] =
    useState<ExtractedFrame | null>(null);

  const [hud, setHud] =
    useState<HudForm>({ ...EMPTY_HUD });

  const [readings, setReadings] =
    useState<HudReading[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [capturing, setCapturing] =
    useState(false);

  const [error, setError] = useState("");

  // Filtros automaticos

  const availableCategories =
    session.year > 0
      ? getCategoriesByYear(session.year)
      : [];

  const availableCars =
    session.categoryId && session.year > 0
      ? getCarsByCategory(
          session.categoryId,
          session.year
        )
      : [];

  const validSession =
    isValidSessionSelection(session);

  const selectedSimulator = SIMULATORS.find(
    (item) => item.id === session.simulatorId
  );

  const selectedTrack = ACC_TRACKS.find(
    (item) => item.id === session.trackId
  );

  const selectedCategory = ACC_CATEGORIES.find(
    (item) => item.id === session.categoryId
  );

  const selectedCar =
    getCarById(session.carId);

  function resetVideo() {
    setFile(null);
    setMetadata(null);
    setVideoUrl("");
    setStartSeconds(0);
    setEndSeconds(0);
    setCurrentTime(0);
    setResult(null);
    setFrame(null);
    setHud({ ...EMPTY_HUD });
    setReadings([]);
    setError("");
  }

  // Atualiza as selecoes e evita
  // combinacoes de ano/categoria/carro
  // que nao pertencam ao mesmo filtro.

  function changeSimulator(value: string) {
    setSession({
      ...EMPTY_SESSION,
      simulatorId: value,
    });

    resetVideo();
  }

  function changeYear(value: string) {
    const year = Number(value);

    setSession((previous) => ({
      ...previous,
      year,
      categoryId: "",
      carId: "",
    }));

    resetVideo();
  }

  function changeCategory(value: string) {
    setSession((previous) => ({
      ...previous,
      categoryId: value,
      carId: "",
    }));

    resetVideo();
  }

  function changeTrack(value: string) {
    setSession((previous) => ({
      ...previous,
      trackId: value,
    }));

    resetVideo();
  }

  function changeCar(value: string) {
    setSession((previous) => ({
      ...previous,
      carId: value,
    }));

    resetVideo();
  }

  // Cria URL temporaria do arquivo
  // para reproduzir no navegador.

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

  // Leitura dos metadados do video.

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
        const info =
          await readVideoMetadata(selectedFile);

        if (cancelled) return;

        setMetadata(info);
        setStartSeconds(0);
        setEndSeconds(info.durationSeconds);
      } catch (caughtError) {
        if (cancelled) return;

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Nao foi possivel abrir o video."
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
    if (!validSession) {
      setError(
        "Preencha a configuracao da sessao primeiro."
      );
      return;
    }

    setFile(
      event.target.files?.[0] ?? null
    );

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
      Math.min(
        seconds,
        metadata.durationSeconds
      )
    );

    videoRef.current.currentTime = safeTime;
    setCurrentTime(safeTime);
  }

  function markBoundary(
    which: "start" | "end"
  ) {
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
    if (!metadata || !validSession) {
      setError(
        "Configure a sessao e envie um video."
      );
      return;
    }

    try {
      const analysis =
        prepareVideoAnalysis(
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
          : "Nao foi possivel preparar a volta."
      );
    }
  }

  async function captureHudFrame() {
    if (
      !file ||
      !metadata ||
      capturing
    ) {
      return;
    }

    setCapturing(true);
    setError("");
    setFrame(null);
    setHud({ ...EMPTY_HUD });

    try {
      const requestedTime = Math.max(
        0,
        Math.min(
          videoRef.current?.currentTime ??
            currentTime,
          metadata.durationSeconds - 0.05
        )
      );

      const captured =
        await extractVideoFrame(
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
          : "Nao foi possivel capturar a imagem."
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
          "A marcha precisa ser um numero inteiro."
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
        "combustivel",
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
          : "Nao foi possivel registrar a leitura."
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
          ← Voltar a telemetria
        </a>

        <p className="mt-10 font-bold tracking-widest text-cyan-400">
          APEX AI
        </p>

        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
          Analise de video
        </h1>

        <p className="mt-4 text-slate-400">
          Configure sua sessao, envie uma
          gravacao do ACC e prepare sua volta.
        </p>

        {/* SECAO 1 - CONFIGURACAO */}

        <section className={sectionStyle}>
          <p className="font-semibold tracking-widest text-cyan-400">
            APEX AI SESSION
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            1. Configurar sessao
          </h2>

          <p className="mt-3 text-sm text-slate-400">
            Escolha o jogo, o ano do modelo,
            a categoria, a pista e o carro.
            A lista de carros sera filtrada
            automaticamente.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              Jogo

              <select
                value={session.simulatorId}
                onChange={(event) =>
                  changeSimulator(
                    event.target.value
                  )
                }
                className={inputStyle}
              >
                <option value="">
                  Selecione o jogo
                </option>

                {SIMULATORS.map((simulator) => (
                  <option
                    key={simulator.id}
                    value={simulator.id}
                  >
                    {simulator.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-300">
              Ano do modelo

              <select
                value={session.year || ""}
                disabled={!session.simulatorId}
                onChange={(event) =>
                  changeYear(event.target.value)
                }
                className={inputStyle}
              >
                <option value="">
                  Selecione o ano
                </option>

                {ACC_YEARS.map((year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-300">
              Categoria

              <select
                value={session.categoryId}
                disabled={!session.year}
                onChange={(event) =>
                  changeCategory(
                    event.target.value
                  )
                }
                className={inputStyle}
              >
                <option value="">
                  Selecione a categoria
                </option>

                {availableCategories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block text-sm text-slate-300">
              Pista

              <select
                value={session.trackId}
                disabled={!session.simulatorId}
                onChange={(event) =>
                  changeTrack(
                    event.target.value
                  )
                }
                className={inputStyle}
              >
                <option value="">
                  Selecione a pista
                </option>

                {ACC_TRACKS.map((track) => (
                  <option
                    key={track.id}
                    value={track.id}
                  >
                    {track.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-300 sm:col-span-2">
              Carro

              <select
                value={session.carId}
                disabled={
                  !session.year ||
                  !session.categoryId
                }
                onChange={(event) =>
                  changeCar(event.target.value)
                }
                className={inputStyle}
              >
                <option value="">
                  Selecione o carro
                </option>

                {availableCars.map((car) => (
                  <option
                    key={car.id}
                    value={car.id}
                  >
                    {car.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {session.year > 0 &&
            session.categoryId &&
            availableCars.length === 0 && (
              <p className="mt-4 text-amber-300">
                Nenhum carro encontrado
                para essa combinacao.
              </p>
            )}

          {validSession && (
            <div className="mt-6 rounded-xl border border-green-800 bg-slate-950 p-5">
              <p className="font-semibold text-green-400">
                Sessao configurada!
              </p>

              <p className="mt-3 text-sm text-slate-300">
                {selectedSimulator?.name}
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Ano: {session.year}
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Categoria:{" "}
                {selectedCategory?.name}
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Pista: {selectedTrack?.name}
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Carro: {selectedCar?.name}
              </p>

              {selectedCar?.dlc && (
                <p className="mt-3 text-xs text-amber-300">
                  Pacote associado:{" "}
                  {selectedCar.dlc}
                </p>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            O filtro utiliza o ano do
            modelo, nao a temporada oficial
            de um campeonato.
          </p>
        </section>

        {/* SECAO 2 - VIDEO */}

        <section className={sectionStyle}>
          <h2 className="text-2xl font-bold">
            2. Enviar video
          </h2>

          <p className="mt-3 text-sm text-slate-400">
            Primeiro configure sua sessao.
            Depois selecione um video MP4,
            MOV ou WEBM de ate 500 MB.
          </p>

          {!validSession && (
            <p className="mt-4 text-amber-300">
              Preencha os cinco campos
              acima para liberar o envio.
            </p>
          )}

          {validSession && (
            <input
              key={
                session.simulatorId +
                session.year +
                session.categoryId +
                session.trackId +
                session.carId
              }
              type="file"
              accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
              onChange={handleFileChange}
              className="mt-6 block w-full text-sm"
            />
          )}

          {loading && (
            <p className="mt-4 text-cyan-400">
              Lendo video...
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
                  Duracao
                </p>

                <p className="mt-1 font-bold">
                  {formatLapTime(
                    metadata.durationSeconds
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 p-4">
                <p className="text-xs text-slate-400">
                  Resolucao
                </p>

                <p className="mt-1 font-medium">
                  {metadata.width} x{" "}
                  {metadata.height}
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
            {/* SECAO 3 - REPRODUCAO */}

            <section className={sectionStyle}>
              <h2 className="text-2xl font-bold">
                3. Revisar gravacao
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Assista ao video e
                localize os momentos
                importantes da volta.
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
                  Posicao atual do video
                </p>

                <p className="mt-1 text-2xl font-bold text-cyan-400">
                  {formatLapTime(currentTime)}
                </p>

                <input
                  type="range"
                  aria-label="Posicao no video"
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

            {/* SECAO 4 - VOLTA */}

            <section className={sectionStyle}>
              <h2 className="text-2xl font-bold">
                4. Definir inicio e fim
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Pause o video nos pontos
                de inicio e fim da volta.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <label
                    htmlFor="lap-start"
                    className="font-semibold text-green-400"
                  >
                    Inicio da volta (segundos)
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
                    className={inputStyle}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      markBoundary("start")
                    }
                    className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 font-semibold hover:bg-green-500"
                  >
                    Marcar inicio aqui
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      jumpToTime(startSeconds)
                    }
                    className="mt-3 w-full rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
                  >
                    Ver inicio no video
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
                    className={inputStyle}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      markBoundary("end")
                    }
                    className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-500"
                  >
                    Marcar fim aqui
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      jumpToTime(endSeconds)
                    }
                    className="mt-3 w-full rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
                  >
                    Ver fim no video
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-slate-950 p-6 text-center">
                <p className="text-sm text-slate-400">
                  Tempo selecionado
                </p>

                <p className="mt-2 text-4xl font-bold text-cyan-400">
                  {selectedDuration > 0
                    ? formatLapTime(
                        selectedDuration
                      )
                    : "--:--.---"}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  O tempo depende dos
                  pontos escolhidos no video.
                </p>
              </div>

              <button
                type="button"
                onClick={analyzeVideo}
                className="mt-6 w-full rounded-xl bg-cyan-500 px-6 py-4 text-lg font-bold text-slate-950 hover:bg-cyan-400"
              >
                Preparar analise da volta
              </button>
            </section>

            {/* SECAO 5 - HUD */}

            <section className={sectionStyle}>
              <p className="font-semibold tracking-widest text-cyan-400">
                APEX AI VISION
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                5. Capturar imagem do HUD
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Pause o video e capture
                uma imagem do painel.
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
                    {formatLapTime(
                      frame.timeSeconds
                    )}
                  </p>

                  <img
                    src={frame.imageDataUrl}
                    alt="Quadro extraido do ACC"
                    className="mt-4 w-full rounded-lg"
                  />

                  <p className="mt-3 text-xs text-slate-500">
                    Captura local no
                    navegador. A leitura
                    automatica sera
                    desenvolvida depois.
                  </p>
                </div>
              )}
            </section>

            {/* SECAO 6 - LEITURA MANUAL */}

            {frame && (
              <section className={sectionStyle}>
                <p className="font-semibold tracking-widest text-cyan-400">
                  APEX AI HUD
                </p>

                <h2 className="mt-3 text-2xl font-bold">
                  6. Leitura experimental
                </h2>

                <p className="mt-3 text-sm text-slate-400">
                  Digite os dados visiveis
                  no quadro. Essa etapa
                  e manual e sera
                  automatizada futuramente.
                </p>

                <p className="mt-4 text-sm text-cyan-400">
                  Quadro:{" "}
                  {formatLapTime(
                    frame.timeSeconds
                  )}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <MetricField
                    label="Velocidade (km/h) *"
                    value={hud.speed}
                    onChange={(value) =>
                      updateHud(
                        "speed",
                        value
                      )
                    }
                    placeholder="Ex.: 171"
                  />

                  <MetricField
                    label="Marcha * (-1 a 10)"
                    value={hud.gear}
                    onChange={(value) =>
                      updateHud(
                        "gear",
                        value
                      )
                    }
                    placeholder="Ex.: 3"
                  />

                  <MetricField
                    label="RPM (opcional)"
                    value={hud.rpm}
                    onChange={(value) =>
                      updateHud(
                        "rpm",
                        value
                      )
                    }
                  />

                  <MetricField
                    label="Combustivel (L)"
                    value={hud.fuel}
                    onChange={(value) =>
                      updateHud(
                        "fuel",
                        value
                      )
                    }
                  />
                </div>

                <h3 className="mt-6 font-semibold">
                  Pressao dos pneus (psi)
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <MetricField
                    label="Dianteiro esquerdo"
                    value={hud.frontLeft}
                    onChange={(value) =>
                      updateHud(
                        "frontLeft",
                        value
                      )
                    }
                  />

                  <MetricField
                    label="Dianteiro direito"
                    value={hud.frontRight}
                    onChange={(value) =>
                      updateHud(
                        "frontRight",
                        value
                      )
                    }
                  />

                  <MetricField
                    label="Traseiro esquerdo"
                    value={hud.rearLeft}
                    onChange={(value) =>
                      updateHud(
                        "rearLeft",
                        value
                      )
                    }
                  />

                  <MetricField
                    label="Traseiro direito"
                    value={hud.rearRight}
                    onChange={(value) =>
                      updateHud(
                        "rearRight",
                        value
                      )
                    }
                  />
                </div>

                <label className="mt-6 block text-sm text-slate-300">
                  Observacoes (opcional)

                  <textarea
                    rows={3}
                    value={hud.notes}
                    onChange={(event) =>
                      updateHud(
                        "notes",
                        event.target.value
                      )
                    }
                    className={inputStyle}
                    placeholder="Ex.: saida da curva..."
                  />
                </label>

                <button
                  type="button"
                  onClick={saveHudReading}
                  className="mt-5 w-full rounded-xl bg-green-600 px-6 py-4 font-bold hover:bg-green-500"
                >
                  Registrar leitura manual
                </button>
              </section>
            )}

            {/* LEITURAS SALVAS NA SESSAO */}

            {readings.length > 0 && (
              <section className={sectionStyle}>
                <h2 className="text-2xl font-bold text-cyan-400">
                  Leituras registradas
                </h2>

                <p className="mt-3 text-sm text-slate-400">
                  Dados anotados manualmente.
                  Eles ficam apenas nesta
                  sessao do navegador.
                </p>

                <div className="mt-5 space-y-3">
                  {readings.map(
                    (reading, index) => (
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
                          {reading.speed} km/h
                          {" · "}
                          Marcha{" "}
                          {reading.gear === 0
                            ? "N"
                            : reading.gear === -1
                              ? "R"
                              : reading.gear}
                        </p>

                        {reading.rpm !==
                          undefined && (
                          <p className="text-sm text-slate-300">
                            RPM:{" "}
                            {reading.rpm}
                          </p>
                        )}

                        {reading.fuel !==
                          undefined && (
                          <p className="text-sm text-slate-300">
                            Combustivel:{" "}
                            {reading.fuel} L
                          </p>
                        )}

                        {Object.values(
                          reading.pressures
                        ).some(
                          (value) =>
                            value !== undefined
                        ) && (
                          <p className="mt-1 text-sm text-slate-300">
                            Pneus (psi):
                            {" DE: "}
                            {reading.pressures
                              .frontLeft ?? "—"}
                            {" | DD: "}
                            {reading.pressures
                              .frontRight ?? "—"}
                            {" | TE: "}
                            {reading.pressures
                              .rearLeft ?? "—"}
                            {" | TD: "}
                            {reading.pressures
                              .rearRight ?? "—"}
                          </p>
                        )}

                        {reading.notes && (
                          <p className="mt-2 text-sm text-slate-400">
                            {reading.notes}
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {/* RESULTADO DO INTERVALO */}

        {result && (
          <section className={sectionStyle}>
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
                Inicio:{" "}
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
                Trecho excluido do comeco:{" "}
                {result.lap.excludedStartSeconds.toFixed(
                  3
                )}{" "}
                s
              </p>

              <p>
                Trecho excluido do final:{" "}
                {result.lap.excludedEndSeconds.toFixed(
                  3
                )}{" "}
                s
              </p>
            </div>

            <p className="mt-5 text-slate-300">
              {result.message}
            </p>

            <p className="mt-4 text-sm text-amber-300">
              Esta versao ainda nao
              identifica automaticamente
              erros de pilotagem.
              O video permanece no
              navegador.
            </p>
          </section>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">
          Apex AI · Modulo experimental de video
        </p>
      </div>
    </main>
  );
}
