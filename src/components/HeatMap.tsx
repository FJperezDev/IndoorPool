import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulationStore } from "../store/useSimulationStore";
import {
  GRID_SIZE,
  HALF_ROOM,
  buildPersonField,
  solverState,
  stepSimulation,
  toCelsius,
  TURBO_LUT,
} from "../math/subSuperSolver";

// El canvas se dibuja a la resolución nativa de la malla (GRID_SIZE × GRID_SIZE)
// y el upscaling lo hace la GPU mediante LinearFilter. Esto evita el muestreo
// bilineal en JS (128×128 con 4 accesos por píxel) y reduce el trabajo por
// frame ~4×, con un resultado visual equivalente.
const W = GRID_SIZE;
const H = GRID_SIZE;

const ALPHA_VIEW = 200;
const GAP_ALPHA_SCALE = 700;
const SRC_ALPHA_SCALE = 230;

// Scratch para la vista "Fuentes q(x)" (potencia instantánea por celda)
const qScratch = new Float64Array(GRID_SIZE * GRID_SIZE);

export const HeatMap = () => {
  const persons = useSimulationStore((s) => s.persons);
  const isDoorOpen = useSimulationStore((s) => s.isDoorOpen);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const sweepsPerFrame = useSimulationStore((s) => s.sweepsPerFrame);
  const running = useSimulationStore((s) => s.running);
  const setHoverInfo = useSimulationStore((s) => s.setHoverInfo);

  const canvas = useMemo(() => document.createElement("canvas"), []);
  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);
  const imgData = useRef<ImageData | null>(null);

  useEffect(() => {
    canvas.width = W;
    canvas.height = H;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const ctx = canvas.getContext("2d");
    imgData.current = ctx ? ctx.createImageData(W, H) : null;
  }, [canvas, texture]);

  useFrame(() => {
    if (running) stepSimulation(persons, isDoorOpen, sweepsPerFrame);

    const ctx = canvas.getContext("2d");
    if (!ctx || !imgData.current) return;

    const data = imgData.current.data;
    const { sub, super: sup } = solverState;
    const N = GRID_SIZE;

    // Mapeo malla -> imagen: el solver indexa idx = i*N + j con i ↔ X mundo y
    // j ↔ Z mundo; un ImageData indexa py*N + px con px ↔ X e py ↔ Z (v=1 en
    // la fila superior del canvas, que tras rotation -PI/2 corresponde a
    // Z minimo = cristalera). Por tanto: o = (j*N + i) * 4, valor = grid[i*N+j].
    if (viewMode === "sources") {
      // q(x) = Σκᵢ(u_{p,i}−u)⁺ + Σρⱼ(u_{r,j}−u)⁺ evaluado en la solución
      // actual (u ≈ (u_k + ū_k)/2): focos térmicos activos que se "apagan"
      // al converger al equilibrio.
      const fld = buildPersonField(persons);
      let qMax = 1e-12;
      for (let k = 0; k < N * N; k++) {
        const u = (sub[k] + sup[k]) / 2;
        const hp = fld.source[k] - fld.weight[k] * u;
        const hr = fld.sourceR[k] - fld.weightR[k] * u;
        const q = (hp > 0 ? hp : 0) + (hr > 0 ? hr : 0);
        qScratch[k] = q;
        if (q > qMax) qMax = q;
      }
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const qn = qScratch[i * N + j] / qMax;
          const o = (j * N + i) * 4;
          data[o] = 255;
          data[o + 1] = Math.round(90 * (1 - qn));
          data[o + 2] = Math.round(40 * (1 - qn));
          data[o + 3] = Math.round(SRC_ALPHA_SCALE * Math.min(1, qn * 3));
        }
      }
    } else if (viewMode === "gap") {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const k = i * N + j;
          const g = sup[k] > sub[k] ? sup[k] - sub[k] : 0;
          const o = (j * N + i) * 4;
          data[o] = 255;
          data[o + 1] = Math.round(60 * (1 - g));
          data[o + 2] = Math.round(60 * (1 - g));
          data[o + 3] = Math.min(255, Math.round(g * GAP_ALPHA_SCALE));
        }
      }
    } else {
      const field =
        viewMode === "sub" ? sub : viewMode === "super" ? sup : null;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const k = i * N + j;
          const v = field ? field[k] : (sub[k] + sup[k]) / 2;
          const c = Math.max(0, Math.min(255, (v * 255) | 0));
          const o = (j * N + i) * 4;
          data[o] = TURBO_LUT[c * 3];
          data[o + 1] = TURBO_LUT[c * 3 + 1];
          data[o + 2] = TURBO_LUT[c * 3 + 2];
          data[o + 3] = ALPHA_VIEW;
        }
      }
    }

    ctx.putImageData(imgData.current, 0, 0);
    texture.needsUpdate = true;
  });

  // Hover: convierte el punto de impacto sobre el suelo en (i, j) de la malla
  // y publica la temperatura de la celda para el tooltip.
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const { sub, super: sup } = solverState;
    const N = GRID_SIZE;
    const toGrid = (v: number) =>
      Math.max(0, Math.min(N - 1, Math.round(((v + HALF_ROOM) / (2 * HALF_ROOM)) * (N - 1))));
    const i = toGrid(e.point.x);
    const j = toGrid(e.point.z);
    const k = i * N + j;
    const u =
      viewMode === "sub" ? sub[k] : viewMode === "super" ? sup[k] : (sub[k] + sup[k]) / 2;
    setHoverInfo({
      u,
      tempC: toCelsius(u),
      x: e.point.x,
      z: e.point.z,
      clientX: e.nativeEvent.clientX,
      clientY: e.nativeEvent.clientY,
    });
  };

  const handlePointerOut = () => setHoverInfo(null);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.045, 0]}
      renderOrder={10}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <planeGeometry args={[2 * HALF_ROOM, 2 * HALF_ROOM]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
};
