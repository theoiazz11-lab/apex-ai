
/**
 * APEX AI
 * Video Analyzer - Initial Module
 *
 * Prepares videos for lap analysis.
 * Supports browser-compatible video files.
 *
 * Current features:
 * - Video file validation
 * - Video duration detection
 * - Lap start/end selection
 * - Estimated lap time calculation
 *
 * Future features:
 * - Speed recognition from HUD
 * - Gear recognition from HUD
 * - Brake and throttle recognition
 * - AI coaching based on video analysis
 */

export type VideoMetadata = {
  fileName: string;
  fileSizeMB: number;
  fileType: string;
  durationSeconds: number;
  width: number;
  height: number;
};

export type LapInterval = {
  startSeconds: number;
  endSeconds: number;
  lapTimeSeconds: number;
  excludedStartSeconds: number;
  excludedEndSeconds: number;
};

export type VideoAnalysisResult = {
  metadata: VideoMetadata;
  lap: LapInterval;
  status: "ready";
  message: string;
};

const MAX_VIDEO_SIZE_MB = 500;

const ALLOWED_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
];

function hasAllowedExtension(
  fileName: string
): boolean {
  const lowerName = fileName.toLowerCase();

  return ALLOWED_EXTENSIONS.some(
    (extension) => lowerName.endsWith(extension)
  );
}

/**
 * Checks whether the selected video
 * satisfies basic upload requirements.
 */
export function validateVideoFile(
  file: File
): void {
  if (!file) {
    throw new Error(
      "Nenhum vídeo foi selecionado."
    );
  }

  if (!hasAllowedExtension(file.name)) {
    throw new Error(
      "Formato não aceito. Use MP4, WEBM ou MOV."
    );
  }

  if (file.size === 0) {
    throw new Error(
      "O arquivo de vídeo está vazio."
    );
  }

  const sizeMB =
    file.size / (1024 * 1024);

  if (sizeMB > MAX_VIDEO_SIZE_MB) {
    throw new Error(
      "O vídeo ultrapassa o limite de 500 MB."
    );
  }
}

/**
 * Reads video metadata in the browser.
 *
 * This does not upload the video.
 * It only reads the local file.
 *
 * The browser must support the
 * video container and codec.
 */
export function readVideoMetadata(
  file: File
): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    try {
      validateVideoFile(file);
    } catch (error) {
      reject(error);
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof document === "undefined"
    ) {
      reject(
        new Error(
          "A leitura do vídeo deve ser feita no navegador."
        )
      );
      return;
    }

    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;

    const url = URL.createObjectURL(file);

    let finished = false;

    function cleanup() {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }

    function fail(message: string) {
      if (finished) return;

      finished = true;
      cleanup();
      reject(new Error(message));
    }

    video.onloadedmetadata = () => {
      if (finished) return;

      const duration = video.duration;

      if (
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        fail(
          "Não foi possível determinar a duração do vídeo."
        );
        return;
      }

      finished = true;

      const metadata: VideoMetadata = {
        fileName: file.name,
        fileSizeMB:
          file.size / (1024 * 1024),
        fileType:
          file.type || "Não informado",
        durationSeconds: duration,
        width: video.videoWidth,
        height: video.videoHeight,
      };

      cleanup();
      resolve(metadata);
    };

    video.onerror = () => {
      fail(
        "Não foi possível abrir o vídeo. Verifique se o formato é compatível com o navegador."
      );
    };

    video.src = url;
  });
}

/**
 * Calculates the interval selected
 * as one complete racing lap.
 *
 * Start and end must be confirmed
 * from the video when possible.
 */
export function calculateLapInterval(
  videoDurationSeconds: number,
  startSeconds: number,
  endSeconds: number
): LapInterval {
  if (
    !Number.isFinite(videoDurationSeconds) ||
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds)
  ) {
    throw new Error(
      "Os tempos informados são inválidos."
    );
  }

  if (
    videoDurationSeconds <= 0 ||
    startSeconds < 0 ||
    endSeconds <= startSeconds ||
    endSeconds > videoDurationSeconds
  ) {
    throw new Error(
      "O início e o fim da volta precisam estar dentro da duração do vídeo."
    );
  }

  return {
    startSeconds,
    endSeconds,
    lapTimeSeconds:
      endSeconds - startSeconds,
    excludedStartSeconds: startSeconds,
    excludedEndSeconds:
      videoDurationSeconds - endSeconds,
  };
}

/**
 * Converts seconds to a racing lap time.
 *
 * Example:
 * 127.5 -> "2:07.500"
 */
export function formatLapTime(
  seconds: number
): string {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return "--:--.---";
  }

  const totalMilliseconds =
    Math.round(seconds * 1000);

  const minutes = Math.floor(
    totalMilliseconds / 60000
  );

  const remainingMilliseconds =
    totalMilliseconds % 60000;

  const wholeSeconds = Math.floor(
    remainingMilliseconds / 1000
  );

  const milliseconds =
    remainingMilliseconds % 1000;

  return (
    `${minutes}:` +
    `${String(wholeSeconds).padStart(2, "0")}.` +
    `${String(milliseconds).padStart(3, "0")}`
  );
}

/**
 * Creates the initial analysis result.
 *
 * This function does not identify
 * driving mistakes or read the HUD.
 */
export function prepareVideoAnalysis(
  metadata: VideoMetadata,
  startSeconds: number,
  endSeconds: number
): VideoAnalysisResult {
  const lap = calculateLapInterval(
    metadata.durationSeconds,
    startSeconds,
    endSeconds
  );

  return {
    metadata,
    lap,
    status: "ready",
    message:
      "Vídeo validado e intervalo da volta definido. Pronto para futuras etapas de extração de dados.",
  };
}
