export const Ladder = ({
  x,
  z,
  dir,
}: {
  x: number;
  z: number;
  dir: 1 | -1;
}) => {
  const railColor = "#c7cdd4";
  return (
    <group position={[x, 0, z]}>
      {/* barandillas verticales */}
      {[-0.35, 0.35].map((off) => (
        <mesh key={off} position={[dir * 0.15, 0.4, off]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 1.6, 8]} />
          <meshStandardMaterial
            color={railColor}
            metalness={0.9}
            roughness={0.25}
          />
        </mesh>
      ))}
      {/* peldaños */}
      {[0.05, -0.3, -0.65].map((y) => (
        <mesh
          key={y}
          position={[dir * 0.15, y + 0.25, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
          <meshStandardMaterial
            color={railColor}
            metalness={0.9}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
};
