
/**
 * APEX AI VISION
 * HUD Detector - Assetto Corsa Competizione
 *
 * Localiza e recorta:
 * - Marcha
 * - Velocidade
 * - Painel completo
 *
 * Correção:
 * A região da marcha foi deslocada
 * para a direita para evitar cortar
 * o número.
 *
 * A região da velocidade foi mantida,
 * pois já reconheceu 204 km/h.
 *
 * Este módulo prepara imagens para OCR.
 * Ele não reconhece números sozinho.
 */

import type {
  ExtractedFrame,
} from "./frameExtractor";

export type HudRegionName =
  | "speed"
  | "gear"
  | "dashboard";

export type HudRegion = {
  name: HudRegionName;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HudCrop = {
  name: HudRegionName;
  imageDataUrl: string;
  width: number;
  height: number;
};

export type HudDetectionResult = {
  timeSeconds: number;
  originalWidth: number;
  originalHeight: number;
  crops: HudCrop[];
};

/**
 * Coordenadas proporcionais à imagem.
 *
 * x: posição horizontal
 * y: posição vertical
 *
 * Valores entre 0 e 1.
 *
 * Ajustes baseados no HUD mostrado
 * nas capturas de Silverstone.
 */

export const ACC_HUD_REGIONS: HudRegion[] = [
  {
    name: "gear",

    // Deslocado para a direita.
    // Objetivo: capturar o número
    // inteiro, sem cortar sua borda.

    x: 0.862,
    y: 0.805,
    width: 0.070,
    height: 0.145,
  },

  {
    name: "speed",

    // Mantido para preservar as
    // leituras de velocidade existentes.

    x: 0.885,
    y: 0.835,
    width: 0.085,
    height: 0.115,
  },

  {
    name: "dashboard",

    // Área geral do velocímetro.

    x: 0.815,
    y: 0.66,
    width: 0.18,
    height: 0.24,
  },
];

function isValidRegion(
  region: HudRegion
): boolean {
  const values = [
    region.x,
    region.y,
    region.width,
    region.height,
  ];

  return (
    values.every(Number.isFinite) &&
    region.x >= 0 &&
    region.y >= 0 &&
    region.width > 0 &&
    region.height > 0 &&
    region.x + region.width <= 1 &&
    region.y + region.height <= 1
  );
}

export function getHudRegionPixels(
  region: HudRegion,
  imageWidth: number,
  imageHeight: number
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!isValidRegion(region)) {
    throw new Error(
      `Região inválida: ${region.name}`
    );
  }

  if (
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    throw new Error(
      "Dimensões da imagem inválidas."
    );
  }

  const x = Math.floor(
    region.x * imageWidth
  );

  const y = Math.floor(
    region.y * imageHeight
  );

  const width = Math.min(
    imageWidth - x,
    Math.max(
      1,
      Math.round(
        region.width * imageWidth
      )
    )
  );

  const height = Math.min(
    imageHeight - y,
    Math.max(
      1,
      Math.round(
        region.height * imageHeight
      )
    )
  );

  return {
    x,
    y,
    width,
    height,
  };
}

function loadImage(
  imageDataUrl: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(
        new Error(
          "O detector deve executar no navegador."
        )
      );
      return;
    }

    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(
        new Error(
          "Não foi possível carregar a imagem."
        )
      );
    };

    image.src = imageDataUrl;
  });
}

function cropImage(
  image: HTMLImageElement,
  region: HudRegion,
  scale = 4
): HudCrop {
  const pixels = getHudRegionPixels(
    region,
    image.naturalWidth,
    image.naturalHeight
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = Math.max(
    1,
    pixels.width * scale
  );

  canvas.height = Math.max(
    1,
    pixels.height * scale
  );

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Não foi possível criar o canvas."
    );
  }

  context.imageSmoothingEnabled = false;

  context.drawImage(
    image,
    pixels.x,
    pixels.y,
    pixels.width,
    pixels.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageDataUrl =
    canvas.toDataURL("image/png");

  const result: HudCrop = {
    name: region.name,
    imageDataUrl,
    width: canvas.width,
    height: canvas.height,
  };

  canvas.width = 0;
  canvas.height = 0;

  return result;
}

export async function detectAccHud(
  frame: ExtractedFrame
): Promise<HudDetectionResult> {
  if (
    !frame.imageDataUrl ||
    !Number.isFinite(frame.timeSeconds)
  ) {
    throw new Error(
      "O quadro fornecido é inválido."
    );
  }

  const image = await loadImage(
    frame.imageDataUrl
  );

  const crops = ACC_HUD_REGIONS.map(
    (region) => cropImage(image, region)
  );

  return {
    timeSeconds: frame.timeSeconds,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    crops,
  };
}

export async function detectAccHudBatch(
  frames: ExtractedFrame[]
): Promise<HudDetectionResult[]> {
  const results: HudDetectionResult[] = [];

  for (const frame of frames) {
    const result = await detectAccHud(
      frame
    );

    results.push(result);
  }

  return results;
}
