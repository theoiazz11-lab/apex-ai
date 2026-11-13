
/**
 * APEX AI
 * Frame Extractor
 *
 * Captura imagens de vídeos diretamente
 * no navegador, em tempos específicos.
 *
 * Ainda não reconhece velocidade,
 * marchas ou dados de telemetria.
 */

export type ExtractedFrame = {
  timeSeconds: number;
  imageDataUrl: string;
  width: number;
  height: number;
};

export type FrameExtractionOptions = {
  maxWidth?: number;
  quality?: number;
};

export async function extractVideoFrame(
  file: File,
  timeSeconds: number,
  options: FrameExtractionOptions = {}
): Promise<ExtractedFrame> {
  if (
    !Number.isFinite(timeSeconds) ||
    timeSeconds < 0
  ) {
    throw new Error(
      "O tempo solicitado precisa ser válido."
    );
  }

  if (
    typeof document === "undefined" ||
    typeof URL === "undefined"
  ) {
    throw new Error(
      "A captura de imagens precisa ser executada no navegador."
    );
  }

  const maxWidth = options.maxWidth ?? 1280;
  const quality = options.quality ?? 0.85;

  if (
    !Number.isFinite(maxWidth) ||
    maxWidth <= 0 ||
    !Number.isFinite(quality) ||
    quality < 0 ||
    quality > 1
  ) {
    throw new Error(
      "As opções de captura são inválidas."
    );
  }

  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);

  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  function waitForEvent(
    successEvent: string,
    errorMessage: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error(errorMessage));
      }, 15000);

      function cleanup() {
        window.clearTimeout(timeout);

        video.removeEventListener(
          successEvent,
          onSuccess
        );

        video.removeEventListener(
          "error",
          onError
        );
      }

      function onSuccess() {
        cleanup();
        resolve();
      }

      function onError() {
        cleanup();
        reject(new Error(errorMessage));
      }

      video.addEventListener(
        successEvent,
        onSuccess,
        { once: true }
      );

      video.addEventListener(
        "error",
        onError,
        { once: true }
      );
    });
  }

  try {
    const metadataReady = waitForEvent(
      "loadedmetadata",
      "Não foi possível carregar os dados do vídeo."
    );

    video.src = objectUrl;
    video.load();

    await metadataReady;

    if (
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      throw new Error(
        "Não foi possível identificar a duração."
      );
    }

    if (timeSeconds >= video.duration) {
      throw new Error(
        "O instante solicitado precisa ser anterior ao fim do vídeo."
      );
    }

    const frameReady = waitForEvent(
      "seeked",
      "Não foi possível localizar o quadro solicitado."
    );

    video.currentTime = timeSeconds;

    await frameReady;

    if (
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      throw new Error(
        "A resolução do vídeo é inválida."
      );
    }

    const scale = Math.min(
      1,
      maxWidth / video.videoWidth
    );

    const width = Math.round(
      video.videoWidth * scale
    );

    const height = Math.round(
      video.videoHeight * scale
    );

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Não foi possível criar a imagem."
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

    return {
      timeSeconds,
      imageDataUrl,
      width,
      height,
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
