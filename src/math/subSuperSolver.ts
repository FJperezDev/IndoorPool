import type { Person } from "../store/useSimulationStore";

// ============================================================================
//  MODELO: climatización de una piscina cubierta (reacción-difusión 2D)
//
//  La temperatura se trabaja NORMALIZADA, u ∈ [0,1]:
//      u = (T - T_MIN) / (T_MAX - T_MIN)
//  con T_MIN = -10 °C (exterior invernal peor caso, puerta abierta) y
//  T_MAX = 40 °C (consigna máxima de los radiadores). En esta escala la
//  no linealidad logística λ u (1-u) está bien definida y las constantes
//  u ≡ 0 y u ≡ 1 son sub y super-solución válidas para TODO escenario.
//
//  Ecuación interior:
//      -Δu = λ u (1-u) + Σ_i κ_i(x) (u_{p,i} - u) + Σ_j ρ_j(x) (u_{r,j} - u)⁺
//  (personas como sumideros/fuentes lineales; radiadores con clamp
//  termostático (z)⁺ = max(z,0): solo calientan por debajo de su consigna).
//  Condiciones de contorno mixtas:
//      cristalera (trasera):  ∂u/∂n + α u = α u_ext      (Robin)
//      puerta (derecha):      u = u_puerta  abierta      (Dirichlet)
//                             ∂u/∂n + α_d u = α_d u_ext  cerrada (Robin, cristal)
//      resto del cerramiento: ∂u/n = 0                  (Neumann, adiabático)
//
//  Iteración monótona (esquema de punto fijo):
//      (A_h + M I) u^{k+1} = f(u^k) + M u^k,   M ≥ sup|∂f/∂u|
//  A_h + M I es una M-matriz => inversa no negativa => se preserva el
//  principio del máximo discreto y las dos sucesiones (sub y super) son
//  monótonas y convergentes.
// ============================================================================

export const GRID_SIZE = 64;

// --- Temperaturas físicas (°C) ---
const T_MIN = -10; // exterior invernal peor caso (puerta abierta)
const T_MAX = 40; // consigna máxima del radiador (límite superior normalizado)

// --- Semilado de la sala (m): el dominio del solver coincide con las
//     caras interiores del cerramiento dibujado en Building.tsx [-11, 11]² ---
export const HALF_ROOM = 11;

// --- Semiancho del hueco de puerta (m): coincide con el hueco visual ---
export const DOOR_HALF_WIDTH = 1;

// --- Temperaturas normalizadas u ∈ [0,1] ---
export const U_DOOR = 0; // T = T_MIN = -10 °C (puerta abierta, invierno)

// --- Calefacción: radiadores termostáticos sobre el muro opaco izquierdo ---
export interface HeaterConfig {
  enabled: boolean;
  tempC: number; // consigna del radiador (°C), ≤ T_MAX para no romper ū ≡ 1
  power: number; // ρ total por radiador (se reparte entre sus celdas)
}

export const heaters: HeaterConfig = { enabled: true, tempC: 40, power: 9 };

export const setHeaters = (h: Partial<HeaterConfig>) => {
  Object.assign(heaters, h);
};

// Radiadores por defecto: 4 sobre el muro izquierdo (x ≈ -10.5), cada uno
// cubre 3 celdas de muro alrededor de su centro z.
export const RADIATORS: { x: number; z: number; cells: number }[] = [
  { x: -10.5, z: -7.0, cells: 3 },
  { x: -10.5, z: -2.5, cells: 3 },
  { x: -10.5, z: 2.5, cells: 3 },
  { x: -10.5, z: 7.0, cells: 3 },
];

// --- Parámetros del modelo (editables desde la interfaz) ---
export interface SimParams {
  lambda: number; // intensidad de la reacción logística (saturación)
  kappa: number; // coeficiente de transferencia corporal por persona
  alpha: number; // coeficiente convectivo Robin de la cristalera (γ = α·h)
  alphaDoor: number; // coeficiente convectivo Robin de la puerta de cristal
  T_ext: number; // temperatura exterior tras las cristaleras (°C)
}

export const params: SimParams = {
  lambda: 5.0,
  kappa: 2.0,
  alpha: 31.5, // γ = α·h ≈ 0.5 con h = 1/63 (valor original del modelo)
  alphaDoor: 40, // puerta corredera de cristal: algo más convectiva que el fijo
  T_ext: 18,
};

export const setParams = (p: Partial<SimParams>) => {
  Object.assign(params, p);
};

// Tramos de la puerta en la pared derecha (x = +HALF_ROOM). En coordenadas de
// malla, la puerta ocupa z ∈ [-DOOR_HALF_WIDTH, DOOR_HALF_WIDTH].
const worldToGrid = (v: number) =>
  Math.round(((v + HALF_ROOM) / (2 * HALF_ROOM)) * (GRID_SIZE - 1));

const doorLo = worldToGrid(-DOOR_HALF_WIDTH);
const doorHi = worldToGrid(DOOR_HALF_WIDTH);

const h = 1 / (GRID_SIZE - 1);
const h2 = h * h;
const NB = 1 / h2; // coeficiente fuera de la diagonal

// ---------------------------------------------------------------------------
//  Estado del solver (dos sucesiones monótonas simultáneas)
// ---------------------------------------------------------------------------
export interface SolverState {
  sub: Float64Array; // sucesión inferior  u_k (creciente)
  super: Float64Array; // sucesión superior ū_k (decreciente)
  iteration: number;
  maxGap: number; // ‖ū - u‖_∞  (medida de convergencia)
  supSub: number; // sup u_k (para mostrar el "techo" inferior)
  infSuper: number; // inf ū_k (para mostrar el "suelo" superior)
}

export const toCelsius = (u: number) => T_MIN + (T_MAX - T_MIN) * u;

const createSolverState = (): SolverState => ({
  sub: new Float64Array(GRID_SIZE * GRID_SIZE).fill(U_DOOR), // sub-solución u ≡ 0
  super: new Float64Array(GRID_SIZE * GRID_SIZE).fill(1), // super-solución u ≡ 1
  iteration: 0,
  maxGap: 1,
  supSub: 0,
  infSuper: 1,
});

export const solverState: SolverState = createSolverState();

// ---------------------------------------------------------------------------
//  Snapshots de estado para navegación eficiente entre iteraciones: se guarda
//  un par (sub, super) cada SNAP_EVERY iteraciones, de modo que gotoIteration
//  sólo reconstruye como máximo SNAP_EVERY barridos desde el snapshot más
//  cercano (evita reconstruir desde 0 y congelar la Raspberry Pi).
// ---------------------------------------------------------------------------
const SNAP_EVERY = 250;
const MAX_SNAPS = 80;

interface Snap {
  iter: number;
  sub: Float64Array;
  sup: Float64Array;
  histLen: number;
}

let snapshots: Snap[] = [];
let snapSig = "";

// Firma del escenario: dos snapshots sólo son compatibles si el escenario
// (parámetros, personas y estado de puerta) es idéntico.
const scenarioSig = (persons: Person[], doorOpen: boolean) =>
  [
    params.lambda,
    params.kappa,
    params.alpha,
    params.alphaDoor,
    params.T_ext,
    doorOpen,
    heaters.enabled,
    heaters.tempC,
    heaters.power,
    persons
      .map(
        (p) =>
          `${p.id}:${p.x.toFixed(2)},${p.z.toFixed(2)},${p.temp.toFixed(1)}`,
      )
      .join(";"),
  ].join("|");

const takeSnapshot = (sig: string) => {
  if (sig !== snapSig) {
    snapshots = [];
    snapSig = sig;
  }
  snapshots.push({
    iter: solverState.iteration,
    sub: solverState.sub.slice(),
    sup: solverState.super.slice(),
    histLen: telemetry.history.length,
  });
  if (snapshots.length > MAX_SNAPS) {
    // conservar sólo la mitad más reciente, intercalada, para no perder rango
    snapshots = snapshots.filter((_, idx) => idx % 2 === 1);
  }
};

export const resetSolver = () => {
  solverState.sub.fill(U_DOOR);
  solverState.super.fill(1);
  solverState.iteration = 0;
  solverState.maxGap = 1;
  solverState.supSub = 0;
  solverState.infSuper = 1;
  telemetry.iteration = 0;
  telemetry.maxGap = 1;
  telemetry.supSub = 0;
  telemetry.infSuper = 1;
  telemetry.history.length = 0;
  snapshots = [];
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
  M: params.lambda, // M = λ + máx_celda(Σκ + Σρ); se fija tras el 1er paso
  gapViolation: false, // true si en algún nodo ū < u (encajonamiento roto)
  history: [] as { iter: number; gap: number }[],
};

// ---------------------------------------------------------------------------
//  Campos de fuentes. Dos mecanismos separados (el del radiador lleva clamp
//  termostático, el de las personas es lineal):
//    · weight/source: Σ_i κ_i(x) y Σ_i κ_i(x) u_{p,i}   (personas, lineal)
//    · weightR/sourceR: Σ_j ρ_j(x) y Σ_j ρ_j(x) u_{r,j} (radiadores, clamp)
//  En el barrido:  f = λu(1-u) + (src - wgt·u) + max(srcR - wgtR·u, 0).
// ---------------------------------------------------------------------------
export interface PersonField {
  weight: Float64Array;
  source: Float64Array;
  weightR: Float64Array;
  sourceR: Float64Array;
}

export const normalizeCelsius = (t: number) => (t - T_MIN) / (T_MAX - T_MIN);

// El campo sólo depende de `persons`, `params.kappa` y `heaters`; se cachea y
// se reutilizan los buffers para no asignar ~64 KB por frame (evita picos de
// GC durante la animación).
let fieldCache: {
  personsRef: Person[];
  kappa: number;
  enabled: boolean;
  tempC: number;
  power: number;
  field: PersonField;
  maxWeight: number; // máx_x (Σκ + Σρ): cota del término Lipschitz de las fuentes
} | null = null;

export const buildPersonField = (persons: Person[]): PersonField => {
  const hit =
    fieldCache &&
    fieldCache.personsRef === persons &&
    fieldCache.kappa === params.kappa &&
    fieldCache.enabled === heaters.enabled &&
    fieldCache.tempC === heaters.tempC &&
    fieldCache.power === heaters.power
      ? fieldCache
      : null;
  if (hit) return hit.field;

  const size = GRID_SIZE * GRID_SIZE;
  const mk = (old?: Float64Array) => old ?? new Float64Array(size);
  const prev = fieldCache ? fieldCache.field : null;
  const weight = mk(prev?.weight);
  const source = mk(prev?.source);
  const weightR = mk(prev?.weightR);
  const sourceR = mk(prev?.sourceR);
  weight.fill(0);
  source.fill(0);
  weightR.fill(0);
  sourceR.fill(0);

  const maxWeightArr = new Float64Array(size); // (Σκ+Σρ) por celda, para M

  persons.forEach((p) => {
    const i = worldToGrid(p.x);
    const j = worldToGrid(p.z);
    if (i >= 1 && i < GRID_SIZE - 1 && j >= 1 && j < GRID_SIZE - 1) {
      const idx = i * GRID_SIZE + j;
      const up = normalizeCelsius(p.temp);
      weight[idx] += params.kappa;
      source[idx] += params.kappa * up;
      maxWeightArr[idx] += params.kappa;
    }
  });

  if (heaters.enabled) {
    const ur = Math.min(normalizeCelsius(heaters.tempC), 1); // u_r ≤ 1: ū ≡ 1 válida
    for (const r of RADIATORS) {
      const i = worldToGrid(r.x);
      const j0 = worldToGrid(r.z);
      const per = heaters.power / r.cells; // ρ repartido entre sus celdas
      for (let dj = 0; dj < r.cells; dj++) {
        const jj = j0 - ((r.cells - 1) >> 1) + dj;
        if (i >= 1 && i < GRID_SIZE - 1 && jj >= 1 && jj < GRID_SIZE - 1) {
          const idx = i * GRID_SIZE + jj;
          weightR[idx] += per;
          sourceR[idx] += per * ur;
          maxWeightArr[idx] += per;
        }
      }
    }
  }

  let maxWeight = 0;
  for (let k = 0; k < size; k++) if (maxWeightArr[k] > maxWeight) maxWeight = maxWeightArr[k];

  const field = { weight, source, weightR, sourceR };
  fieldCache = {
    personsRef: persons,
    kappa: params.kappa,
    enabled: heaters.enabled,
    tempC: heaters.tempC,
    power: heaters.power,
    field,
    maxWeight,
  };
  return field;
};

// ---------------------------------------------------------------------------
//  Una pasada de Gauss-Seidel del sistema (A_h + M I) u = f(u) + M u
//  (relajación del esquema de punto fijo monótono).
// ---------------------------------------------------------------------------
const sweep = (
  grid: Float64Array,
  field: PersonField,
  M: number,
  doorOpen: boolean,
) => {
  const N = GRID_SIZE;
  const center = 4 * NB + M;
  const gamma = params.alpha * h; // γ = α·h (acoplamiento Robin cristalera)
  const gammaDoor = params.alphaDoor * h; // acoplamiento Robin puerta de cristal
  const uExt = normalizeCelsius(params.T_ext);
  const lambda = params.lambda;
  const src = field.source;
  const wgt = field.weight;
  const srcR = field.sourceR;
  const wgtR = field.weightR;

  // Nodos interiores (plantilla de cinco puntos)
  for (let j = 1; j < N - 1; j++) {
    for (let i = 1; i < N - 1; i++) {
      const idx = i * N + j;
      const u = grid[idx];
      const hr = srcR[idx] - wgtR[idx] * u; // radiador con termostato (z)⁺
      const f =
        lambda * u * (1 - u) + (src[idx] - wgt[idx] * u) + (hr > 0 ? hr : 0);
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
    grid[i * N] = (grid[i * N + 1] + gamma * uExt) / (1 + gamma);
  }

  // Pared frontal (j = N-1): adiabática (Neumann)
  for (let i = 1; i < N - 1; i++) {
    grid[i * N + (N - 1)] = grid[i * N + (N - 2)];
  }

  // Pared izquierda (i = 0): adiabática (Neumann)
  for (let j = 1; j < N - 1; j++) {
    grid[j] = grid[N + j];
  }

  // Pared derecha (i = N-1): puerta corredera de cristal.
  //  - abierta:   Dirichlet u = u_puerta (barrido directo con el exterior)
  //  - cerrada:   Robin con su propio coeficiente alphaDoor (el cristal
  //               transmite flujo de calor; no es adiabática)
  //  - resto del muro opaco: Neumann homogénea (adiabática)
  for (let j = 1; j < N - 1; j++) {
    const idx = (N - 1) * N + j;
    const interior = grid[(N - 2) * N + j];
    if (j >= doorLo && j <= doorHi) {
      if (doorOpen) {
        grid[idx] = U_DOOR;
      } else {
        grid[idx] = (interior + gammaDoor * uExt) / (1 + gammaDoor);
      }
    } else {
      grid[idx] = interior;
    }
  }

  // Esquinas (irrelevantes; espejo diagonal)
  grid[0] = grid[N + 1];
  grid[N - 1] = grid[N + (N - 2)];
  grid[(N - 1) * N] = grid[(N - 2) * N + 1];
  grid[(N - 1) * N + (N - 1)] = grid[(N - 2) * N + (N - 2)];
};

// ---------------------------------------------------------------------------
//  Métricas y registro de telemetría (compartidos por el avance continuo y por
//  la navegación manual a una iteración concreta)
// ---------------------------------------------------------------------------
const computeMetrics = () => {
  let gap = 0;
  let supSub = -Infinity;
  let infSuper = Infinity;
  let violation = false;
  for (let k = 0; k < solverState.sub.length; k++) {
    const d = solverState.super[k] - solverState.sub[k];
    if (d > gap) gap = d;
    if (d < -1e-4) violation = true; // ū < u: se rompió el encajonamiento
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
  telemetry.gapViolation = violation;
};

const recordHistory = () => {
  if (solverState.iteration % HISTORY_STRIDE === 0) {
    telemetry.history.push({
      iter: solverState.iteration,
      gap: solverState.maxGap,
    });
    if (telemetry.history.length > MAX_HISTORY) telemetry.history.shift();
  }
};

const buildFieldAndM = (persons: Person[]) => {
  const field = buildPersonField(persons);
  // M = λ + máx_celda(Σκ + Σρ) ≥ sup |∂f/∂u| (cota Lipschitz de f en u sobre [0,1])
  const M = params.lambda + (fieldCache?.maxWeight ?? 0);
  return { field, M };
};

// Una iteración = un barrido de cada sucesión (sub y super). Cada
// HISTORY_STRIDE iteraciones se registran métricas e histórico, y cada
// SNAP_EVERY se toma un snapshot para la navegación posterior. El registro
// depende sólo de la iteración, no del número de barridos por frame.
const advanceSweep = (
  field: PersonField,
  M: number,
  doorOpen: boolean,
  sig: string,
) => {
  sweep(solverState.sub, field, M, doorOpen);
  sweep(solverState.super, field, M, doorOpen);
  solverState.iteration++;
  if (solverState.iteration % HISTORY_STRIDE === 0) {
    computeMetrics();
    recordHistory();
  }
  if (solverState.iteration % SNAP_EVERY === 0) {
    takeSnapshot(sig);
  }
};

// ---------------------------------------------------------------------------
//  Avance del solver: `sweeps` iteraciones por frame, actualizando AMBAS
//  sucesiones y la telemetría de convergencia.
// ---------------------------------------------------------------------------
export const stepSimulation = (
  persons: Person[],
  doorOpen: boolean,
  sweeps: number,
) => {
  const { field, M } = buildFieldAndM(persons);
  const sig = scenarioSig(persons, doorOpen);

  for (let s = 0; s < sweeps; s++) advanceSweep(field, M, doorOpen, sig);

  computeMetrics();
  telemetry.M = M;
};

// ---------------------------------------------------------------------------
//  Navegación manual: restaura el último snapshot anterior a `targetIteration`
//  (mismo escenario) y completa con barridos hasta el objetivo. En el peor
//  caso (sin snapshot compatible) reconstruye desde el estado inicial, como
//  antes; en el habitual cuesta como máximo SNAP_EVERY iteraciones.
// ---------------------------------------------------------------------------
export const gotoIteration = (
  persons: Person[],
  doorOpen: boolean,
  targetIteration: number,
) => {
  const n = Math.max(0, Math.floor(targetIteration));
  const { field, M } = buildFieldAndM(persons);
  const sig = scenarioSig(persons, doorOpen);

  let restored = false;
  if (sig === snapSig && snapshots.length > 0) {
    for (let k = snapshots.length - 1; k >= 0; k--) {
      if (snapshots[k].iter <= n) {
        const snap = snapshots[k];
        solverState.sub.set(snap.sub);
        solverState.super.set(snap.sup);
        solverState.iteration = snap.iter;
        if (telemetry.history.length > snap.histLen)
          telemetry.history.length = snap.histLen;
        restored = true;
        break;
      }
    }
  }
  if (!restored) resetSolver();

  while (solverState.iteration < n) advanceSweep(field, M, doorOpen, sig);

  computeMetrics();
  telemetry.M = M;
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

// Tabla de color precalculada (256 niveles RGB) para el mapa de calor. Evita
// llamar a `colorMap` (que asigna arrays) por cada píxel y cada frame.
export const TURBO_LUT = (() => {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = colorMap(i / 255);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
})();

export const cssGradient = (): string => {
  const parts = TURBO_STOPS.map(
    ([t, r, g, b]) =>
      `rgb(${r},${g},${b}) ${(t * 100).toFixed(1)}%`,
  );
  return `linear-gradient(to right, ${parts.join(", ")})`;
};
