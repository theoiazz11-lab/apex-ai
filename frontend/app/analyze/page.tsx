
"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

function analyzeTelemetry(rows: TelemetryRow[]): Finding[] {
  const findings: Finding[] = [];

  const overlap = rows.filter(
    (row) => row.brake > 20 && row.throttle > 20
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

      const header = lines[0]
        .replace(/^\uFEFF/, "")
        .split(",")
        .map((value) => value.trim().toLowerCase());

      const required = [
        "time",
        "speed",
        "brake",
        "throttle",
      ];

      if (!required.every((name) => header.includes(name))) {
        throw new Error("Colunas obrigatórias ausentes.");
      }

      const rows: TelemetryRow[] = lines
        .slice(1)
        .filter((line) => line.trim())
        .map((line) => {
          const values = line
            .split(",")
            .map((value) => value.trim());

          const number = (column: string) =>
            Number(values[header.indexOf(column)]);

          const gearIndex = header.indexOf("gear");

          return {
            time: number("time"),
            speed: number("speed"),
            brake: number("brake"),
            throttle: number("throttle"),
            gear:
              gearIndex >= 0 &&
              values[gearIndex] !== ""
                ? Number(values[gearIndex])
                : undefined,
          };
        });

      const invalidRows = rows.some((row) => {
        return (
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
        );
      });

      const invalidTimes = rows.some(
        (row, index) =>
          index > 0 &&
          row.time <= rows[index - 1].time
      );

      if (
        rows.length < 2 ||
        invalidRows ||
        invalidTimes
      ) {
        throw new Error("Dados inválidos.");
      }

      setData(rows);
    } catch {
      setError(
        "Não foi possível ler o CSV. Confira o formato."
      );
    }
  }

  const maxSpeed =
    data.length > 0
      ? Math.max(...data.map((row) => row.speed))
      : 0;

  const averageSpeed =
    data.length > 0
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
          Descubra possíveis pontos de melhoria na pilotagem.
        </p>

        {/* ENVIO DE ARQUIVOS */}
        <section className="mt-10 rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <h2 className="text-2xl font-semibold">
            Envie sua telemetria
          </h2>

          <p className="mt-3 text-slate-400">
            Selecione um arquivo CSV para visualizar
            os dados da volta.
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
            {/* RESULTADOS */}
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

            {/* GRÁFICO DE VELOCIDADE */}
            <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-8">
              <h2 className="text-2xl font-bold text-cyan-400">
                Gráfico de velocidade
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Velocidade registrada ao longo do tempo.
              </p>

              <div className="mt-6 h-72 w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart data={data}>
                    <CartesianGrid
                      stroke="#334155"
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="time"
                      stroke="#94a3b8"
                    />

                    <YAxis stroke="#94a3b8" />

                    <Tooltip />

                    <Legend verticalAlign="top" />

                    <Line
                      type="linear"
                      dataKey="speed"
                      name="Velocidade (km/h)"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      dot={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* TABELA DE TELEMETRIA */}
            <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-8">
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

            {/* DIAGNÓSTICO EXPERIMENTAL */}
            <section className="mt-8 rounded-2xl border border-cyan-800 bg-slate-900 p-8">
              <p className="font-semibold tracking-widest text-cyan-400">
                APEX AI COACH
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                Diagnóstico experimental
              </h2>

              <p className="mt-3 text-sm text-slate-400">
                Estes alertas são baseados em regras
                experimentais, não em inteligência artificial.
                Não comprovam erros de pilotagem.
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
                Versão de desenvolvimento.
                Requer telemetria real e validação
                antes de orientar pilotos.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
