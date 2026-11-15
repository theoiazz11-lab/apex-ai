
/**
 * APEX AI VISION
 * HUD Detector - Assetto Corsa Competizione
 *
 * Recortes atuais:
 * - Marcha
 * - Velocidade
 * - Painel completo
 *
 * Novo recurso experimental:
 * - Regiao dos indicadores de pedal
 *
 * O recorte experimental dos pedais
 * e separado dos recortes existentes
 * para manter a compatibilidade com
 * hudReader.ts e frames/page.tsx.
 *
 * Este modulo extrai imagens.
 * Nao interpreta porcentagens de pedal.
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
 * Regiao experimental dos pedais.
 *
 * Ainda nao separamos acelerador
 * e freio porque precisamos conferir
 * o recorte em diferentes instantes.
 */
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

export type PedalDetectionResult = {
  timeSeconds: number;
  originalWidth: number;
  originalHeight: number;
  crop: PedalCrop;
};

/**
 * Coordenadas normalizadas:
 *
 * x e y: posicao inicial
 * width e height: dimensoes
 *
 * Todos os valores ficam entre 0 e 1.
 *
 * Regioes baseadas no HUD utilizado
 * nos videos de teste do ACC.
 *
 * IMPORTANTE:
 * As tres regioes abaixo permanecem
 * exatamente iguais as anteriores.
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
 * Novo recorte experimental.
 *
 * Abrange a parte inferior direita
 * do HUD, incluindo a area abaixo
 * do velocimetro.
 *
 * Os valores sao uma estimativa inicial.
 * Precisamos confirmar visualmente
 * se as duas barras aparecem completas.
 *
 * Nao modifica ACC_HUD_REGIONS.
 */
export const ACC_PEDAL_REGION: PedalRegion = {
  name: "pedals",
  x: 0.845,
  y: 0.895,
  width: 0.150,
  height: 0.085,
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

function cropNormalizedRegion(
  image: HTMLImageElement,
  region: NormalizedRegion,
  scale = 4
): {
  imageDataUrl: string;
  width: number;
  height: number;
} {
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

  const imageDataUrl =
    canvas.toDataURL("image/png");

  const result = {
    imageDataUrl,
    width: canvas.width,
    height: canvas.height,
  };

  canvas.width = 0;
  canvas.height = 0;

  return result;
}

function cropImage(
  image: HTMLImageElement,
  region: HudRegion,
  scale = 4
): HudCrop {
  return {
    name: region.name,
    ...cropNormalizedRegion(
      image,
      region,
      scale
    ),
  };
}

function cropPedalImage(
  image: HTMLImageElement,
  region: PedalRegion,
  scale = 4
): PedalCrop {
  return {
    name: region.name,
    ...cropNormalizedRegion(
      image,
      region,
      scale
    ),
  };
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

/**
 * API existente.
 *
 * Preserva exatamente os tres
 * recortes utilizados pelo OCR.
 */
export async function detectAccHud(
  frame: ExtractedFrame
): Promise<HudDetectionResult> {
  validateFrame(frame);

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

/**
 * API existente em lote.
 */
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

/**
 * NOVA API EXPERIMENTAL.
 *
 * Recorta a area inferior do HUD,
 * onde esperamos encontrar os
 * indicadores relacionados aos pedais.
 *
 * Nenhuma porcentagem e calculada.
 */
export async function detectAccPedals(
  frame: ExtractedFrame
): Promise<PedalDetectionResult> {
  validateFrame(frame);

  const image = await loadImage(
    frame.imageDataUrl
  );

  const crop = cropPedalImage(
    image,
    ACC_PEDAL_REGION
  );

  return {
    timeSeconds: frame.timeSeconds,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    crop,
  };
}

/**
 * Nova API experimental em lote.
 *
 * Pode ser chamada futuramente
 * pela pagina de analise de video.
 */
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
