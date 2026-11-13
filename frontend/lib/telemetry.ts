
export type TelemetryPoint = {
  time: number;
  speed: number;
  brake: number;
  throttle: number;
  gear?: number;
};

export type TelemetrySummary = {
  samples: number;
  durationSeconds: number;
  maxSpeedKmh: number;
  averageSpeedKmh: number;
  gearChanges: number;
};

export function calculateTelemetrySummary(
  data: TelemetryPoint[]
): TelemetrySummary {
  if (data.length === 0) {
    return {
      samples: 0,
      durationSeconds: 0,
      maxSpeedKmh: 0,
      averageSpeedKmh: 0,
      gearChanges: 0,
    };
  }

  const maxSpeedKmh = Math.max(
    ...data.map((point) => point.speed)
  );

  let totalSpeed = 0;
  let gearChanges = 0;

  for (let i = 0; i < data.length; i++) {
    totalSpeed += data[i].speed;

    if (
      i > 0 &&
      data[i].gear !== undefined &&
      data[i - 1].gear !== undefined &&
      data[i].gear !== data[i - 1].gear
    ) {
      gearChanges++;
    }
  }

  return {
    samples: data.length,
    durationSeconds:
      data[data.length - 1].time - data[0].time,
    maxSpeedKmh,
    averageSpeedKmh: totalSpeed / data.length,
    gearChanges,
  };
}
