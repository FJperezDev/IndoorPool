import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulationStore } from "../store/useSimulationStore";
import {
  GRID_SIZE,
  solverState,
  stepSimulation,
  colorMap,
} from "../math/subSuperSolver";

const UPSCALE = 2;
const W = GRID_SIZE * UPSCALE;
const H = GRID_SIZE * UPSCALE;

// Muestreo bilineal de un campo escalar (índice fila-mayor i*N + j)
const sample = (view: Float32Array, fx: number, fy: number): number => {
  const x = Math.min(Math.max(fx, 0), GRID_SIZE - 1.0001);
  const y = Math.min(Math.max(fy, 0), GRID_SIZE - 1.0001);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, GRID_SIZE - 1);
  const y1 = Math.min(y0 + 1, GRID_SIZE - 1);
  const tx = x - x0;
  const ty = y - y0;
  const v00 = view[x0 * GRID_SIZE + y0];
  const v10 = view[x1 * GRID_SIZE + y0];
  const v01 = view[x0 * GRID_SIZE + y1];
  const v11 = view[x1 * GRID_SIZE + y1];
  const top = v00 * (1 - tx) + v10 * tx;
  const bot = v01 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bot * ty;
};

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
    const ctx = canvas.getContext("2d");
    imgData.current = ctx ? ctx.createImageData(W, H) : null;
  }, [canvas, texture]);

  useFrame(() => {
    if (running) stepSimulation(persons, isDoorOpen, sweepsPerFrame);

    const ctx = canvas.getContext("2d");
    if (!ctx || !imgData.current) return;

    const data = imgData.current.data;
    const { sub, super: sup } = solverState;

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const fx = px / UPSCALE;
        const fy = py / UPSCALE;
        const idx = (py * W + px) * 4;

        if (viewMode === "gap") {
          const g = Math.max(0, sample(sup, fx, fy) - sample(sub, fx, fy));
          data[idx] = 255;
          data[idx + 1] = Math.round(60 * (1 - g));
          data[idx + 2] = Math.round(60 * (1 - g));
          data[idx + 3] = Math.min(255, Math.round(g * 700));
        } else {
          const v =
            viewMode === "sub"
              ? sample(sub, fx, fy)
              : viewMode === "super"
                ? sample(sup, fx, fy)
                : (sample(sub, fx, fy) + sample(sup, fx, fy)) / 2;
          const [r, g, b] = colorMap(v);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 200;
        }
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
