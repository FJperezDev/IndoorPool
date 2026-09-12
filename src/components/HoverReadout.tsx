import { useSimulationStore } from "../store/useSimulationStore";
import { toCelsius } from "../math/subSuperSolver";

// Tooltip que sigue al cursor sobre el suelo y muestra la temperatura (y el
// valor normalizado u) de la celda apuntada. Se alimenta de `hoverInfo`, que
// publica HeatMap en cada pointermove.
export const HoverReadout = () => {
  const hover = useSimulationStore((s) => s.hoverInfo);
  if (!hover) return null;

  // Mantener el tooltip dentro de la ventana
  const left = Math.min(hover.clientX + 14, window.innerWidth - 200);
  const top = Math.min(hover.clientY + 14, window.innerHeight - 60);

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 30,
        pointerEvents: "none",
        padding: "6px 10px",
        borderRadius: 6,
        background: "rgba(16,18,22,0.92)",
        color: "white",
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.35,
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ fontWeight: 700 }}>{hover.tempC.toFixed(1)} °C</div>
      <div style={{ opacity: 0.7, fontSize: 10.5 }}>
        u = {hover.u.toFixed(3)} · ({hover.x.toFixed(1)}, {hover.z.toFixed(1)}) m
      </div>
      <div style={{ opacity: 0.45, fontSize: 9.5 }}>
        rango {toCelsius(0).toFixed(0)}–{toCelsius(1).toFixed(0)} °C
      </div>
    </div>
  );
};
