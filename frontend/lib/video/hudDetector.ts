
/**
 * APEX AI VISION
 * HUD Detector - Assetto Corsa Competizione
 *
 * Responsabilidades:
 * - Recortar velocidade, marcha e painel
 * - Recortar a area experimental dos pedais
 * - Gerar uma visao ampliada para diagnostico
 *
 * Este modulo nao calcula porcentagens
 * de freio ou acelerador.
 *
 * Os recortes originais do OCR sao preservados.
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

export type PedalRegionName = "pedals";

export type PedalRegion = {
  name: PedalRegionName;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PedalCrop = {
  name: PedalRegionName;
  imageDataUrl: string;
  width: number;
  height: number;
};

export type PedalContextCrop = {
  name: "pedal-context";
  imageDataUrl: string;
  width: number;
  height: number;
};

export type PedalDetectionResult = {
  timeSeconds: number;
  originalWidth: number;
  originalHeight: number;
  crop: PedalCrop;
  contextCrop: PedalContextCrop;
};

/**
 * Coordenadas normalizadas entre 0 e 1.
 *
 * Estas regioes ja sao utilizadas
 * pelo reconhecimento de velocidade
 * e marcha.
 *
 * Nao alterar sem validar o OCR.
 */

export const ACC_HUD_REGIONS: HudRegion[] = [
  {
    name: "gear",
    x: 0.862,
    y: 0.805,
    width: 0.070,
    height: 0.145,
  },
  {
    name: "speed",
    x: 0.885,
    y: 0.835,
    width: 0.085,
    height: 0.115,
  },
  {
    name: "dashboard",
    x: 0.815,
    y: 0.66,
    width: 0.18,
    height: 0.24,
  },
];

/**
 * Recorte experimental original.
 *
 * Esta regiao apresenta configuracoes
 * como TC e ABS no video de teste.
 *
 * Nao devemos interpretar suas cores
 * como porcentagens dos pedais.
 */

export const ACC_PEDAL_REGION: PedalRegion = {
  name: "pedals",
  x: 0.845,
  y: 0.895,
  width: 0.150,
  height: 0.085,
};

/**
 * Novo recorte contextual.
 *
 * Inclui uma area maior do painel
 * inferior direito.
 *
 * Objetivo: localizar visualmente
 * os verdadeiros indicadores de
 * entrada do acelerador e freio.
 *
 * As coordenadas ainda sao
 * experimentais.
 */

export const ACC_PEDAL_CONTEXT_REGION = {
  name: "pedal-context" as const,
  x: 0.66,
  y: 0.69,
  width: 0.33,
  height: 0.29,
};

type NormalizedRegion = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PixelRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageCrop = {
  imageDataUrl: string;
  width: number;
  height: number;
};

function isValidRegion(
  region: NormalizedRegion
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

function calculateRegionPixels(
  region: NormalizedRegion,
  imageWidth: number,
  imageHeight: number
): PixelRegion {
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

/**
 * API publica utilizada pelos
 * modulos existentes.
 */

export function getHudRegionPixels(
  region: HudRegion,
  imageWidth: number,
  imageHeight: number
): PixelRegion {
  return calculateRegionPixels(
    region,
    imageWidth,
    imageHeight
  );
}

function validateFrame(
  frame: ExtractedFrame
): void {
  if (
    !frame.imageDataUrl ||
    !Number.isFinite(frame.timeSeconds)
  ) {
    throw new Error(
      "O quadro fornecido é inválido."
    );
  }
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

    image.onload = () => {
      resolve(image);
    };

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

function cropNormalizedRegion(
  image: HTMLImageElement,
  region: NormalizedRegion,
  scale = 4
): ImageCrop {
  const pixels = calculateRegionPixels(
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

  const result: ImageCrop = {
    imageDataUrl:
      canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };

  canvas.width = 0;
  canvas.height = 0;

  return result;
}

function cropHudImage(
  image: HTMLImageElement,
  region: HudRegion
): HudCrop {
  return {
    name: region.name,
    ...cropNormalizedRegion(
      image,
      region
    ),
  };
}

function cropPedalImage(
  image: HTMLImageElement
): PedalCrop {
  return {
    name: "pedals",
    ...cropNormalizedRegion(
      image,
      ACC_PEDAL_REGION
    ),
  };
}

function cropPedalContext(
  image: HTMLImageElement
): PedalContextCrop {
  return {
    name: "pedal-context",
    ...cropNormalizedRegion(
      image,
      ACC_PEDAL_CONTEXT_REGION,
      3
    ),
  };
}

/**
 * Detector original do HUD.
 *
 * Retorna as tres regioes existentes:
 * marcha, velocidade e painel.
 */

export async function detectAccHud(
  frame: ExtractedFrame
): Promise<HudDetectionResult> {
  validateFrame(frame);

  const image = await loadImage(
    frame.imageDataUrl
  );

  const crops = ACC_HUD_REGIONS.map(
    (region) =>
      cropHudImage(image, region)
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
    results.push(
      await detectAccHud(frame)
    );
  }

  return results;
}

/**
 * Detector experimental de pedais.
 *
 * Retorna:
 * - crop: recorte pequeno original
 * - contextCrop: nova visao ampliada
 *
 * Nenhum valor de pedal e estimado.
 */

export async function detectAccPedals(
  frame: ExtractedFrame
): Promise<PedalDetectionResult> {
  validateFrame(frame);

  const image = await loadImage(
    frame.imageDataUrl
  );

  const crop = cropPedalImage(image);

  const contextCrop =
    cropPedalContext(image);

  return {
    timeSeconds: frame.timeSeconds,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    crop,
    contextCrop,
  };
}

export async function detectAccPedalsBatch(
  frames: ExtractedFrame[]
): Promise<PedalDetectionResult[]> {
  const results: PedalDetectionResult[] = [];

  for (const frame of frames) {
    results.push(
      await detectAccPedals(frame)
    );
  }

  return results;
}
