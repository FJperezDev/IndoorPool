import { useSimulationStore } from "../../store/useSimulationStore";
import { heaters, RADIATORS } from "../../math/subSuperSolver";

// Radiadores termostáticos sobre el muro opaco izquierdo (x ~= -11).
// La visibilidad y el brillo emisivo siguen a `heaters`; el componente se
// re-renderiza vía scenarioVersion (se incrementa en refresh()).
export const Radiators = () => {
  useSimulationStore((s) => s.scenarioVersion);
  if (!heaters.enabled) return null;

  return (
    <group>
      {RADIATORS.map((r, k) => (
        <mesh key={k} position={[-10.82, 0.95, r.z]} castShadow>
          <boxGeometry args={[0.14, 0.7, 1.0]} />
          <meshStandardMaterial
            color="#e9edf0"
            metalness={0.25}
            roughness={0.4}
            emissive="#ff8a3c"
            emissiveIntensity={0.55}
          />
        </mesh>
      ))}
    </group>
  );
};
