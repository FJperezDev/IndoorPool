import { Canvas } from "@react-three/fiber";
import { useControls, button, Leva } from "leva"; // <-- 1. Importa Leva
import { useEffect, useState } from "react";
import {
  useSimulationStore,
  ViewMode,
  DoorMode,
} from "./store/useSimulationStore";
import { params, setParams, solverState } from "./math/subSuperSolver";
import { Scene } from "./components/Scene";
import { ConvergencePanel } from "./components/ConvergencePanel";

export default function App() {
  const {
    addPerson,
    removePerson,
    fillCapacity,
    clearPersons,
    resetSimulation,
    updatePositions,
    persons,
    maxCapacity,
    viewMode,
    sweepsPerFrame,
    setViewMode,
    setSweepsPerFrame,
    buildingTransparent,
    setBuildingTransparent,
    doorMode,
    setDoorMode,
    running,
    setRunning,
    targetIteration,
    setTargetIteration,
    stepBy,
    refresh,
  } = useSimulationStore();

  const [maxIter, setMaxIter] = useState(5000);

  useEffect(() => {
    if (!running) {
      setMaxIter(Math.max(1, solverState.iteration));
    }
  }, [running]);

  useControls("Simulación", {
    "Entrar (1 persona)": button(() => addPerson()),
    "Salir (1 persona)": button(() => removePerson()),
    "Aforo completo (50)": button(() => fillCapacity()),
    Vaciar: button(() => clearPersons()),
    Reiniciar: button(() => resetSimulation()),
    Aforo: { value: `${persons.length} / ${maxCapacity}`, editable: false },
  });

  useControls("Visualización", {
    Vista: {
      value: viewMode,
      options: {
        "Solución (u*)": "solution",
        "Sub-solución (u)": "sub",
        "Super-solución (ū)": "super",
        "Envolvente (ū − u)": "gap",
      },
      onChange: (v) => setViewMode(v as ViewMode),
    },
    "Iteraciones / frame": {
      value: sweepsPerFrame,
      min: 1,
      max: 40,
      step: 1,
      onChange: (v) => setSweepsPerFrame(v),
    },
  });

  useControls("Parámetros", {
    "λ (reacción)": {
      value: params.lambda,
      min: 0,
      max: 20,
      step: 0.5,
      onChange: (v) => {
        setParams({ lambda: v });
        refresh();
      },
    },
    "κ (corporal)": {
      value: params.kappa,
      min: 0,
      max: 10,
      step: 0.5,
      onChange: (v) => {
        setParams({ kappa: v });
        refresh();
      },
    },
    "α (convección)": {
      value: params.alpha,
      min: 0,
      max: 120,
      step: 1,
      onChange: (v) => {
        setParams({ alpha: v });
        refresh();
      },
    },
    "T exterior (°C)": {
      value: params.T_ext,
      min: 10,
      max: 37,
      step: 0.5,
      onChange: (v) => {
        setParams({ T_ext: v });
        refresh();
      },
    },
  });

  useControls("Puerta", {
    Modo: {
      value: doorMode,
      options: {
        Automática: "auto",
        Abierta: "open",
        Cerrada: "closed",
      },
      onChange: (v) => setDoorMode(v as DoorMode),
    },
  });

  useControls("Edificio", {
    "Fachada Transparente": {
      value: buildingTransparent,
      onChange: (v) => setBuildingTransparent(v),
    },
  });

  // Control de navegación por iteraciones del método de sub y super-soluciones.
  // Al pausar, se puede "fregar" (scrub) hasta la iteración deseada: la función
  // devuelta `setMethod` permite sincronizar el slider con la iteración en vivo.
  const [, setMethod] = useControls(
    "Método (Sub/Super)",
    () => ({
      Reproducción: {
        value: running,
        onChange: (v) => setRunning(v),
      },
      Iteración: {
        value: targetIteration,
        min: 0,
        max: maxIter, // <--- Usamos el estado dinámico
        step: 1,
        transient: true,
        onChange: (v) => setTargetIteration(v),
      },
      "−10": button(() => stepBy(-10)),
      "−1": button(() => stepBy(-1)),
      "+1": button(() => stepBy(1)),
      "+10": button(() => stepBy(10)),
    }),
    [maxIter], // <--- Añadimos la dependencia para actualizar el esquema
  );

  // Sincroniza el slider con la iteración en vivo (mientras se reproduce) o con
  // la iteración objetivo (mientras está pausado).
  useEffect(() => {
    if (running) return;
    setMethod({ Iteración: targetIteration });
  }, [targetIteration, running, setMethod]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setMethod({ Iteración: solverState.iteration });
    }, 200);
    return () => clearInterval(id);
  }, [running, setMethod]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (running) updatePositions();
    }, 100);
    return () => clearInterval(interval);
  }, [updatePositions, running]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#101216" }}>
      {/* 2. Añade este componente para forzar el ancho (ej. 350px o 400px) */}
      <Leva theme={{ sizes: { rootWidth: "360px" } }} />

      <header
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 10,
          color: "white",
          fontFamily: "sans-serif",
          pointerEvents: "none",
          background: "rgba(20,20,28,0.7)",
          padding: "10px 16px",
          borderRadius: 8,
          backdropFilter: "blur(4px)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
          Simulador TFG · Método de Sub y Super-Soluciones
        </h1>
        <p style={{ margin: "2px 0 0", opacity: 0.8, fontSize: 12 }}>
          Climatización de una piscina cubierta · −Δu = λu(1−u) + Σ κᵢ(uₚ,ᵢ−u)
        </p>
      </header>

      <ConvergencePanel />

      <Canvas camera={{ position: [0, 15, 20], fov: 50 }} shadows>
        <Scene />
      </Canvas>
    </div>
  );
}
