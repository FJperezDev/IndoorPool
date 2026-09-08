import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulationStore } from "../store/useSimulationStore";
import {
  GRID_SIZE,
  solverState,
  stepSimulation,
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

export const HeatMap = () => {
  const persons = useSimulationStore((s) => s.persons);
  const isDoorOpen = useSimulationStore((s) => s.isDoorOpen);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const sweepsPerFrame = useSimulationStore((s) => s.sweepsPerFrame);
  const running = useSimulationStore((s) => s.running);

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
    const size = GRID_SIZE * GRID_SIZE;

    if (viewMode === "gap") {
      for (let k = 0; k < size; k++) {
        const g = sup[k] > sub[k] ? sup[k] - sub[k] : 0;
        const o = k * 4;
        data[o] = 255;
        data[o + 1] = Math.round(60 * (1 - g));
        data[o + 2] = Math.round(60 * (1 - g));
        data[o + 3] = Math.min(255, Math.round(g * GAP_ALPHA_SCALE));
      }
    } else {
      const field =
        viewMode === "sub" ? sub : viewMode === "super" ? sup : null;
      for (let k = 0; k < size; k++) {
        const v = field ? field[k] : (sub[k] + sup[k]) / 2;
        const c = Math.max(0, Math.min(255, (v * 255) | 0));
        const o = k * 4;
        data[o] = TURBO_LUT[c * 3];
        data[o + 1] = TURBO_LUT[c * 3 + 1];
        data[o + 2] = TURBO_LUT[c * 3 + 2];
        data[o + 3] = ALPHA_VIEW;
      }
    }

    ctx.putImageData(imgData.current, 0, 0);
    texture.needsUpdate = true;
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.045, 0]}
      renderOrder={10}
    >
      <planeGeometry args={[20, 20]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
};
