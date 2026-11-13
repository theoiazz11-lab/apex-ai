
"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TelemetryRow = {
  time: number;
  speed: number;
  brake: number;
  throttle: number;
  gear?: number;
};

type Finding = {
  title: string;
  detail: string;
  exercise: string;
};

function TelemetryChart({
  data,
  title,
  description,
  dataKey,
  color,
  unit,
}: {
  data: TelemetryRow[];
  title: string;
  description: string;
  dataKey: "speed" | "throttle" | "brake";
  color: string;
  unit: string;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-cyan-400">
        {title}
      </h2>
      <p className="mt-3 text-sm text-slate-400">
        {description}
      </p>
      <div className="mt-6 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 10,
              right: 20,
              left: 0,
              bottom: 20,
            }}
          >
            <CartesianGrid
              stroke="#334155"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke="#94a3b8"
              label={{
                value: "Tempo (s)",
                position: "insideBottom",
                offset: -12,
              }}
            />
            <YAxis
              stroke="#94a3b8"
              domain={
                dataKey === "speed"
                  ? ["auto", "auto"]
                  : [0, 100]
              }
              unit={unit}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: 12,
                color: "#ffffff",
              }}
            />
            <Legend verticalAlign="top" />
            <Line
              type="linear"
              dataKey={dataKey}
              name={`${title.replace("Gráfico de ", "")} (${unit})`}
              stroke={color}
              strokeWidth={3}
              dot={data.length <= 30}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CombinedChart({
  data,
}: {
  data: TelemetryRow[];
}) {
  return (
    <section className="mt-8 rounded-2xl border border-cyan-800 bg-slate-900 p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-cyan-400">
        Freio e acelerador combinados
      </h2>

      <p className="mt-3 text-sm text-slate-400">
        Compare a intensidade do freio e do acelerador
        durante a volta.
      </p>

      <div className="mt-6 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 10,
              right: 20,
              left: 0,
              bottom: 20,
            }}
          >
            <CartesianGrid
              stroke="#334155"
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke="#94a3b8"
              label={{
                value: "Tempo (s)",
                position: "insideBottom",
                offset: -12,
              }}
            />

            <YAxis
              domain={[0, 100]}
              stroke="#94a3b8"
              unit="%"
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: 12,
                color: "#ffffff",
              }}
            />

            <Legend verticalAlign="top" />

            <Line
              type="linear"
              dataKey="throttle"
              name="Acelerador (%)"
              stroke="#22c55e"
              strokeWidth={3}
              dot={data.length <= 30}
              isAnimationActive={false}
            />

            <Line
              type="linear"
              dataKey="brake"
              name="Freio (%)"
              stroke="#ef4444"
              strokeWidth={3}
              dot={data.length <= 30}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-sm text-slate-400">
        O gráfico facilita a visualização de momentos
        em que freio e acelerador são utilizados
        simultaneamente.
      </p>
    </section>
  );
}

function analyzeTelemetry(
  rows: TelemetryRow[]
): Finding[] {
  const findings: Finding[] = [];

  const overlap = rows.filter(
    (row) =>
      row.brake > 20 &&
      row.throttle > 20
  );

  if (overlap.length > 0) {
    findings.push({
      title: "Sobreposição de freio e acelerador",
      detail: `${overlap.length} amostra(s) com freio e acelerador acima de 20%.`,
      exercise:
        "Revise os momentos de transição entre frenagem e aceleração.",
    });
  }

  let throttleChanges = 0;

  for (let i = 2; i < rows.length; i++) {
    const a = rows[i - 2];
    const b = rows[i - 1];
    const c = rows[i];

    if (
      a.brake < 10 &&
      b.brake < 10 &&
      c.brake < 10 &&
      Math.abs(b.throttle - a.throttle) >= 30 &&
      Math.abs(c.throttle - b.throttle) >= 30 &&
      (b.throttle - a.throttle) *
        (c.throttle - b.throttle) < 0
    ) {
      throttleChanges++;
    }
  }

  if (throttleChanges > 0) {
    findings.push({
      title: "Oscilação do acelerador",
      detail: `${throttleChanges} possível(is) oscilação(ões) de aceleração.`,
      exercise:
        "Pratique saídas de curva aplicando o acelerador progressivamente.",
    });
  }

  let abruptBraking = 0;

  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1];
    const current = rows[i];

    const dt = current.time - previous.time;

    if (
      dt > 0 &&
      dt <= 0.2 &&
      previous.brake < 20 &&
      current.brake > 80
    ) {
      abruptBraking++;
    }
  }

  if (abruptBraking > 0) {
    findings.push({
      title: "Aplicação rápida do freio",
      detail: `${abruptBraking} possível(is) aplicação(ões) rápida(s) de frenagem.`,
      exercise:
        "Compare a frenagem com uma volta de referência antes de fazer alterações.",
    });
  }

  return findings.slice(0, 3);
}

export default function AnalyzePage() {
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState<TelemetryRow[]>([]);
  const [error, setError] = useState("");

  async function handleFile(file?: File) {
    setFileName(file?.name || "");
    setData([]);
    setError("");

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Selecione um arquivo CSV.");
      return;
    }

    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);

      if (lines.length < 3) {
        throw new Error("Dados insuficientes.");
      }

      const header = lines[0]
        .replace(/^\uFEFF/, "")
        .split(",")
        .map((value) =>
          value.trim().toLowerCase()
        );

      const required = [
        "time",
        "speed",
        "brake",
        "throttle",
      ];

      if (
        !required.every((name) =>
          header.includes(name)
        )
      ) {
        throw new Error("Colunas ausentes.");
      }

      const rows: TelemetryRow[] = lines
        .slice(1)
        .filter((line) => line.trim())
        .map((line) => {
          const values = line
            .split(",")
            .map((v) => v.trim());

          const number = (column: string) => {
            const value =
              values[header.indexOf(column)];

            return value === undefined ||
              value === ""
              ? NaN
              : Number(value);
          };

          const gearIndex = header.indexOf("gear");
          const gearValue =
            gearIndex >= 0
              ? values[gearIndex]
              : undefined;

          return {
            time: number("time"),
            speed: number("speed"),
            brake: number("brake"),
            throttle: number("throttle"),
            gear:
              gearValue !== undefined &&
              gearValue !== ""
                ? Number(gearValue)
                : undefined,
          };
        });

      if (
        rows.length < 2 ||
        rows.some(
          (row) =>
            !Number.isFinite(row.time) ||
            !Number.isFinite(row.speed) ||
            !Number.isFinite(row.brake) ||
            !Number.isFinite(row.throttle) ||
            row.speed < 0 ||
            row.brake < 0 ||
            row.brake > 100 ||
            row.throttle < 0 ||
            row.throttle > 100 ||
            (row.gear !== undefined &&
              (!Number.isInteger(row.gear) ||
                row.gear < -1 ||
                row.gear > 10))
        ) ||
        rows.some(
          (row, index) =>
            index > 0 &&
            row.time <= rows[index - 1].time
        )
      ) {
        throw new Error("Dados inválidos.");
      }

      setData(rows);
    } catch {
      setError(
        "Não foi possível ler o CSV. Confira o formato dos dados."
      );
    }
  }

  const maxSpeed = data.length
    ? Math.max(...data.map((row) => row.speed))
    : 0;

  const averageSpeed = data.length
    ? data.reduce(
        (sum, row) => sum + row.speed,
        0
      ) / data.length
    : 0;

  const findings = analyzeTelemetry(data);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <a
          href="/"
          className="text-slate-400 hover:text-white"
        >
          ← Voltar ao início
        </a>

        <p className="mt-12 font-bold tracking-widest text-cyan-400">
          APEX AI
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Análise de Telemetria
        </h1>

        <p className="mt-4 text-slate-400">
          Descubra possíveis pontos de melhoria
          na pilotagem.
        </p>

        <section className="mt-10 rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <h2 className="text-2xl font-semibold">
            Envie sua telemetria
          </h2>

          <p className="mt-3 text-slate-400">
            Selecione um arquivo CSV para visualizar
            os dados.
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={(event) =>
              handleFile(event.target.files?.[0])
            }
            className="mt-6 block w-full text-sm"
          />

          {fileName && (
            <p className="mt-5 text-cyan-400">
              Arquivo selecionado: {fileName}
            </p>
          )}

          {error && (
            <p className="mt-4 text-red-400">
              {error}
            </p>
          )}
        </section>

        {data.length > 0 && (
          <>
            <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-8">
              <h2 className="text-2xl font-bold text-cyan-400">
                Resultado da leitura
              </h2>

              <div className="mt-6 space-y-3">
                <p>
                  Registros encontrados: {data.length}
                </p>

                <p>
                  Velocidade máxima:{" "}
                  {maxSpeed.toFixed(1)} km/h
                </p>

                <p>
                  Velocidade média das amostras:{" "}
                  {averageSpeed.toFixed(1)} km/h
                </p>
              </div>
            </section>

            <TelemetryChart
              data={data}
              title="Gráfico de velocidade"
              description="Velocidade registrada ao longo da volta."
              dataKey="speed"
              color="#22d3ee"
              unit="km/h"
            />

            <TelemetryChart
              data={data}
              title="Gráfico de acelerador"
              description="Porcentagem de acelerador aplicada pelo piloto."
              dataKey="throttle"
              color="#22c55e"
              unit="%"
            />

            <TelemetryChart
              data={data}
              title="Gráfico de freio"
              description="Porcentagem de frenagem aplicada pelo piloto."
              dataKey="brake"
              color="#ef4444"
              unit="%"
            />

            <CombinedChart data={data} />

            <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-cyan-400">
                Dados da pilotagem
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Telemetria registrada em cada amostra.
                A marcha aparece quando estiver no arquivo.
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-cyan-400">
                    <tr>
                      <th className="p-3">Tempo</th>
                      <th className="p-3">Velocidade</th>
                      <th className="p-3">Acelerador</th>
                      <th className="p-3">Freio</th>
                      <th className="p-3">Marcha</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.map((row, index) => (
                      <tr
                        key={index}
                        className="border-t border-slate-700"
                      >
                        <td className="p-3">
                          {row.time}s
                        </td>

                        <td className="p-3">
                          {row.speed} km/h
                        </td>

                        <td className="p-3">
                          {row.throttle}%
                        </td>

                        <td className="p-3">
                          {row.brake}%
                        </td>

                        <td className="p-3">
                          {row.gear === undefined
                            ? "Sem dados"
                            : row.gear === 0
                              ? "N"
                              : row.gear === -1
                                ? "R"
                                : `${row.gear}ª`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-cyan-800 bg-slate-900 p-6 sm:p-8">
              <p className="font-semibold tracking-widest text-cyan-400">
                APEX AI COACH
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                Diagnóstico experimental
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Estes alertas são baseados em regras
                experimentais, não em inteligência
                artificial. Não comprovam erros de pilotagem.
              </p>

              {findings.length === 0 ? (
                <p className="mt-6 text-slate-300">
                  Nenhum sinal identificado pelas regras
                  atuais. Isso não significa que a volta
                  esteja perfeita.
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {findings.map((finding, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-700 bg-slate-950 p-5"
                    >
                      <h3 className="font-bold text-cyan-400">
                        {index + 1}. {finding.title}
                      </h3>

                      <p className="mt-3 text-slate-300">
                        {finding.detail}
                      </p>

                      <p className="mt-4 text-sm text-slate-400">
                        Exercício sugerido:{" "}
                        {finding.exercise}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-6 text-xs text-slate-500">
                Versão de desenvolvimento. Requer
                telemetria real e validação antes
                de orientar pilotos.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
