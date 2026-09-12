import { Canvas } from "@react-three/fiber";
import { useControls, button, Leva } from "leva";
import { useEffect } from "react";
import {
  useSimulationStore,
  ViewMode,
  DoorMode,
} from "./store/useSimulationStore";
import { params, setParams, heaters, setHeaters } from "./math/subSuperSolver";
import { Scene } from "./components/Scene";
import { ConvergencePanel } from "./components/ConvergencePanel";
import { HoverReadout } from "./components/HoverReadout";

export default function App() {
  // Modo demo (p. ej. pool.franjpg.com/?demo): puerta abierta, personas
  // entrando y panel Leva oculto para capturas limpias.
  const isDemo = window.location.search.includes("demo");
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
    stepBy,
    refresh,
  } = useSimulationStore();

  useControls("Simulación", {
    "Entrar (1 persona)": button(() => addPerson()),
    "Salir (1 persona)": button(() => removePerson()),
    [`Aforo completo (${maxCapacity})`]: button(() => fillCapacity()),
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
        "Fuentes q(x)": "sources",
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
    "α puerta (cristal)": {
      value: params.alphaDoor,
      min: 0,
      max: 120,
      step: 1,
      onChange: (v) => {
        setParams({ alphaDoor: v });
        refresh();
      },
    },
    "T exterior (°C)": {
      value: params.T_ext,
      min: -10,
      max: 40,
      step: 0.5,
      onChange: (v) => {
        setParams({ T_ext: v });
        refresh();
      },
    },
  });

  useControls("Calefacción", {
    Radiadores: {
      value: heaters.enabled,
      onChange: (v) => {
        setHeaters({ enabled: v });
        refresh();
      },
    },
    "T consigna (°C)": {
      value: heaters.tempC,
      min: 15,
      max: 40,
      step: 0.5,
      onChange: (v) => {
        setHeaters({ tempC: v });
        refresh();
      },
    },
    "ρ (potencia)": {
      value: heaters.power,
      min: 0,
      max: 30,
      step: 1,
      onChange: (v) => {
        setHeaters({ power: v });
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
  useControls("Método (Sub/Super)", () => {
    return {
      Reproducción: {
        value: running,
        onChange: (v) => setRunning(v),
      },
      // Añadimos el render a los botones para que se oculten en reproducción
      "−1000": button(() => stepBy(-1000)),
      "−100": button(() => stepBy(-100)),
      "−10": button(() => stepBy(-10)),
      "+10": button(() => stepBy(10)),
      "+100": button(() => stepBy(100)),
      "+1000": button(() => stepBy(1000)),
    };
  });

  useEffect(() => {
    if (isDemo) {
      setTimeout(() => setDoorMode("open"), 100);
      setTimeout(() => addPerson(), 300);
      setTimeout(() => addPerson(), 1200);
      setTimeout(() => addPerson(), 2100);
    }
  }, [addPerson, setDoorMode, isDemo]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (running) updatePositions();
    }, 100);
    return () => clearInterval(interval);
  }, [updatePositions, running]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#101216" }}>
      {!isDemo && <Leva theme={{ sizes: { rootWidth: "360px" } }} />}
      {isDemo && (
        <style>{`#leva__root{display:none!important}`}</style>
      )}

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
          Climatización de una piscina cubierta · −Δu = λu(1−u) + Σ κᵢ(x)(uₚ,ᵢ−u) + Σ ρⱼ(x)(uᵣ,ⱼ−u)⁺
        </p>
      </header>

      <ConvergencePanel />
      <HoverReadout />

      <Canvas camera={{ position: [0, 15, 20], fov: 50 }} shadows>
        <Scene />
      </Canvas>
    </div>
  );
}
