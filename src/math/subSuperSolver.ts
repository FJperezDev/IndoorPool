import type { Person } from "../store/useSimulationStore";

// ============================================================================
//  MODELO: climatización de una piscina cubierta (reacción-difusión 2D)
//
//  La temperatura se trabaja NORMALIZADA, u ∈ [0,1]:
//      u = (T - T_MIN) / (T_MAX - T_MIN)
//  con T_MIN = 10 °C (exterior en la puerta) y T_MAX = 37 °C (cuerpo humano).
//  En esta escala la no linealidad logística λ u (1-u) está bien definida.
//
//  Ecuación interior:
//      -Δu = λ u (1-u) + Σ_i κ_i(x) (u_{p,i} - u)
//  donde u_{p,i} es la temperatura corporal normalizada de la persona i.
//  Condiciones de contorno mixtas:
//      cristalera (trasera):  ∂u/∂n + α u = α u_ext      (Robin)
//      puerta (derecha):      u = u_puerta                (Dirichlet, si abre)
//      resto del cerramiento: ∂u/∂n = 0                   (Neumann, adiabático)
//
//  Iteración monótona (esquema de punto fijo):
//      (A_h + M I) u^{k+1} = f(u^k) + M u^k,   M ≥ sup|∂f/∂u|
//  A_h + M I es una M-matriz => inversa no negativa => se preserva el
//  principio del máximo discreto y las dos sucesiones (sub y super) son
//  monótonas y convergentes.
// ============================================================================

export const GRID_SIZE = 64;

// --- Temperaturas físicas (°C) ---
const T_MIN = 10; // exterior en la puerta (escenario más frío)
const T_MAX = 37; // temperatura corporal T_p
const T_EXT = 18; // exterior tras las cristaleras

// --- Temperaturas normalizadas u ∈ [0,1] ---
export const U_EXT = (T_EXT - T_MIN) / (T_MAX - T_MIN); // ≈ 0.296
export const U_DOOR = 0; // T = T_MIN = 10 °C (puerta abierta)

// --- Parámetros del modelo ---
export const LAMBDA = 5.0; // intensidad de la reacción logística (saturación)
export const KAPPA = 2.0; // coeficiente de transferencia corporal por persona
export const GAMMA = 0.5; // acoplamiento Robin adimensional (γ = α·h)

// Tramos de la puerta en la pared derecha (x = +10). En coordenadas de malla,
// la puerta ocupa z ∈ [-2, 2] → j ∈ [doorLo, doorHi].
const doorLo = Math.round(0.4 * (GRID_SIZE - 1));
const doorHi = Math.round(0.6 * (GRID_SIZE - 1));

const h = 1 / (GRID_SIZE - 1);
const h2 = h * h;
const NB = 1 / h2; // coeficiente fuera de la diagonal

// ---------------------------------------------------------------------------
//  Estado del solver (dos sucesiones monótonas simultáneas)
// ---------------------------------------------------------------------------
export interface SolverState {
  sub: Float32Array; // sucesión inferior  u_k (creciente)
  super: Float32Array; // sucesión superior ū_k (decreciente)
  iteration: number;
  maxGap: number; // ‖ū - u‖_∞  (medida de convergencia)
  supSub: number; // sup u_k (para mostrar el "techo" inferior)
  infSuper: number; // inf ū_k (para mostrar el "suelo" superior)
}

export const toCelsius = (u: number) => T_MIN + (T_MAX - T_MIN) * u;

const createSolverState = (): SolverState => ({
  sub: new Float32Array(GRID_SIZE * GRID_SIZE).fill(U_DOOR), // sub-solución u ≡ 0
  super: new Float32Array(GRID_SIZE * GRID_SIZE).fill(1), // super-solución u ≡ 1
  iteration: 0,
  maxGap: 1,
  supSub: 0,
  infSuper: 1,
});

export const solverState: SolverState = createSolverState();

export const resetSolver = () => {
  solverState.sub.fill(U_DOOR);
  solverState.super.fill(1);
  solverState.iteration = 0;
  solverState.maxGap = 1;
  solverState.supSub = 0;
  solverState.infSuper = 1;
  telemetry.history.length = 0;
};

// ---------------------------------------------------------------------------
//  Telemetría para el panel de convergencia (mutable, sin re-renders)
// ---------------------------------------------------------------------------
const HISTORY_STRIDE = 10;
const MAX_HISTORY = 6000;

export const telemetry = {
  iteration: 0,
  maxGap: 1,
  supSub: 0,
  infSuper: 1,
  history: [] as { iter: number; gap: number }[],
};

// ---------------------------------------------------------------------------
//  Campo de fuentes corporales. Cada persona i aporta, en su celda ocupada, el
//  término κ_i(x) (u_{p,i} - u), donde u_{p,i} es su temperatura corporal
//  normalizada. Se separan dos campos:
//    · weight[idx] = Σ_i κ_i(x)         (peso total, para la cota de M)
//    · source[idx] = Σ_i κ_i(x) u_{p,i} (calor efectivo aportado)
// ---------------------------------------------------------------------------
export interface PersonField {
  weight: Float32Array;
  source: Float32Array;
}

export const normalizeCelsius = (t: number) => (t - T_MIN) / (T_MAX - T_MIN);

export const buildPersonField = (persons: Person[]): PersonField => {
  const weight = new Float32Array(GRID_SIZE * GRID_SIZE);
  const source = new Float32Array(GRID_SIZE * GRID_SIZE);
  persons.forEach((p) => {
    const i = Math.round(((p.x + 10) / 20) * (GRID_SIZE - 1));
    const j = Math.round(((p.z + 10) / 20) * (GRID_SIZE - 1));
    if (i >= 1 && i < GRID_SIZE - 1 && j >= 1 && j < GRID_SIZE - 1) {
      const idx = i * GRID_SIZE + j;
      const up = normalizeCelsius(p.temp);
      weight[idx] += KAPPA;
      source[idx] += KAPPA * up;
    }
  });
  return { weight, source };
};

// ---------------------------------------------------------------------------
//  Una pasada de Gauss-Seidel del sistema (A_h + M I) u = f(u) + M u
//  (relajación del esquema de punto fijo monótono).
// ---------------------------------------------------------------------------
const sweep = (
  grid: Float32Array,
  field: PersonField,
  M: number,
  doorOpen: boolean,
) => {
  const N = GRID_SIZE;
  const center = 4 * NB + M;

  // Nodos interiores (plantilla de cinco puntos)
  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      const idx = i * N + j;
      const u = grid[idx];
      const f =
        LAMBDA * u * (1 - u) + (field.source[idx] - field.weight[idx] * u);
      const sum =
        grid[(i - 1) * N + j] +
        grid[(i + 1) * N + j] +
        grid[i * N + (j - 1)] +
        grid[i * N + (j + 1)];
      grid[idx] = (NB * sum + f + M * u) / center;
    }
  }

  // Cristalera (pared trasera, j = 0): condición de Robin
  for (let i = 1; i < N - 1; i++) {
    grid[i * N] = (grid[i * N + 1] + GAMMA * U_EXT) / (1 + GAMMA);
  }

  // Pared frontal (j = N-1): adiabática (Neumann)
  for (let i = 1; i < N - 1; i++) {
    grid[i * N + (N - 1)] = grid[i * N + (N - 2)];
  }

  // Pared izquierda (i = 0): adiabática (Neumann)
  for (let j = 1; j < N - 1; j++) {
    grid[j] = grid[N + j];
  }

  // Pared derecha (i = N-1): puerta (Dirichlet si abierta, Neumann si cerrada)
  for (let j = 1; j < N - 1; j++) {
    const idx = (N - 1) * N + j;
    if (doorOpen && j >= doorLo && j <= doorHi) {
      grid[idx] = U_DOOR;
    } else {
      grid[idx] = grid[(N - 2) * N + j];
    }
  }

  // Esquinas (irrelevantes; espejo diagonal)
  grid[0] = grid[N + 1];
  grid[N - 1] = grid[N + (N - 2)];
  grid[(N - 1) * N] = grid[(N - 2) * N + 1];
  grid[(N - 1) * N + (N - 1)] = grid[(N - 2) * N + (N - 2)];
};

// ---------------------------------------------------------------------------
//  Avance del solver: `sweeps` pasadas por frame, actualizando AMBAS sucesiones
//  y la telemetría de convergencia.
// ---------------------------------------------------------------------------
export const stepSimulation = (
  persons: Person[],
  doorOpen: boolean,
  sweeps: number,
) => {
  const field = buildPersonField(persons);

  let maxWeight = 0;
  for (let k = 0; k < field.weight.length; k++) {
    if (field.weight[k] > maxWeight) maxWeight = field.weight[k];
  }
  // M = λ + κ·N_local ≥ sup |∂f/∂u|
  const M = LAMBDA + maxWeight;

  for (let s = 0; s < sweeps; s++) {
    sweep(solverState.sub, field, M, doorOpen);
    sweep(solverState.super, field, M, doorOpen);
    solverState.iteration++;
  }

  // Métricas de convergencia y cotas
  let gap = 0;
  let supSub = -Infinity;
  let infSuper = Infinity;
  for (let k = 0; k < solverState.sub.length; k++) {
    const d = solverState.super[k] - solverState.sub[k];
    if (d > gap) gap = d;
    if (solverState.sub[k] > supSub) supSub = solverState.sub[k];
    if (solverState.super[k] < infSuper) infSuper = solverState.super[k];
  }

  solverState.maxGap = gap;
  solverState.supSub = supSub;
  solverState.infSuper = infSuper;

  telemetry.iteration = solverState.iteration;
  telemetry.maxGap = gap;
  telemetry.supSub = supSub;
  telemetry.infSuper = infSuper;

  if (solverState.iteration % HISTORY_STRIDE === 0) {
    telemetry.history.push({ iter: solverState.iteration, gap });
    if (telemetry.history.length > MAX_HISTORY) telemetry.history.shift();
  }
};

// ---------------------------------------------------------------------------
//  Colormap "turbo" (azul → verde → amarillo → rojo), apto para mapas de calor.
//  Las paradas se exportan también para construir la leyenda en CSS.
// ---------------------------------------------------------------------------
export const TURBO_STOPS: [number, number, number, number][] = [
  [0.0, 48, 18, 59],
  [0.125, 70, 107, 227],
  [0.25, 40, 187, 255],
  [0.375, 49, 242, 183],
  [0.5, 151, 254, 73],
  [0.625, 249, 214, 43],
  [0.75, 244, 124, 27],
  [0.875, 207, 51, 46],
  [1.0, 122, 4, 3],
];

export const colorMap = (t: number): [number, number, number] => {
  const x = Math.min(Math.max(t, 0), 1);
  const stops = TURBO_STOPS;
  if (x <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3]];
  for (let k = 1; k < stops.length; k++) {
    const [t1, r1, g1, b1] = stops[k - 1];
    const [t2, r2, g2, b2] = stops[k];
    if (x <= t2) {
      const s = (x - t1) / (t2 - t1);
      return [
        Math.round(r1 + (r2 - r1) * s),
        Math.round(g1 + (g2 - g1) * s),
        Math.round(b1 + (b2 - b1) * s),
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
};

export const cssGradient = (): string => {
  const parts = TURBO_STOPS.map(
    ([t, r, g, b]) =>
      `rgb(${r},${g},${b}) ${(t * 100).toFixed(1)}%`,
  );
  return `linear-gradient(to right, ${parts.join(", ")})`;
};
