
/**
 * APEX AI VISION
 *
 * Extracao de imagens de videos
 * diretamente no navegador.
 *
 * Funcionalidades:
 *
 * 1. Capturar um quadro especifico.
 * 2. Capturar varios quadros automaticamente.
 * 3. Redimensionar as imagens.
 * 4. Preservar a compatibilidade com
 *    a pagina atual de analise de video.
 *
 * A leitura automatica dos numeros
 * do HUD sera feita em outra etapa.
 */

export type FrameExtractionOptions = {
  maxWidth?: number;
  quality?: number;
};

export type ExtractedFrame = {
  timeSeconds: number;
  imageDataUrl: string;
  width: number;
  height: number;
};

export type FrameSamplingOptions =
  FrameExtractionOptions & {
    startSeconds: number;
    endSeconds: number;
    intervalSeconds: number;
    maxFrames?: number;
  };

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_QUALITY = 0.85;
const DEFAULT_MAX_FRAMES = 30;

function validateVideoFile(file: File): void {
  if (!(file instanceof File)) {
    throw new Error(
      "Selecione um arquivo de video valido."
    );
  }

  if (file.size === 0) {
    throw new Error(
      "O arquivo de video esta vazio."
    );
  }
}

function validateOptions(
  options: FrameExtractionOptions
): void {
  if (
    options.maxWidth !== undefined &&
    (
      !Number.isFinite(options.maxWidth) ||
      options.maxWidth <= 0
    )
  ) {
    throw new Error(
      "A largura maxima precisa ser positiva."
    );
  }

  if (
    options.quality !== undefined &&
    (
      !Number.isFinite(options.quality) ||
      options.quality <= 0 ||
      options.quality > 1
    )
  ) {
    throw new Error(
      "A qualidade precisa estar entre 0 e 1."
    );
  }
}

/**
 * Cria um elemento de video temporario.
 *
 * O arquivo nao e enviado para
 * nenhum servidor.
 */
function createVideoElement(): HTMLVideoElement {
  const video = document.createElement("video");

  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  return video;
}

/**
 * Aguarda o navegador carregar
 * os metadados do video.
 */
function waitForMetadata(
  video: HTMLVideoElement
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }

    function cleanup() {
      video.removeEventListener(
        "loadedmetadata",
        handleLoaded
      );

      video.removeEventListener(
        "error",
        handleError
      );
    }

    function handleLoaded() {
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();

      reject(
        new Error(
          "Nao foi possivel carregar os metadados do video."
        )
      );
    }

    video.addEventListener(
      "loadedmetadata",
      handleLoaded
    );

    video.addEventListener(
      "error",
      handleError
    );
  });
}

/**
 * Move o video para o instante desejado.
 *
 * Espera a busca terminar antes
 * de capturar a imagem.
 */
function seekVideo(
  video: HTMLVideoElement,
  timeSeconds: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = video.duration;

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      reject(
        new Error(
          "A duracao do video e invalida."
        )
      );

      return;
    }

    if (
      !Number.isFinite(timeSeconds) ||
      timeSeconds < 0 ||
      timeSeconds > duration
    ) {
      reject(
        new Error(
          "O instante solicitado esta fora do video."
        )
      );

      return;
    }

    const safeTime = Math.min(
      timeSeconds,
      Math.max(0, duration - 0.05)
    );

    const distance = Math.abs(
      video.currentTime - safeTime
    );

    if (
      distance < 0.001 &&
      video.readyState >= 2
    ) {
      resolve();
      return;
    }

    function cleanup() {
      video.removeEventListener(
        "seeked",
        handleSeeked
      );

      video.removeEventListener(
        "error",
        handleError
      );
    }

    function handleSeeked() {
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();

      reject(
        new Error(
          "Nao foi possivel acessar esse instante do video."
        )
      );
    }

    video.addEventListener(
      "seeked",
      handleSeeked
    );

    video.addEventListener(
      "error",
      handleError
    );

    try {
      video.currentTime = safeTime;
    } catch {
      cleanup();

      reject(
        new Error(
          "Falha ao posicionar o video."
        )
      );
    }
  });
}

/**
 * Aguarda o quadro estar disponivel
 * para desenhar no canvas.
 */
function waitForFrame(
  video: HTMLVideoElement
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }

    function cleanup() {
      video.removeEventListener(
        "loadeddata",
        handleReady
      );

      video.removeEventListener(
        "error",
        handleError
      );
    }

    function handleReady() {
      cleanup();
      resolve();
    }

    function handleError() {
      cleanup();

      reject(
        new Error(
          "O navegador nao conseguiu decodificar o quadro."
        )
      );
    }

    video.addEventListener(
      "loadeddata",
      handleReady
    );

    video.addEventListener(
      "error",
      handleError
    );
  });
}

/**
 * Converte o quadro atual do video
 * em uma imagem JPEG.
 */
function captureCurrentFrame(
  video: HTMLVideoElement,
  timeSeconds: number,
  options: FrameExtractionOptions
): ExtractedFrame {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error(
      "Nao foi possivel identificar a resolucao do video."
    );
  }

  const maxWidth =
    options.maxWidth ?? DEFAULT_MAX_WIDTH;

  const quality =
    options.quality ?? DEFAULT_QUALITY;

  const scale = Math.min(
    1,
    maxWidth / sourceWidth
  );

  const width = Math.max(
    1,
    Math.round(sourceWidth * scale)
  );

  const height = Math.max(
    1,
    Math.round(sourceHeight * scale)
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Nao foi possivel criar o contexto de imagem."
    );
  }

  context.drawImage(
    video,
    0,
    0,
    width,
    height
  );

  const imageDataUrl = canvas.toDataURL(
    "image/jpeg",
    quality
  );

  canvas.width = 0;
  canvas.height = 0;

  return {
    timeSeconds,
    imageDataUrl,
    width,
    height,
  };
}

/**
 * Abre um arquivo e executa uma
 * operacao usando o mesmo video.
 *
 * O recurso temporario e liberado
 * mesmo se ocorrer algum erro.
 */
async function withVideo<T>(
  file: File,
  operation: (
    video: HTMLVideoElement
  ) => Promise<T>
): Promise<T> {
  validateVideoFile(file);

  if (typeof document === "undefined") {
    throw new Error(
      "A extracao de imagens precisa ser executada no navegador."
    );
  }

  const video = createVideoElement();

  const url = URL.createObjectURL(file);

  try {
    const metadataPromise =
      waitForMetadata(video);

    video.src = url;

    video.load();

    await metadataPromise;

    return await operation(video);
  } finally {
    video.pause();

    video.removeAttribute("src");

    video.load();

    URL.revokeObjectURL(url);
  }
}

/**
 * FUNCAO 1
 *
 * Extrai uma imagem em um instante
 * especifico do video.
 *
 * Esta funcao continua sendo usada
 * pela pagina atual do Apex AI.
 */
export async function extractVideoFrame(
  file: File,
  timeSeconds: number,
  options: FrameExtractionOptions = {}
): Promise<ExtractedFrame> {
  validateOptions(options);

  return withVideo(file, async (video) => {
    await seekVideo(
      video,
      timeSeconds
    );

    await waitForFrame(video);

    return captureCurrentFrame(
      video,
      Math.min(
        timeSeconds,
        Math.max(0, video.duration - 0.05)
      ),
      options
    );
  });
}

/**
 * FUNCAO 2
 *
 * Extrai imagens automaticamente
 * de um intervalo do video.
 *
 * Exemplo:
 *
 * Inicio: 2 segundos
 * Fim: 12 segundos
 * Intervalo: 2 segundos
 *
 * Quadros capturados:
 *
 * 2s, 4s, 6s, 8s, 10s e 12s.
 *
 * Essa funcao prepara os dados
 * para a futura leitura automatica
 * do HUD do ACC.
 */
export async function extractVideoFrames(
  file: File,
  options: FrameSamplingOptions
): Promise<ExtractedFrame[]> {
  validateOptions(options);

  const {
    startSeconds,
    endSeconds,
    intervalSeconds,
    maxFrames = DEFAULT_MAX_FRAMES,
  } = options;

  if (
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    startSeconds < 0 ||
    endSeconds <= startSeconds
  ) {
    throw new Error(
      "Defina um intervalo de video valido."
    );
  }

  if (
    !Number.isFinite(intervalSeconds) ||
    intervalSeconds <= 0
  ) {
    throw new Error(
      "O intervalo entre imagens precisa ser positivo."
    );
  }

  if (
    !Number.isInteger(maxFrames) ||
    maxFrames < 1 ||
    maxFrames > 120
  ) {
    throw new Error(
      "O limite deve estar entre 1 e 120 imagens."
    );
  }

  return withVideo(file, async (video) => {
    if (
      startSeconds >= video.duration ||
      endSeconds > video.duration
    ) {
      throw new Error(
        "O intervalo escolhido ultrapassa a duracao do video."
      );
    }

    const estimatedFrames =
      Math.floor(
        (endSeconds - startSeconds) /
          intervalSeconds +
          1e-9
      ) + 1;

    if (estimatedFrames > maxFrames) {
      throw new Error(
        `Esse intervalo geraria ${estimatedFrames} imagens. ` +
        `Aumente o intervalo entre capturas ou use no maximo ${maxFrames} imagens.`
      );
    }

    const frames: ExtractedFrame[] = [];

    for (
      let index = 0;
      index < estimatedFrames;
      index++
    ) {
      const timeSeconds = Math.min(
        endSeconds,
        startSeconds +
          index * intervalSeconds
      );

      await seekVideo(
        video,
        timeSeconds
      );

      await waitForFrame(video);

      const frame = captureCurrentFrame(
        video,
        Math.min(
          timeSeconds,
          Math.max(
            0,
            video.duration - 0.05
          )
        ),
        options
      );

      frames.push(frame);
    }

    return frames;
  });
}
