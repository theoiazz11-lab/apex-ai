
/**
 * APEX AI VISION
 * HUD Reader - Assetto Corsa Competizione
 *
 * Reconhecimento experimental de:
 * - Velocidade em km/h
 * - Marcha
 *
 * Melhorias:
 * - Diferentes tratamentos da imagem.
 * - Reconhecimento especifico para marcha.
 * - Comparacao de candidatos do OCR.
 * - Validacao dos valores.
 * - Reutilizacao do worker Tesseract.
 *
 * IMPORTANTE:
 * Confianca do OCR nao garante precisao.
 * Valores nao confiaveis retornam null.
 */

import {
  createWorker,
  PSM,
} from "tesseract.js";

import type {
  HudCrop,
  HudDetectionResult,
} from "./hudDetector";

// ========================================
// TIPOS
// ========================================

export type HudOcrValue = {
  value: number | null;
  confidence: number;
  rawText: string;
};

export type HudReadingResult = {
  timeSeconds: number;
  speed: HudOcrValue;
  gear: HudOcrValue;
};

export type HudReaderOptions = {
  minimumConfidence?: number;
};

type HudValueType = "speed" | "gear";

type ImageRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImagePreparation = {
  region: ImageRegion;
  threshold: number;
  scale: number;
};

type OcrCandidate = HudOcrValue;

// ========================================
// CONFIGURACAO
// ========================================

const DEFAULT_MINIMUM_CONFIDENCE = 50;

const MAX_SPEED_KMH = 400;

const MIN_GEAR = 0;
const MAX_GEAR = 8;

/**
 * Mantemos o tratamento que ja
 * conseguiu reconhecer 204 km/h.
 *
 * Testamos tambem uma segunda
 * versao mais ampla do recorte.
 */
const SPEED_PREPARATIONS: ImagePreparation[] = [
  {
    region: {
      x: 0.38,
      y: 0.24,
      width: 0.62,
      height: 0.59,
    },
    threshold: 135,
    scale: 3,
  },
  {
    region: {
      x: 0.05,
      y: 0.10,
      width: 0.90,
      height: 0.80,
    },
    threshold: 170,
    scale: 3,
  },
];

/**
 * A marcha ocupa apenas um numero.
 *
 * Primeiro tentamos a area inteira
 * do recorte e depois uma area
 * central com mais contraste.
 */
const GEAR_PREPARATIONS: ImagePreparation[] = [
  {
    region: {
      x: 0.05,
      y: 0.05,
      width: 0.90,
      height: 0.90,
    },
    threshold: 155,
    scale: 4,
  },
  {
    region: {
      x: 0.15,
      y: 0.12,
      width: 0.70,
      height: 0.76,
    },
    threshold: 190,
    scale: 4,
  },
];

// ========================================
// LOCALIZAR RECORTES
// ========================================

function findCrop(
  result: HudDetectionResult,
  name: HudValueType
): HudCrop {
  const crop = result.crops.find(
    (item) => item.name === name
  );

  if (!crop) {
    throw new Error(
      `Recorte do HUD nao encontrado: ${name}`
    );
  }

  return crop;
}

// ========================================
// CARREGAR IMAGEM
// ========================================

function loadImage(
  source: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(
        new Error(
          "O OCR precisa ser executado no navegador."
        )
      );
      return;
    }

    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(
        new Error(
          "Nao foi possivel carregar a imagem do HUD."
        )
      );
    };

    image.src = source;
  });
}

// ========================================
// PREPARAR IMAGEM
// ========================================

/**
 * Prepara uma versao do recorte:
 *
 * 1. Seleciona a area desejada.
 * 2. Amplia os pixels.
 * 3. Converte para preto e branco.
 * 4. Ajusta o contraste.
 *
 * Isso permite testar diferentes
 * configuracoes para o mesmo numero.
 */
async function prepareImage(
  crop: HudCrop,
  preparation: ImagePreparation
): Promise<string> {
  const image = await loadImage(
    crop.imageDataUrl
  );

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  const { region, threshold, scale } =
    preparation;

  const sx = Math.floor(
    sourceWidth * region.x
  );

  const sy = Math.floor(
    sourceHeight * region.y
  );

  const sw = Math.min(
    sourceWidth - sx,
    Math.max(
      1,
      Math.floor(
        sourceWidth * region.width
      )
    )
  );

  const sh = Math.min(
    sourceHeight - sy,
    Math.max(
      1,
      Math.floor(
        sourceHeight * region.height
      )
    )
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = sw * scale;
  canvas.height = sh * scale;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Nao foi possivel criar o canvas do OCR."
    );
  }

  context.imageSmoothingEnabled = true;

  context.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const pixels = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  for (
    let index = 0;
    index < pixels.data.length;
    index += 4
  ) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];

    const brightness =
      0.299 * red +
      0.587 * green +
      0.114 * blue;

    const value =
      brightness > threshold
        ? 0
        : 255;

    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
    pixels.data[index + 3] = 255;
  }

  context.putImageData(
    pixels,
    0,
    0
  );

  const result =
    canvas.toDataURL("image/png");

  canvas.width = 0;
  canvas.height = 0;

  return result;
}

// ========================================
// VALIDAR RESULTADO
// ========================================

/**
 * Aceitamos somente textos
 * que contenham um numero inteiro.
 *
 * Marcha:
 * Um unico digito de 0 a 8.
 *
 * Velocidade:
 * Numero de 0 a 400 km/h.
 *
 * Nao transformamos textos com
 * caracteres adicionais em valores
 * aparentemente validos.
 */
function parseOcrValue(
  rawText: string,
  confidence: number,
  type: HudValueType,
  minimumConfidence: number
): HudOcrValue {
  const cleaned = rawText.trim();

  const validFormat =
    type === "gear"
      ? /^[0-8]$/.test(cleaned)
      : /^\d{1,3}$/.test(cleaned);

  const numericValue = validFormat
    ? Number(cleaned)
    : NaN;

  const validRange =
    type === "gear"
      ? numericValue >= MIN_GEAR &&
        numericValue <= MAX_GEAR
      : numericValue >= 0 &&
        numericValue <= MAX_SPEED_KMH;

  const safeConfidence =
    Number.isFinite(confidence)
      ? confidence
      : 0;

  const valid =
    Number.isInteger(numericValue) &&
    validRange &&
    safeConfidence >= minimumConfidence;

  return {
    value: valid ? numericValue : null,
    confidence: safeConfidence,
    rawText,
  };
}

// ========================================
// ESCOLHER MELHOR CANDIDATO
// ========================================

/**
 * Da prioridade a leituras que
 * passaram pela validacao.
 *
 * Entre leituras validas, escolhe
 * a que apresenta maior confianca.
 *
 * Se todas falharem, retorna null,
 * preservando o texto original
 * da tentativa mais confiante.
 */
function chooseBestCandidate(
  candidates: OcrCandidate[]
): HudOcrValue {
  if (candidates.length === 0) {
    return {
      value: null,
      confidence: 0,
      rawText: "",
    };
  }

  const validCandidates =
    candidates.filter(
      (candidate) =>
        candidate.value !== null
    );

  const pool =
    validCandidates.length > 0
      ? validCandidates
      : candidates;

  const sorted = [...pool].sort(
    (a, b) =>
      b.confidence - a.confidence
  );

  return sorted[0];
}

// ========================================
// RECONHECER UM TIPO DE VALOR
// ========================================

/**
 * Executa varias tentativas de OCR
 * com tratamentos diferentes.
 *
 * Marcha usa PSM.SINGLE_CHAR,
 * adequado para um unico caractere.
 *
 * Velocidade usa PSM.SINGLE_LINE.
 */
async function recognizeValue(
  worker: Awaited<
    ReturnType<typeof createWorker>
  >,
  crop: HudCrop,
  type: HudValueType,
  minimumConfidence: number
): Promise<HudOcrValue> {
  const preparations =
    type === "gear"
      ? GEAR_PREPARATIONS
      : SPEED_PREPARATIONS;

  await worker.setParameters({
    tessedit_char_whitelist:
      type === "gear"
        ? "012345678"
        : "0123456789",

    tessedit_pageseg_mode:
      type === "gear"
        ? PSM.SINGLE_CHAR
        : PSM.SINGLE_LINE,
  });

  const candidates: OcrCandidate[] = [];

  for (const preparation of preparations) {
    const imageDataUrl =
      await prepareImage(
        crop,
        preparation
      );

    const recognition =
      await worker.recognize(imageDataUrl);

    const candidate = parseOcrValue(
      recognition.data.text,
      recognition.data.confidence,
      type,
      minimumConfidence
    );

    candidates.push(candidate);
  }

  return chooseBestCandidate(
    candidates
  );
}

// ========================================
// LER UM QUADRO
// ========================================

export async function readAccHud(
  detection: HudDetectionResult,
  options: HudReaderOptions = {}
): Promise<HudReadingResult> {
  const results = await readAccHudBatch(
    [detection],
    options
  );

  return results[0];
}

// ========================================
// LER VARIOS QUADROS
// ========================================

/**
 * Usa apenas um worker Tesseract
 * para processar todos os quadros.
 *
 * O worker e encerrado mesmo
 * quando ocorre um erro.
 */
export async function readAccHudBatch(
  detections: HudDetectionResult[],
  options: HudReaderOptions = {}
): Promise<HudReadingResult[]> {
  if (detections.length === 0) {
    return [];
  }

  const minimumConfidence =
    options.minimumConfidence ??
    DEFAULT_MINIMUM_CONFIDENCE;

  if (
    !Number.isFinite(minimumConfidence) ||
    minimumConfidence < 0 ||
    minimumConfidence > 100
  ) {
    throw new Error(
      "A confianca minima deve estar entre 0 e 100."
    );
  }

  if (typeof document === "undefined") {
    throw new Error(
      "O reconhecimento deve ocorrer no navegador."
    );
  }

  const worker =
    await createWorker("eng");

  try {
    const readings: HudReadingResult[] = [];

    for (const detection of detections) {
      const speedCrop = findCrop(
        detection,
        "speed"
      );

      const gearCrop = findCrop(
        detection,
        "gear"
      );

      const speed = await recognizeValue(
        worker,
        speedCrop,
        "speed",
        minimumConfidence
      );

      const gear = await recognizeValue(
        worker,
        gearCrop,
        "gear",
        minimumConfidence
      );

      readings.push({
        timeSeconds: detection.timeSeconds,
        speed,
        gear,
      });
    }

    return readings;
  } finally {
    await worker.terminate();
  }
}
