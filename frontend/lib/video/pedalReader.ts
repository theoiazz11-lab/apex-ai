
/**
 * APEX AI VISION
 * Experimental ACC Pedal Reader
 *
 * Examines the visual characteristics
 * of the throttle and brake HUD rows.
 *
 * IMPORTANT:
 * TC, TC2, ABS and BB are vehicle
 * settings, not pedal pressure values.
 *
 * The results describe image pixels.
 * They do not represent pedal input
 * percentages or confirmed braking.
 */

import type {
  PedalCrop,
  PedalDetectionResult,
} from "./hudDetector";

export type PedalIndicatorName =
  | "throttle"
  | "brake";

export type PedalVisualMetrics = {
  name: PedalIndicatorName;
  coloredPixelRatio: number;
  brightPixelRatio: number;
  averageBrightness: number;
  averageSaturation: number;
  sampledPixels: number;
};

export type PedalReadingResult = {
  timeSeconds: number;
  throttle: PedalVisualMetrics;
  brake: PedalVisualMetrics;
  calibrated: false;
  throttlePercent: null;
  brakePercent: null;
  warnings: string[];
};

export type PedalVisualChange = {
  fromSeconds: number;
  toSeconds: number;
  throttleColorChange: number;
  brakeColorChange: number;
  throttleBrightnessChange: number;
  brakeBrightnessChange: number;
};

type RelativeRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Pixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

/**
 * Experimental regions inside
 * the existing pedal crop.
 *
 * These coordinates must be checked
 * against more ACC recordings.
 *
 * They intentionally avoid much
 * of the speedometer on the left.
 */

const PEDAL_ROW_REGIONS: Record<
  PedalIndicatorName,
  RelativeRegion
> = {
  throttle: {
    x: 0.36,
    y: 0.37,
    width: 0.62,
    height: 0.22,
  },
  brake: {
    x: 0.36,
    y: 0.60,
    width: 0.62,
    height: 0.22,
  },
};

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  );
}

function round(
  value: number,
  decimals = 4
): number {
  const factor = 10 ** decimals;

  return Math.round(
    value * factor
  ) / factor;
}

function validateRegion(
  region: RelativeRegion
): void {
  const values = [
    region.x,
    region.y,
    region.width,
    region.height,
  ];

  if (
    !values.every(Number.isFinite) ||
    region.x < 0 ||
    region.y < 0 ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.x + region.width > 1 ||
    region.y + region.height > 1
  ) {
    throw new Error(
      "Região visual dos pedais inválida."
    );
  }
}

function loadImage(
  source: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (
      typeof document === "undefined" ||
      !source
    ) {
      reject(
        new Error(
          "A leitura dos pedais precisa executar no navegador."
        )
      );
      return;
    }

    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(
        new Error(
          "Não foi possível carregar o recorte dos pedais."
        )
      );
    };

    image.src = source;
  });
}

function getPixel(
  data: Uint8ClampedArray,
  offset: number
): Pixel {
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3],
  };
}

function calculateBrightness(
  pixel: Pixel
): number {
  return (
    0.2126 * pixel.r +
    0.7152 * pixel.g +
    0.0722 * pixel.b
  ) / 255;
}

function calculateSaturation(
  pixel: Pixel
): number {
  const highest = Math.max(
    pixel.r,
    pixel.g,
    pixel.b
  );

  const lowest = Math.min(
    pixel.r,
    pixel.g,
    pixel.b
  );

  if (highest === 0) {
    return 0;
  }

  return (
    highest - lowest
  ) / highest;
}

function measureRegion(
  imageData: ImageData,
  name: PedalIndicatorName,
  region: RelativeRegion
): PedalVisualMetrics {
  validateRegion(region);

  const imageWidth = imageData.width;
  const imageHeight = imageData.height;

  const xStart = clamp(
    Math.floor(region.x * imageWidth),
    0,
    imageWidth - 1
  );

  const yStart = clamp(
    Math.floor(region.y * imageHeight),
    0,
    imageHeight - 1
  );

  const xEnd = clamp(
    Math.ceil(
      (region.x + region.width) *
        imageWidth
    ),
    xStart + 1,
    imageWidth
  );

  const yEnd = clamp(
    Math.ceil(
      (region.y + region.height) *
        imageHeight
    ),
    yStart + 1,
    imageHeight
  );

  let sampledPixels = 0;
  let coloredPixels = 0;
  let brightPixels = 0;

  let totalBrightness = 0;
  let totalSaturation = 0;

  const pixels = imageData.data;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const offset =
        (y * imageWidth + x) * 4;

      const pixel = getPixel(
        pixels,
        offset
      );

      if (pixel.a < 128) {
        continue;
      }

      const brightness =
        calculateBrightness(pixel);

      const saturation =
        calculateSaturation(pixel);

      sampledPixels++;

      totalBrightness += brightness;
      totalSaturation += saturation;

      if (brightness >= 0.65) {
        brightPixels++;
      }

      if (
        saturation >= 0.35 &&
        brightness >= 0.18
      ) {
        coloredPixels++;
      }
    }
  }

  if (sampledPixels === 0) {
    throw new Error(
      `Nenhum pixel válido na região ${name}.`
    );
  }

  return {
    name,
    coloredPixelRatio: round(
      coloredPixels / sampledPixels
    ),
    brightPixelRatio: round(
      brightPixels / sampledPixels
    ),
    averageBrightness: round(
      totalBrightness / sampledPixels
    ),
    averageSaturation: round(
      totalSaturation / sampledPixels
    ),
    sampledPixels,
  };
}

async function getCropImageData(
  crop: PedalCrop
): Promise<ImageData> {
  const image = await loadImage(
    crop.imageDataUrl
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext(
    "2d",
    { willReadFrequently: true }
  );

  if (!context) {
    throw new Error(
      "Não foi possível analisar os pixels do HUD."
    );
  }

  context.drawImage(
    image,
    0,
    0
  );

  const imageData =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

  canvas.width = 0;
  canvas.height = 0;

  return imageData;
}

/**
 * Reads visual characteristics of
 * both rows from one HUD crop.
 *
 * The result is NOT calibrated
 * into pedal pressure percentages.
 */

export async function readAccPedalIndicators(
  detection: PedalDetectionResult
): Promise<PedalReadingResult> {
  if (
    !Number.isFinite(detection.timeSeconds)
  ) {
    throw new Error(
      "Instante do vídeo inválido."
    );
  }

  const imageData =
    await getCropImageData(
      detection.crop
    );

  const throttle = measureRegion(
    imageData,
    "throttle",
    PEDAL_ROW_REGIONS.throttle
  );

  const brake = measureRegion(
    imageData,
    "brake",
    PEDAL_ROW_REGIONS.brake
  );

  return {
    timeSeconds: detection.timeSeconds,
    throttle,
    brake,
    calibrated: false,
    throttlePercent: null,
    brakePercent: null,
    warnings: [
      "As métricas representam características dos pixels, não a pressão dos pedais.",
      "As regiões ainda precisam de calibração visual.",
      "Textos e configurações TC, TC2, ABS e BB podem influenciar as medições.",
      "Mudanças de cor ou brilho não comprovam aplicação dos pedais.",
    ],
  };
}

/**
 * Processes multiple video samples
 * in chronological order.
 */

export async function readAccPedalIndicatorsBatch(
  detections: PedalDetectionResult[]
): Promise<PedalReadingResult[]> {
  const results: PedalReadingResult[] = [];

  for (const detection of detections) {
    const reading =
      await readAccPedalIndicators(
        detection
      );

    results.push(reading);
  }

  return results.sort(
    (a, b) =>
      a.timeSeconds - b.timeSeconds
  );
}

/**
 * Compares the appearance of two
 * samples.
 *
 * Differences describe visual changes
 * only, not acceleration or braking.
 */

export function comparePedalVisualReadings(
  first: PedalReadingResult,
  second: PedalReadingResult
): PedalVisualChange {
  if (
    second.timeSeconds <= first.timeSeconds
  ) {
    throw new Error(
      "A segunda amostra deve ser posterior à primeira."
    );
  }

  return {
    fromSeconds: first.timeSeconds,
    toSeconds: second.timeSeconds,

    throttleColorChange: round(
      second.throttle.coloredPixelRatio -
      first.throttle.coloredPixelRatio
    ),

    brakeColorChange: round(
      second.brake.coloredPixelRatio -
      first.brake.coloredPixelRatio
    ),

    throttleBrightnessChange: round(
      second.throttle.averageBrightness -
      first.throttle.averageBrightness
    ),

    brakeBrightnessChange: round(
      second.brake.averageBrightness -
      first.brake.averageBrightness
    ),
  };
}
