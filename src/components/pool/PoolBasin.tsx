import { floorTex, deckTex } from "./textures";

export const PoolBasin = () => {
  const POOL_X = 6;
  const POOL_Z = 8;
  const DEPTH = 1.2;
  const laneXs = [-4, -2, 0, 2, 4];
  const blockXs = [-4, -2, 0, 2, 4];

  return (
    <group>
      {/* ---------- SUELO DE LA SALA ---------- */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -10.5]}
        receiveShadow
      >
        <planeGeometry args={[26, 5]} />
        <meshStandardMaterial map={floorTex} roughness={0.9} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 10.5]}
        receiveShadow
      >
        <planeGeometry args={[26, 5]} />
        <meshStandardMaterial map={floorTex} roughness={0.9} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-9.5, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[7, 16]} />
        <meshStandardMaterial map={floorTex} roughness={0.9} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[9.5, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[7, 16]} />
        <meshStandardMaterial map={floorTex} roughness={0.9} />
      </mesh>

      {/* ---------- BORDILLO ---------- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -8.7]}>
        <planeGeometry args={[13.4, 1.4]} />
        <meshStandardMaterial map={deckTex} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 8.7]}>
        <planeGeometry args={[13.4, 1.4]} />
        <meshStandardMaterial map={deckTex} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6.7, 0.02, 0]}>
        <planeGeometry args={[1.4, 17.4]} />
        <meshStandardMaterial map={deckTex} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.7, 0.02, 0]}>
        <planeGeometry args={[1.4, 17.4]} />
        <meshStandardMaterial map={deckTex} roughness={0.6} />
      </mesh>

      {/* ---------- VASO DE LA PISCINA ---------- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -DEPTH, 0]}>
        <planeGeometry args={[2 * POOL_X, 2 * POOL_Z]} />
        <meshStandardMaterial color="#1d6fa8" roughness={0.2} metalness={0.2} />
      </mesh>
      <mesh position={[0, -DEPTH / 2, -POOL_Z]}>
        <boxGeometry args={[2 * POOL_X, DEPTH, 0.25]} />
        <meshStandardMaterial
          color="#2b7fb8"
          roughness={0.25}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, -DEPTH / 2, POOL_Z]}>
        <boxGeometry args={[2 * POOL_X, DEPTH, 0.25]} />
        <meshStandardMaterial
          color="#2b7fb8"
          roughness={0.25}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[-POOL_X, -DEPTH / 2, 0]}>
        <boxGeometry args={[0.25, DEPTH, 2 * POOL_Z]} />
        <meshStandardMaterial
          color="#2b7fb8"
          roughness={0.25}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[POOL_X, -DEPTH / 2, 0]}>
        <boxGeometry args={[0.25, DEPTH, 2 * POOL_Z]} />
        <meshStandardMaterial
          color="#2b7fb8"
          roughness={0.25}
          metalness={0.2}
        />
      </mesh>

      {/* ---------- CORONACIÓN (bordillo) del vaso ---------- */}
      <mesh position={[0, 0.05, -POOL_Z]}>
        <boxGeometry args={[2 * POOL_X + 0.3, 0.1, 0.3]} />
        <meshStandardMaterial color="#eef3f6" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, POOL_Z]}>
        <boxGeometry args={[2 * POOL_X + 0.3, 0.1, 0.3]} />
        <meshStandardMaterial color="#eef3f6" roughness={0.3} />
      </mesh>
      <mesh position={[-POOL_X, 0.05, 0]}>
        <boxGeometry args={[0.3, 0.1, 2 * POOL_Z + 0.3]} />
        <meshStandardMaterial color="#eef3f6" roughness={0.3} />
      </mesh>
      <mesh position={[POOL_X, 0.05, 0]}>
        <boxGeometry args={[0.3, 0.1, 2 * POOL_Z + 0.3]} />
        <meshStandardMaterial color="#eef3f6" roughness={0.3} />
      </mesh>

      {/* ---------- LÍNEAS DE CALLE ---------- */}
      {laneXs.map((x) => (
        <mesh
          key={`lane-${x}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, -DEPTH + 0.03, 0]}
        >
          <planeGeometry args={[0.25, 15.5]} />
          <meshStandardMaterial color="#0b3a5c" roughness={0.3} />
        </mesh>
      ))}

      {/* ---------- CORCHERAS ---------- */}
      {laneXs.map((x) => (
        <group key={`buoys-${x}`}>
          {Array.from({ length: 15 }, (_, i) => {
            const z = -7 + i;
            const color = i % 2 === 0 ? "#e5484d" : "#f4f6f8";
            return (
              <mesh key={i} position={[x, 0.02, z]}>
                <sphereGeometry args={[0.09, 10, 8]} />
                <meshStandardMaterial color={color} roughness={0.4} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* ---------- POYETES DE SALIDA ---------- */}
      {blockXs.map((x) => (
        <group key={`block-${x}`} position={[x, 0, -POOL_Z - 0.35]}>
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[0.7, 0.14, 0.7]} />
            <meshStandardMaterial color="#ffffff" roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.16, 0]} castShadow>
            <boxGeometry args={[0.6, 0.32, 0.6]} />
            <meshStandardMaterial color="#d9e2e8" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
