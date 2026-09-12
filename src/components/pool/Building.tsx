import { useSimulationStore } from "../../store/useSimulationStore";
import { AutomaticDoor } from "./AutomaticDoor";
import { Radiators } from "./Radiators";

const BuildingShell = () => {
  const isTransparent = useSimulationStore((s) => s.buildingTransparent);

  const opacity = isTransparent ? 0.15 : 1;
  const transparent = isTransparent;
  const wallColor = "#f2f4f6";

  const shellMaterial = (
    <meshStandardMaterial
      color={wallColor}
      transparent={transparent}
      opacity={opacity}
      roughness={0.85}
      depthWrite={!transparent}
    />
  );

  return (
    <group>
      {/* Techo */}
      <mesh position={[0, 6.25, 0]} receiveShadow castShadow={!transparent}>
        <boxGeometry args={[23, 0.5, 23]} />
        {shellMaterial}
      </mesh>

      {/* Pared Frontal */}
      <mesh position={[0, 3, 11.25]} receiveShadow castShadow={!transparent}>
        <boxGeometry args={[23, 6, 0.5]} />
        {shellMaterial}
      </mesh>

      {/* Pared Lateral Izquierda */}
      <mesh position={[-11.25, 3, 0]} receiveShadow castShadow={!transparent}>
        <boxGeometry args={[0.5, 6, 23]} />
        {shellMaterial}
      </mesh>

      {/* Pared Lateral Derecha (partida para dejar un hueco exacto de 2 unidades) */}
      <mesh
        position={[11.25, 3, -6.25]}
        receiveShadow
        castShadow={!transparent}
      >
        <boxGeometry args={[0.5, 6, 10.5]} />
        {shellMaterial}
      </mesh>
      <mesh position={[11.25, 3, 6.25]} receiveShadow castShadow={!transparent}>
        <boxGeometry args={[0.5, 6, 10.5]} />
        {shellMaterial}
      </mesh>

      {/* Dintel sobre la puerta (bajado a Y=4.6 y alto 2.8 para sellar la parte de arriba) */}
      <mesh position={[11.25, 4.6, 0]} receiveShadow castShadow={!transparent}>
        <boxGeometry args={[0.5, 2.8, 2]} />
        {shellMaterial}
      </mesh>
    </group>
  );
};

export const Building = () => {
  return (
    <group>
      {/* ENVOLVENTE */}
      <BuildingShell />

      {/* Radiadores en el muro izquierdo */}
      <Radiators />

      {/* Puerta desplazada para encajar en el nuevo muro */}
      <group position={[0.25, 0, 0]}>
        <AutomaticDoor />
      </group>

      {/* ---------- CRISTALERA (pared trasera) ---------- */}
      <mesh position={[0, 3, -11]} receiveShadow>
        <boxGeometry args={[22, 6, 0.15]} />
        <meshStandardMaterial
          color="#aaddff"
          transparent
          opacity={0.28}
          metalness={0.9}
          roughness={0.05}
        />
      </mesh>
      {[-11, -5.5, 0, 5.5, 11].map((x) => (
        <mesh key={`frame-${x}`} position={[x, 3, -11]} castShadow>
          <boxGeometry args={[0.3, 6, 0.4]} />
          <meshStandardMaterial
            color="#2b2f34"
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      ))}
      <mesh position={[0, 3, -11]} castShadow>
        <boxGeometry args={[22, 0.15, 0.4]} />
        <meshStandardMaterial color="#2b2f34" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Zócalo azulejo izquierdo interior */}
      <mesh position={[-10.95, 0.8, 0]}>
        <boxGeometry args={[0.1, 1.6, 22.5]} />
        <meshStandardMaterial color="#9fb8c8" roughness={0.3} />
      </mesh>

      {/* ---------- VIGAS DEL TECHO Y LUMINARIAS ---------- */}
      {[-8, -4, 0, 4, 8].map((z) => (
        <mesh key={`beam-${z}`} position={[0, 6, z]} castShadow>
          <boxGeometry args={[22.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color="#c0c6cc"
            metalness={0.5}
            roughness={0.4}
          />
        </mesh>
      ))}
      {[-4, 0, 4].map((z) =>
        [-4, 0, 4].map((x) => (
          <mesh key={`light-${x}-${z}`} position={[x, 5.3, z]}>
            <boxGeometry args={[1.6, 0.1, 0.5]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fff7dd"
              emissiveIntensity={1.8}
            />
          </mesh>
        )),
      )}
    </group>
  );
};
