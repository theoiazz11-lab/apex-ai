
/**
 * APEX AI VISION
 * HUD Reader - Assetto Corsa Competizione
 *
 * Reconhecimento experimental de
 * velocidade e marcha por OCR.
 *
 * Atualizacao:
 * - Identifica possiveis digitos perdidos.
 * - Compara leituras completas e parciais.
 * - Evita rejeitar uma maioria consistente
 *   apenas por uma leitura concorrente.
 * - Preserva a logica de marcha.
 * - Mantem diagnosticos no Console.
 *
 * Nenhuma velocidade e fixada no codigo.
 */

import { createWorker, PSM } from "tesseract.js";

import type {
  HudCrop,
  HudDetectionResult,
} from "./hudDetector";

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

export type HudOcrAttempt = {
  attempt: number;
  mode: string;
  pageMode: string;
  region: string;
  rawText: string;
  confidence: number;
  parsedNumber: number | null;
  acceptedByBasicValidation: boolean;
};

type ValueType = "speed" | "gear";

type ImageMode =
  | "legacy"
  | "grayscale"
  | "inverted"
  | "binary"
  | "binary-inverted";

type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Preparation = {
  region: Region;
  mode: ImageMode;
  scale: number;
  threshold?: number;
  pageMode?: PSM;
};

type Worker = Awaited<
  ReturnType<typeof createWorker>
>;

type OcrCandidate = HudOcrValue & {
  preparationIndex: number;
  family: string;
};

type Selection = {
  result: HudOcrValue;
  decision: string;
};

type RecognitionDetails = Selection & {
  attempts: HudOcrAttempt[];
};

type SpeedGroup = {
  value: number;
  items: OcrCandidate[];
  best: OcrCandidate;
  count: number;
  families: number;
  averageConfidence: number;
};

const DEFAULT_MINIMUM_CONFIDENCE = 50;
const MAX_SPEED = 400;
const DEBUG_OCR = true;

const SPEED_PREPARATIONS: Preparation[] = [
  {
    region: {
      x: 0.38,
      y: 0.24,
      width: 0.62,
      height: 0.59,
    },
    mode: "legacy",
    threshold: 135,
    scale: 3,
    pageMode: PSM.SINGLE_LINE,
  },
  {
    region: {
      x: 0.36,
      y: 0.31,
      width: 0.57,
      height: 0.40,
    },
    mode: "grayscale",
    scale: 4,
    pageMode: PSM.SINGLE_WORD,
  },
  {
    region: {
      x: 0.36,
      y: 0.31,
      width: 0.57,
      height: 0.40,
    },
    mode: "inverted",
    scale: 4,
    pageMode: PSM.SINGLE_WORD,
  },
  {
    region: {
      x: 0.36,
      y: 0.31,
      width: 0.57,
      height: 0.40,
    },
    mode: "binary-inverted",
    threshold: 145,
    scale: 4,
    pageMode: PSM.SINGLE_WORD,
  },
  {
    region: {
      x: 0.36,
      y: 0.31,
      width: 0.57,
      height: 0.40,
    },
    mode: "binary-inverted",
    threshold: 185,
    scale: 4,
    pageMode: PSM.SINGLE_LINE,
  },
  {
    region: {
      x: 0.30,
      y: 0.26,
      width: 0.66,
      height: 0.48,
    },
    mode: "grayscale",
    scale: 4,
    pageMode: PSM.SINGLE_WORD,
  },
  {
    region: {
      x: 0.30,
      y: 0.26,
      width: 0.66,
      height: 0.48,
    },
    mode: "inverted",
    scale: 4,
    pageMode: PSM.SINGLE_LINE,
  },
  {
    region: {
      x: 0.36,
      y: 0.31,
      width: 0.57,
      height: 0.40,
    },
    mode: "binary",
    threshold: 155,
    scale: 4,
    pageMode: PSM.SINGLE_WORD,
  },
  {
    region: {
      x: 0.05,
      y: 0.10,
      width: 0.90,
      height: 0.80,
    },
    mode: "legacy",
    threshold: 170,
    scale: 3,
    pageMode: PSM.SINGLE_LINE,
  },
];

/**
 * Tratamentos de marcha preservados.
 */
const GEAR_PREPARATIONS: Preparation[] = [
  {
    region: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
    mode: "inverted",
    scale: 2,
    pageMode: PSM.SINGLE_CHAR,
  },
  {
    region: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    },
    mode: "grayscale",
    scale: 2,
    pageMode: PSM.SINGLE_CHAR,
  },
  {
    region: {
      x: 0.05,
      y: 0.05,
      width: 0.90,
      height: 0.90,
    },
    mode: "binary-inverted",
    threshold: 150,
    scale: 2,
    pageMode: PSM.SINGLE_CHAR,
  },
  {
    region: {
      x: 0.05,
      y: 0.05,
      width: 0.90,
      height: 0.90,
    },
    mode: "binary",
    threshold: 170,
    scale: 2,
    pageMode: PSM.SINGLE_CHAR,
  },
];

function findCrop(
  detection: HudDetectionResult,
  name: ValueType
): HudCrop {
  const crop = detection.crops.find(
    (item) => item.name === name
  );

  if (!crop) {
    throw new Error(
      `Recorte nao encontrado: ${name}`
    );
  }

  return crop;
}

function loadImage(
  source: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(
        new Error(
          "O OCR precisa executar no navegador."
        )
      );
      return;
    }

    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () =>
      reject(
        new Error(
          "Nao foi possivel carregar a imagem."
        )
      );

    image.src = source;
  });
}

async function prepareImage(
  crop: HudCrop,
  preparation: Preparation
): Promise<string> {
  const image = await loadImage(
    crop.imageDataUrl
  );

  const { region, mode, scale } =
    preparation;

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  const sx = Math.floor(
    width * region.x
  );

  const sy = Math.floor(
    height * region.y
  );

  const sw = Math.max(
    1,
    Math.min(
      width - sx,
      Math.floor(width * region.width)
    )
  );

  const sh = Math.max(
    1,
    Math.min(
      height - sy,
      Math.floor(height * region.height)
    )
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = sw * scale;
  canvas.height = sh * scale;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Falha ao preparar imagem."
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
    let i = 0;
    i < pixels.data.length;
    i += 4
  ) {
    const r = pixels.data[i];
    const g = pixels.data[i + 1];
    const b = pixels.data[i + 2];

    const brightness =
      0.299 * r +
      0.587 * g +
      0.114 * b;

    let value = brightness;

    if (mode === "legacy") {
      value =
        brightness >
        (preparation.threshold ?? 135)
          ? 0
          : 255;
    }

    if (mode === "inverted") {
      value = 255 - brightness;
    }

    if (mode === "binary") {
      value =
        brightness >
        (preparation.threshold ?? 150)
          ? 255
          : 0;
    }

    if (mode === "binary-inverted") {
      value =
        brightness >
        (preparation.threshold ?? 150)
          ? 0
          : 255;
    }

    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }

  context.putImageData(pixels, 0, 0);

  if (mode === "legacy") {
    const output =
      canvas.toDataURL("image/png");

    canvas.width = 0;
    canvas.height = 0;

    return output;
  }

  const margin = 32;

  const padded =
    document.createElement("canvas");

  padded.width =
    canvas.width + margin * 2;

  padded.height =
    canvas.height + margin * 2;

  const paddedContext =
    padded.getContext("2d");

  if (!paddedContext) {
    throw new Error(
      "Falha ao adicionar margem."
    );
  }

  paddedContext.fillStyle =
    mode === "inverted" ||
    mode === "binary-inverted"
      ? "#ffffff"
      : "#000000";

  paddedContext.fillRect(
    0,
    0,
    padded.width,
    padded.height
  );

  paddedContext.drawImage(
    canvas,
    margin,
    margin
  );

  const output =
    padded.toDataURL("image/png");

  canvas.width = 0;
  canvas.height = 0;

  padded.width = 0;
  padded.height = 0;

  return output;
}

function parseOcrValue(
  rawText: string,
  confidence: number,
  type: ValueType,
  minimumConfidence: number
): HudOcrValue {
  const cleaned = rawText.trim();

  const validFormat =
    type === "gear"
      ? /^[0-8]$/.test(cleaned)
      : /^\d{1,3}$/.test(cleaned);

  const number = validFormat
    ? Number(cleaned)
    : NaN;

  const validRange =
    type === "gear"
      ? number >= 0 && number <= 8
      : number >= 0 &&
        number <= MAX_SPEED;

  const safeConfidence =
    Number.isFinite(confidence)
      ? Math.max(
          0,
          Math.min(100, confidence)
        )
      : 0;

  const confidenceAccepted =
    type === "speed" ||
    safeConfidence >= minimumConfidence;

  return {
    value:
      Number.isInteger(number) &&
      validRange &&
      confidenceAccepted
        ? number
        : null,
    confidence: safeConfidence,
    rawText,
  };
}

function emptyResult(): HudOcrValue {
  return {
    value: null,
    confidence: 0,
    rawText: "",
  };
}

function reject(
  candidate: HudOcrValue
): HudOcrValue {
  return {
    value: null,
    confidence: candidate.confidence,
    rawText: candidate.rawText,
  };
}

/**
 * Marchas: maior grupo de concordancia,
 * desempate por confianca.
 */
function chooseGear(
  candidates: OcrCandidate[]
): Selection {
  const valid = candidates.filter(
    (item) => item.value !== null
  );

  if (valid.length === 0) {
    const best = [...candidates].sort(
      (a, b) =>
        b.confidence - a.confidence
    )[0];

    return {
      result: best
        ? reject(best)
        : emptyResult(),
      decision:
        "Nenhuma marcha passou pela validacao.",
    };
  }

  const groups = new Map<
    number,
    OcrCandidate[]
  >();

  for (const item of valid) {
    if (item.value === null) continue;

    const group =
      groups.get(item.value) ?? [];

    group.push(item);
    groups.set(item.value, group);
  }

  const ranked = [...groups.entries()].sort(
    (a, b) => {
      if (b[1].length !== a[1].length) {
        return b[1].length - a[1].length;
      }

      return (
        Math.max(
          ...b[1].map(
            (item) => item.confidence
          )
        ) -
        Math.max(
          ...a[1].map(
            (item) => item.confidence
          )
        )
      );
    }
  );

  const winningGroup = ranked[0][1];

  const winner = [...winningGroup].sort(
    (a, b) =>
      b.confidence - a.confidence
  )[0];

  return {
    result: {
      value: winner.value,
      confidence: winner.confidence,
      rawText: winner.rawText,
    },
    decision:
      `Marcha escolhida por ` +
      `${winningGroup.length} tentativa(s).`,
  };
}

/**
 * Agrupa as velocidades por numero.
 */
function groupSpeeds(
  candidates: OcrCandidate[]
): SpeedGroup[] {
  const groups = new Map<
    number,
    OcrCandidate[]
  >();

  for (const item of candidates) {
    if (item.value === null) continue;

    const current =
      groups.get(item.value) ?? [];

    current.push(item);
    groups.set(item.value, current);
  }

  return [...groups.entries()].map(
    ([value, items]) => {
      const best = [...items].sort(
        (a, b) =>
          b.confidence - a.confidence
      )[0];

      const families = new Set(
        items.map((item) => item.family)
      );

      return {
        value,
        items,
        best,
        count: items.length,
        families: families.size,
        averageConfidence:
          items.reduce(
            (sum, item) =>
              sum + item.confidence,
            0
          ) / items.length,
      };
    }
  );
}

/**
 * Um resultado pode ser apenas o final
 * de outro numero.
 *
 * Exemplo generico:
 *
 * "0" e "70"
 * "17" e "217"
 *
 * Isso NAO prova que o numero mais longo
 * seja correto. Exigimos varias leituras
 * completas em tratamentos diferentes.
 */
function isPossibleTruncation(
  shorter: number,
  longer: number
): boolean {
  const shortText = String(shorter);
  const longText = String(longer);

  return (
    longText.length > shortText.length &&
    longText.endsWith(shortText)
  );
}

/**
 * Seleciona uma velocidade sem depender
 * apenas da confianca do Tesseract.
 *
 * As regras continuam experimentais.
 */
function chooseSpeed(
  candidates: OcrCandidate[],
  minimumConfidence: number
): Selection {
  if (candidates.length === 0) {
    return {
      result: emptyResult(),
      decision:
        "Nenhuma tentativa de OCR.",
    };
  }

  const strongestRaw = [...candidates].sort(
    (a, b) =>
      b.confidence - a.confidence
  )[0];

  const groups = groupSpeeds(candidates);

  if (groups.length === 0) {
    return {
      result: reject(strongestRaw),
      decision:
        "Nenhum numero plausivel encontrado.",
    };
  }

  /**
   * Primeiro ordenamos pela quantidade
   * de leituras concordantes.
   */
  groups.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    if (b.families !== a.families) {
      return b.families - a.families;
    }

    return (
      b.averageConfidence -
      a.averageConfidence
    );
  });

  let winner = groups[0];
  let truncationDetected = false;

  /**
   * Detectamos quando a leitura principal
   * pode ter perdido os primeiros digitos.
   *
   * O numero completo precisa aparecer
   * pelo menos 3 vezes, em pelo menos
   * 2 tratamentos, com alguma confianca.
   *
   * A quantidade de votos nao pode ser
   * muito inferior a da leitura parcial.
   */
  for (const alternative of groups.slice(1)) {
    const likelyTruncation =
      isPossibleTruncation(
        winner.value,
        alternative.value
      );

    const supported =
      alternative.count >= 3 &&
      alternative.families >= 2 &&
      alternative.best.confidence >= 30 &&
      alternative.count >=
        winner.count - 1;

    if (likelyTruncation && supported) {
      winner = alternative;
      truncationDetected = true;
      break;
    }
  }

  const competitors = groups
    .filter(
      (group) =>
        group.value !== winner.value
    )
    .sort((a, b) => b.count - a.count);

  const competitor = competitors[0];

  /**
   * Rejeitamos empates significativos
   * entre numeros diferentes.
   *
   * Se o concorrente for apenas um
   * possivel recorte incompleto da
   * leitura selecionada, nao tratamos
   * essa coincidencia como empate real.
   */
  if (competitor) {
    const partialCompetitor =
      truncationDetected &&
      isPossibleTruncation(
        competitor.value,
        winner.value
      );

    const significantConflict =
      !partialCompetitor &&
      competitor.count >= winner.count &&
      competitor.families >= 2 &&
      competitor.best.confidence >=
        winner.best.confidence - 10;

    if (significantConflict) {
      return {
        result: reject(winner.best),
        decision:
          `Conflito entre ` +
          `${winner.value} e ` +
          `${competitor.value}. ` +
          `Evidencia insuficiente para ` +
          `escolher com seguranca.`,
      };
    }
  }

  const strongConsensus =
    winner.count >= 3 &&
    winner.families >= 2 &&
    winner.best.confidence >= 30;

  const moderateConsensus =
    winner.count >= 2 &&
    winner.families >= 2 &&
    winner.best.confidence >=
      Math.max(85, minimumConfidence) &&
    (
      !competitor ||
      competitor.count === 1
    );

  const isolatedHighConfidence =
    winner.count === 1 &&
    winner.best.confidence >= 90 &&
    (
      !competitor ||
      competitor.count === 1
    );

  if (
    !strongConsensus &&
    !moderateConsensus &&
    !isolatedHighConfidence
  ) {
    return {
      result: reject(winner.best),
      decision:
        `Candidato ${winner.value} ` +
        `rejeitado: ${winner.count} ` +
        `tentativa(s), ` +
        `${winner.families} tratamento(s), ` +
        `confianca maxima ` +
        `${winner.best.confidence.toFixed(1)}%.`,
    };
  }

  const method = truncationDetected
    ? "possivel leitura parcial corrigida por consenso"
    : "concordancia entre tratamentos";

  return {
    result: {
      value: winner.value,
      confidence: winner.best.confidence,
      rawText: winner.best.rawText,
    },
    decision:
      `Velocidade ${winner.value} aceita: ` +
      `${method}. ` +
      `${winner.count} tentativa(s), ` +
      `${winner.families} tratamento(s), ` +
      `confianca maxima ` +
      `${winner.best.confidence.toFixed(1)}%. ` +
      `Resultado experimental.`,
  };
}

function logOcrDiagnostic(
  timeSeconds: number,
  type: ValueType,
  details: RecognitionDetails
): void {
  if (!DEBUG_OCR) return;

  const label =
    type === "speed"
      ? "VELOCIDADE"
      : "MARCHA";

  console.groupCollapsed(
    `[APEX AI OCR] ${label} | ` +
    `${timeSeconds.toFixed(3)} s | ` +
    `Resultado: ${
      details.result.value === null
        ? "Nao identificado"
        : details.result.value
    }`
  );

  console.table(details.attempts);

  console.info(
    "Decisao:",
    details.decision
  );

  console.info(
    "Resultado final:",
    details.result
  );

  console.groupEnd();
}

async function recognizeValue(
  worker: Worker,
  crop: HudCrop,
  type: ValueType,
  minimumConfidence: number
): Promise<RecognitionDetails> {
  const preparations =
    type === "gear"
      ? GEAR_PREPARATIONS
      : SPEED_PREPARATIONS;

  const candidates: OcrCandidate[] = [];
  const attempts: HudOcrAttempt[] = [];

  for (
    let index = 0;
    index < preparations.length;
    index++
  ) {
    const preparation =
      preparations[index];

    const imageDataUrl =
      await prepareImage(
        crop,
        preparation
      );

    const pageMode =
      preparation.pageMode ??
      (
        type === "gear"
          ? PSM.SINGLE_CHAR
          : PSM.SINGLE_WORD
      );

    await worker.setParameters({
      tessedit_char_whitelist:
        type === "gear"
          ? "012345678"
          : "0123456789",
      tessedit_pageseg_mode: pageMode,
    });

    const recognition =
      await worker.recognize(
        imageDataUrl
      );

    const rawText =
      recognition.data.text;

    const confidence =
      recognition.data.confidence;

    const parsed = parseOcrValue(
      rawText,
      confidence,
      type,
      minimumConfidence
    );

    candidates.push({
      ...parsed,
      preparationIndex: index,
      family: preparation.mode,
    });

    const cleaned = rawText.trim();

    const numeric =
      /^\d{1,3}$/.test(cleaned)
        ? Number(cleaned)
        : null;

    attempts.push({
      attempt: index + 1,
      mode: preparation.mode,
      pageMode: String(pageMode),
      region:
        `x=${preparation.region.x}, ` +
        `y=${preparation.region.y}, ` +
        `w=${preparation.region.width}, ` +
        `h=${preparation.region.height}`,
      rawText: cleaned || "(vazio)",
      confidence: Number.isFinite(
        confidence
      )
        ? Number(confidence.toFixed(1))
        : 0,
      parsedNumber: numeric,
      acceptedByBasicValidation:
        parsed.value !== null,
    });
  }

  const selection =
    type === "gear"
      ? chooseGear(candidates)
      : chooseSpeed(
          candidates,
          minimumConfidence
        );

  return {
    ...selection,
    attempts,
  };
}

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
      "A confianca minima precisa estar entre 0 e 100."
    );
  }

  if (typeof document === "undefined") {
    throw new Error(
      "O OCR precisa executar no navegador."
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

      const speedDetails =
        await recognizeValue(
          worker,
          speedCrop,
          "speed",
          minimumConfidence
        );

      const gearDetails =
        await recognizeValue(
          worker,
          gearCrop,
          "gear",
          minimumConfidence
        );

      logOcrDiagnostic(
        detection.timeSeconds,
        "speed",
        speedDetails
      );

      logOcrDiagnostic(
        detection.timeSeconds,
        "gear",
        gearDetails
      );

      readings.push({
        timeSeconds:
          detection.timeSeconds,
        speed: speedDetails.result,
        gear: gearDetails.result,
      });
    }

    return readings;
  } finally {
    await worker.terminate();
  }
}
