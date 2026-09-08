import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { waterTex } from "./textures";

export const Water = () => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state, delta) => {
    waterTex.offset.y += delta * 0.02;
    waterTex.offset.x += delta * 0.006;
    if (matRef.current) {
      matRef.current.opacity =
        0.55 + Math.sin(state.clock.getElapsedTime() * 1.5) * 0.05;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
      <planeGeometry args={[12, 16]} />
      <meshStandardMaterial
        ref={matRef}
        map={waterTex}
        color="#7fd2ff"
        transparent
        opacity={0.55}
        roughness={0.08}
        metalness={0.35}
        depthWrite={false}
      />
    </mesh>
  );
};
