import { Canvas } from "@react-three/fiber";
import { useControls, button, Leva } from "leva"; // <-- 1. Importa Leva
import { useEffect } from "react";
import {
  useSimulationStore,
  ViewMode,
  DoorMode,
} from "./store/useSimulationStore";
import { params, setParams } from "./math/subSuperSolver";
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
  } = useSimulationStore();

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
      onChange: (v) => setParams({ lambda: v }),
    },
    "κ (corporal)": {
      value: params.kappa,
      min: 0,
      max: 10,
      step: 0.5,
      onChange: (v) => setParams({ kappa: v }),
    },
    "α (convección)": {
      value: params.alpha,
      min: 0,
      max: 120,
      step: 1,
      onChange: (v) => setParams({ alpha: v }),
    },
    "T exterior (°C)": {
      value: params.T_ext,
      min: 10,
      max: 37,
      step: 0.5,
      onChange: (v) => setParams({ T_ext: v }),
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

  useEffect(() => {
    const interval = setInterval(() => updatePositions(), 100);
    return () => clearInterval(interval);
  }, [updatePositions]);

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
