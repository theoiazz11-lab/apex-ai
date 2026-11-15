
/**
 * APEX AI
 * Driving Analyzer - Analise inicial por video
 *
 * Agrupa variacoes consecutivas de velocidade
 * e registra mudancas observadas de marcha.
 *
 * Os resultados sao descricoes de amostras
 * do HUD, nao diagnosticos de pilotagem.
 *
 * NAO identifica:
 * - Acionamento do freio ou acelerador
 * - Ponto exato de frenagem
 * - Trajetoria do carro
 * - Erros de pilotagem
 * - Desempenho comparado a outros pilotos
 */

import type {
  HudReadingResult,
} from "./hudReader";

export type DrivingSample = {
  timeSeconds: number;
  speedKmh: number | null;
  gear: number | null;
};

export type DrivingObservation = {
  startSeconds: number;
  endSeconds: number;
  type:
    | "speed-increase"
    | "speed-decrease"
    | "gear-change";
  description: string;
  value: number;
};

export type DrivingAnalysis = {
  totalSamples: number;
  validSpeedSamples: number;
  validGearSamples: number;
  durationSeconds: number;
  minimumObservedSpeed: number | null;
  maximumObservedSpeed: number | null;
  observations: DrivingObservation[];
  warnings: string[];
  samples: DrivingSample[];
};

type SpeedTrend = "increase" | "decrease";

type ActiveSpeedEvent = {
  type: SpeedTrend;
  startSeconds: number;
  endSeconds: number;
  startSpeed: number;
  endSpeed: number;
  intervals: number;
};

function round(
  value: number,
  digits = 2
): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isValidSpeed(
  value: number | null
): value is number {
  return (
    value !== null &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 400
  );
}

function isValidGear(
  value: number | null
): value is number {
  return (
    value !== null &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 8
  );
}

function createSpeedObservation(
  event: ActiveSpeedEvent
): DrivingObservation {
  const difference = Math.abs(
    event.endSpeed - event.startSpeed
  );

  const increasing =
    event.type === "increase";

  return {
    startSeconds: event.startSeconds,
    endSeconds: event.endSeconds,
    type: increasing
      ? "speed-increase"
      : "speed-decrease",
    description: increasing
      ? `Velocidade observada aumentou de ` +
        `${event.startSpeed} para ` +
        `${event.endSpeed} km/h, uma ` +
        `diferença de ${round(difference)} km/h ` +
        `ao longo de ${event.intervals} ` +
        `intervalo(s) consecutivo(s).`
      : `Velocidade observada diminuiu de ` +
        `${event.startSpeed} para ` +
        `${event.endSpeed} km/h, uma ` +
        `diferença de ${round(difference)} km/h ` +
        `ao longo de ${event.intervals} ` +
        `intervalo(s) consecutivo(s).`,
    value: round(difference),
  };
}

/**
 * Analisa exclusivamente os dados reconhecidos
 * em cada instante do video.
 *
 * Agrupamento:
 *
 * 1. Variacoes positivas consecutivas
 *    formam um evento de aumento.
 *
 * 2. Variacoes negativas consecutivas
 *    formam um evento de reducao.
 *
 * 3. Velocidades iguais interrompem
 *    a sequencia.
 *
 * 4. Leituras ausentes interrompem
 *    a sequencia.
 *
 * 5. Mudancas observadas de marcha
 *    sao registradas separadamente.
 *
 * 6. Nao conectamos amostras separadas
 *    por um intervalo inesperadamente
 *    maior que a cadencia usual.
 */
export function analyzeDrivingFromVideo(
  readings: HudReadingResult[]
): DrivingAnalysis {
  const samples: DrivingSample[] = readings
    .filter(
      (reading) =>
        Number.isFinite(reading.timeSeconds) &&
        reading.timeSeconds >= 0
    )
    .map((reading) => ({
      timeSeconds: reading.timeSeconds,
      speedKmh: isValidSpeed(
        reading.speed.value
      )
        ? reading.speed.value
        : null,
      gear: isValidGear(
        reading.gear.value
      )
        ? reading.gear.value
        : null,
    }))
    .sort(
      (a, b) =>
        a.timeSeconds - b.timeSeconds
    );

  const validSpeeds = samples
    .map((sample) => sample.speedKmh)
    .filter(isValidSpeed);

  const validGearSamples = samples.filter(
    (sample) =>
      isValidGear(sample.gear)
  ).length;

  const observations: DrivingObservation[] = [];
  const warnings: string[] = [];

  const positiveIntervals = samples
    .slice(1)
    .map(
      (sample, index) =>
        sample.timeSeconds -
        samples[index].timeSeconds
    )
    .filter(
      (interval) =>
        Number.isFinite(interval) &&
        interval > 0
    );

  /**
   * Estimamos a cadencia usual pela mediana,
   * evitando agrupar trechos separados por
   * uma lacuna muito maior que a normal.
   */
  const orderedIntervals = [
    ...positiveIntervals,
  ].sort((a, b) => a - b);

  const middleIndex = Math.floor(
    orderedIntervals.length / 2
  );

  const typicalInterval =
    orderedIntervals.length === 0
      ? null
      : orderedIntervals.length % 2 === 1
        ? orderedIntervals[middleIndex]
        : (
            orderedIntervals[middleIndex - 1] +
            orderedIntervals[middleIndex]
          ) / 2;

  let activeEvent: ActiveSpeedEvent | null = null;

  function finishActiveEvent() {
    if (!activeEvent) {
      return;
    }

    observations.push(
      createSpeedObservation(activeEvent)
    );

    activeEvent = null;
  }

  for (
    let index = 1;
    index < samples.length;
    index++
  ) {
    const previous = samples[index - 1];
    const current = samples[index];

    const elapsed =
      current.timeSeconds -
      previous.timeSeconds;

    if (
      !Number.isFinite(elapsed) ||
      elapsed <= 0
    ) {
      finishActiveEvent();
      continue;
    }

    const excessiveGap =
      typicalInterval !== null &&
      elapsed > typicalInterval * 1.5 + 0.001;

    if (excessiveGap) {
      finishActiveEvent();
      continue;
    }

    /**
     * Primeiro registramos a mudanca de
     * marcha observada no intervalo.
     *
     * Isso nao informa exatamente
     * quando a troca aconteceu.
     */
    if (
      isValidGear(previous.gear) &&
      isValidGear(current.gear) &&
      previous.gear !== current.gear
    ) {
      observations.push({
        startSeconds: previous.timeSeconds,
        endSeconds: current.timeSeconds,
        type: "gear-change",
        description:
          `Marcha observada mudou ` +
          `de ${previous.gear} para ` +
          `${current.gear} entre ` +
          `as duas amostras.`,
        value:
          current.gear -
          previous.gear,
      });
    }

    /**
     * Uma leitura ausente nao deve ser
     * preenchida com valores inventados.
     */
    if (
      !isValidSpeed(previous.speedKmh) ||
      !isValidSpeed(current.speedKmh)
    ) {
      finishActiveEvent();
      continue;
    }

    const difference =
      current.speedKmh -
      previous.speedKmh;

    /**
     * Sem variacao observada:
     * finalizamos a sequencia anterior.
     */
    if (difference === 0) {
      finishActiveEvent();
      continue;
    }

    const currentTrend: SpeedTrend =
      difference > 0
        ? "increase"
        : "decrease";

    /**
     * Se o sentido da variacao mudou,
     * encerramos o evento anterior.
     */
    if (
      activeEvent &&
      activeEvent.type !== currentTrend
    ) {
      finishActiveEvent();
    }

    if (!activeEvent) {
      activeEvent = {
        type: currentTrend,
        startSeconds:
          previous.timeSeconds,
        endSeconds:
          current.timeSeconds,
        startSpeed:
          previous.speedKmh,
        endSpeed:
          current.speedKmh,
        intervals: 1,
      };
    } else {
      activeEvent.endSeconds =
        current.timeSeconds;

      activeEvent.endSpeed =
        current.speedKmh;

      activeEvent.intervals += 1;
    }
  }

  finishActiveEvent();

  /**
   * Organizamos todos os eventos em
   * ordem temporal para a interface.
   *
   * Se uma mudanca de marcha acontecer
   * dentro de uma reducao, ambos podem
   * ser exibidos com intervalos sobrepostos.
   * Isso e esperado.
   */
  observations.sort((a, b) => {
    if (
      a.startSeconds !==
      b.startSeconds
    ) {
      return (
        a.startSeconds -
        b.startSeconds
      );
    }

    if (
      a.endSeconds !==
      b.endSeconds
    ) {
      return (
        a.endSeconds -
        b.endSeconds
      );
    }

    return a.type.localeCompare(b.type);
  });

  const durationSeconds =
    samples.length >= 2
      ? round(
          samples[samples.length - 1]
            .timeSeconds -
          samples[0].timeSeconds,
          3
        )
      : 0;

  if (samples.length < 2) {
    warnings.push(
      "São necessárias pelo menos duas amostras para analisar variações."
    );
  }

  if (
    validSpeeds.length <
    samples.length
  ) {
    warnings.push(
      "Algumas velocidades não foram identificadas. Sequências com leituras ausentes não são completadas artificialmente."
    );
  }

  if (
    validGearSamples <
    samples.length
  ) {
    warnings.push(
      "Algumas marchas não foram identificadas."
    );
  }

  if (
    validSpeeds.length > 0
  ) {
    warnings.push(
      "As velocidades são provenientes de OCR e podem conter erros, mesmo quando aceitas."
    );
  }

  if (
    positiveIntervals.some(
      (interval) => interval >= 1
    )
  ) {
    warnings.push(
      "A distância temporal entre algumas amostras limita a identificação de eventos rápidos."
    );
  }

  if (
    typicalInterval !== null &&
    positiveIntervals.some(
      (interval) =>
        interval >
        typicalInterval * 1.5 + 0.001
    )
  ) {
    warnings.push(
      "Foram encontradas lacunas maiores que o intervalo usual. Esses trechos não foram agrupados."
    );
  }

  warnings.push(
    "Os eventos agrupados descrevem apenas mudanças entre velocidades observadas. Não comprovam frenagem, aceleração pelo pedal ou erros de pilotagem."
  );

  return {
    totalSamples: samples.length,
    validSpeedSamples:
      validSpeeds.length,
    validGearSamples,
    durationSeconds,
    minimumObservedSpeed:
      validSpeeds.length > 0
        ? Math.min(...validSpeeds)
        : null,
    maximumObservedSpeed:
      validSpeeds.length > 0
        ? Math.max(...validSpeeds)
        : null,
    observations,
    warnings,
    samples,
  };
}
