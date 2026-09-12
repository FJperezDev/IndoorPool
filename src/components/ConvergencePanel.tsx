import { useEffect, useRef } from "react";
import { useSimulationStore } from "../store/useSimulationStore";
import { telemetry, toCelsius, cssGradient } from "../math/subSuperSolver";

const VIEW_LABELS: Record<string, string> = {
  sub: "Sub-solución (u)",
  super: "Super-solución (ū)",
  gap: "Envolvente (ū − u)",
  solution: "Solución (u*)",
};

const formatGap = (g: number) => {
  if (g <= 0) return "0";
  const exp = Math.floor(Math.log10(g));
  const mant = g / Math.pow(10, exp);
  return `${mant.toFixed(2)} × 10${exp}`.replace("10", "10^");
};

export const ConvergencePanel = () => {
  const persons = useSimulationStore((s) => s.persons);
  const maxCapacity = useSimulationStore((s) => s.maxCapacity);
  const isDoorOpen = useSimulationStore((s) => s.isDoorOpen);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const running = useSimulationStore((s) => s.running);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastIteration = -1;

    const draw = () => {
      // El canvas sólo repinta cuando la iteración cambia (p.ej. en pausa no
      // se redibuja a 60 fps en vano).
      if (telemetry.iteration === lastIteration) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastIteration = telemetry.iteration;

      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = cssW;
      const H = cssH;
      const padL = 46;
      const padR = 10;
      const padT = 12;
      const padB = 22;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(20,20,28,0.85)";
      ctx.fillRect(0, 0, W, H);

      const hist = telemetry.history;
      const yMin = -12;
      const yMax = 0;
      const xMax = Math.max(1, telemetry.iteration);

      const X = (iter: number) =>
        padL + ((W - padL - padR) * iter) / xMax;
      const Y = (log10: number) =>
        padT + ((H - padT - padB) * (yMax - log10)) / (yMax - yMin);

      // Rejilla y eje vertical (log)
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let e = 0; e >= yMin; e -= 2) {
        const y = Y(e);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        ctx.fillText(`1e${e}`, padL - 6, y);
      }

      // Eje horizontal
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("0", X(0), H - padB + 6);
      ctx.fillText(`${xMax}`, X(xMax), H - padB + 6);

      // Curva del gap (escala logarítmica)
      if (hist.length > 1) {
        ctx.strokeStyle = "#ff7b4a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < hist.length; k++) {
          const lg = Math.max(yMin, Math.log10(Math.max(hist[k].gap, 1e-12)));
          const x = X(hist[k].iter);
          const y = Y(lg);
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Cabecera con valores en vivo (evita re-renders de React)
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`‖ū − u‖∞ = ${formatGap(telemetry.maxGap)}`, 12, 6);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "11px monospace";
      ctx.fillText(`iteración ${telemetry.iteration}`, 12, 22);
      ctx.fillText(`M = ${telemetry.M.toFixed(2)}`, 12, 38);
      // Cotas leídas del telemetry en el propio bucle rAF: se mantienen vivas
      // al navegar por iteraciones en pausa (sin re-renders de React).
      ctx.fillText(
        `cotas ${toCelsius(telemetry.supSub).toFixed(1)} – ${toCelsius(
          telemetry.infSuper,
        ).toFixed(1)} °C`,
        12,
        54,
      );
      if (telemetry.maxGap < 1e-6) {
        ctx.fillStyle = "#7ad48f";
        ctx.fillText("convergido: u ≤ u* ≤ ū certificado", 12, 70);
      } else if (telemetry.gapViolation) {
        ctx.fillStyle = "#ff5a5a";
        ctx.fillText("! encajonamiento roto (reinicia)", 12, 70);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        zIndex: 20,
        width: 340,
        padding: "12px 14px",
        background: "rgba(20,20,28,0.85)",
        color: "white",
        fontFamily: "sans-serif",
        borderRadius: 8,
        backdropFilter: "blur(4px)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 8,
          letterSpacing: 0.3,
        }}
      >
        Convergencia Sub/Super-soluciones
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "3px 10px",
          fontSize: 11,
          marginBottom: 10,
          color: "rgba(255,255,255,0.85)",
        }}
      >
        <span style={{ opacity: 0.6 }}>Vista</span>
        <span>{VIEW_LABELS[viewMode]}</span>
        <span style={{ opacity: 0.6 }}>Aforo</span>
        <span>
          {persons.length} / {maxCapacity} personas
        </span>
        <span style={{ opacity: 0.6 }}>Puerta</span>
        <span style={{ color: isDoorOpen ? "#ff8a6a" : "#7ad48f" }}>
          {isDoorOpen ? "abierta (Dirichlet)" : "cerrada (Robin, cristal)"}
        </span>
        <span style={{ opacity: 0.6 }}>Estado</span>
        <span style={{ color: running ? "#7ad48f" : "#ff8a6a" }}>
          {running ? "reproduciendo" : "pausado (navegar)"}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: 140, display: "block", borderRadius: 4 }}
      />

      {viewMode !== "gap" && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              width: "100%",
              height: 12,
              borderRadius: 3,
              background: cssGradient(),
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "rgba(255,255,255,0.7)",
              marginTop: 3,
            }}
          >
            <span>10 °C</span>
            <span>23.5 °C</span>
            <span>37 °C</span>
          </div>
        </div>
      )}
    </div>
  );
};
