import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulationStore } from "../../store/useSimulationStore";

export const AutomaticDoor = () => {
  const persons = useSimulationStore((state) => state.persons);
  const leftDoor = useRef<THREE.Mesh>(null);
  const rightDoor = useRef<THREE.Mesh>(null);
  const sensor = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!leftDoor.current || !rightDoor.current) return;
    const someoneIsNear = persons.some((p) => p.x > 8.5 && Math.abs(p.z) < 2);

    const targetLeftZ = someoneIsNear ? -1.5 : -0.5;
    const targetRightZ = someoneIsNear ? 1.5 : 0.5;

    leftDoor.current.position.z = THREE.MathUtils.lerp(
      leftDoor.current.position.z,
      targetLeftZ,
      0.08,
    );
    rightDoor.current.position.z = THREE.MathUtils.lerp(
      rightDoor.current.position.z,
      targetRightZ,
      0.08,
    );

    if (sensor.current) {
      const m = sensor.current.material as THREE.MeshStandardMaterial;
      m.emissive.setHex(someoneIsNear ? 0x22ff88 : 0x331111);
      m.emissiveIntensity = someoneIsNear ? 1.4 : 0.6;
    }
  });

  return (
    <group position={[11, 0, 0]}>
      {/* dintel superior (ajustado de 3.6 a 2.4 de ancho para no clipear con los nuevos muros) */}
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[0.7, 0.25, 2.4]} />
        <meshStandardMaterial color="#2b2f34" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* hoja izquierda */}
      <mesh ref={leftDoor} position={[0, 1.55, -0.5]} castShadow>
        <boxGeometry args={[0.12, 3.1, 1.05]} />
        <meshStandardMaterial
          color="#8fc7ff"
          transparent
          opacity={0.35}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* hoja derecha */}
      <mesh ref={rightDoor} position={[0, 1.55, 0.5]} castShadow>
        <boxGeometry args={[0.12, 3.1, 1.05]} />
        <meshStandardMaterial
          color="#8fc7ff"
          transparent
          opacity={0.35}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* sensor luminoso */}
      <mesh ref={sensor} position={[0, 2.7, 0]}>
        <boxGeometry args={[0.06, 0.12, 0.12]} />
        <meshStandardMaterial
          color="#110000"
          emissive="#331111"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* felpudo exterior */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.6, 0.02, 0]}>
        <planeGeometry args={[1.6, 3]} />
        <meshStandardMaterial color="#3a4a52" roughness={1} />
      </mesh>
    </group>
  );
};
