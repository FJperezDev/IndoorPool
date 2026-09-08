import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Person, useSimulationStore } from "../store/useSimulationStore";

// --- Geometrías compartidas (creadas una única vez) ---
const HEAD_GEOM = new THREE.SphereGeometry(0.17, 24, 18);
const TORSO_GEOM = new THREE.CapsuleGeometry(0.14, 0.34, 6, 12);
const ARM_GEOM = new THREE.CapsuleGeometry(0.045, 0.42, 4, 10);
const LEG_GEOM = new THREE.CapsuleGeometry(0.055, 0.5, 4, 10);

const SUITS = [
  "#e74c3c",
  "#f39c12",
  "#27ae60",
  "#2980b9",
  "#8e44ad",
  "#16a085",
  "#d35400",
  "#2c3e50",
];
const SKIN = "#ffcc99";
const SKIN_SHADOW = "#e6ad80";

const POOL_X = 6;
const POOL_Z = 8;

const PersonModel = ({ person }: { person: Person }) => {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);

  // Acumulador de tiempo de marcha (para que los brazos no salten al parar)
  const walkTime = useRef(0);
  // Factor de nado 0 (fuera del agua) → 1 (nadando)
  const swim = useRef(0);

  const suit = SUITS[Math.abs(person.id) % SUITS.length];
  const exiting = person.status === "exiting";
  const headColor = exiting ? "#ff5f56" : SKIN;

  const inPool =
    person.x > -POOL_X && person.x < POOL_X && person.z > -POOL_Z && person.z < POOL_Z;

  useFrame((state, delta) => {
    const r = root.current;
    const b = body.current;
    if (!r || !b) return;
    const t = state.clock.getElapsedTime();

    // --- Movimiento horizontal suave ---
    const dx = person.x - r.position.x;
    const dz = person.z - r.position.z;
    const isMoving = Math.hypot(dx, dz) > 0.05;
    r.position.x = THREE.MathUtils.lerp(r.position.x, person.x, 0.12);
    r.position.z = THREE.MathUtils.lerp(r.position.z, person.z, 0.12);

    // --- Orientación (yaw) ---
    if (isMoving) {
      const dummy = new THREE.Object3D();
      dummy.position.set(r.position.x, 0, r.position.z);
      dummy.lookAt(person.x, 0, person.z);
      r.quaternion.slerp(dummy.quaternion, 0.15);
      walkTime.current += delta * 10;
    } else {
      walkTime.current = THREE.MathUtils.lerp(walkTime.current, 0, 0.1);
    }

    // --- Transición andar ⇄ nadar ---
    swim.current = THREE.MathUtils.lerp(
      swim.current,
      inPool ? 1 : 0,
      0.12,
    );
    const s = swim.current;
    const wt = walkTime.current;

    // --- Posición vertical: flotación + cabeceo ---
    const walkBob = isMoving && s < 0.5 ? Math.abs(Math.sin(wt)) * 0.05 : 0;
    const swimBob = Math.sin(t * 2.2) * 0.05;
    const y = -0.5 * s + (1 - s) * walkBob + s * swimBob;
    r.position.y = THREE.MathUtils.lerp(r.position.y, y, 0.2);

    // --- Inclinación del cuerpo: vertical → casi horizontal (cabeza ligeramente
    //     elevada, como en un crol natural, sin ir completamente de frente) ---
    b.rotation.x = THREE.MathUtils.lerp(-0.06, -1.3, s);
    // Balanceo lateral muy sutil (respiración), apenas perceptible
    b.rotation.z = THREE.MathUtils.lerp(b.rotation.z, s * Math.sin(t * 2.2) * 0.05, 0.1);

    // --- Brazos: andar → zambullida → crol (molinete completo) ---
    const stroke = t * 4;
    const walkL = Math.sin(wt) * 0.55;
    const walkR = Math.sin(wt + Math.PI) * 0.55;
    const dive = -2.6; // brazos extendidos sobre la cabeza (entrada al agua)
    const windL = -stroke; // molinete continuo de crol
    const windR = -stroke - Math.PI;

    let armTL: number;
    let armTR: number;
    if (s < 0.5) {
      const f = s * 2;
      armTL = THREE.MathUtils.lerp(walkL, dive, f);
      armTR = THREE.MathUtils.lerp(walkR, dive, f);
    } else {
      const f = s * 2 - 1;
      armTL = THREE.MathUtils.lerp(dive, windL, f);
      armTR = THREE.MathUtils.lerp(dive, windR, f);
    }
    if (armL.current)
      armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, armTL, 0.3);
    if (armR.current)
      armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, armTR, 0.3);
    if (armL.current)
      armL.current.rotation.z = THREE.MathUtils.lerp(armL.current.rotation.z, 0, 0.15);
    if (armR.current)
      armR.current.rotation.z = THREE.MathUtils.lerp(armR.current.rotation.z, 0, 0.15);

    // --- Piernas: andar → juntas → aleteo de crol ---
    if (s < 0.5) {
      const d = s * 2;
      const aL = THREE.MathUtils.lerp(Math.sin(wt + Math.PI) * 0.5, 0.12, d);
      const aR = THREE.MathUtils.lerp(Math.sin(wt) * 0.5, -0.12, d);
      if (legL.current)
        legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, aL, 0.25);
      if (legR.current)
        legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, aR, 0.25);
    } else {
      const kick = t * 9;
      const aL = Math.sin(kick) * 0.3;
      const aR = Math.sin(kick + Math.PI) * 0.3;
      if (legL.current)
        legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, aL, 0.4);
      if (legR.current)
        legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, aR, 0.4);
    }
  });

  return (
    <group ref={root} position={[person.x, 0, person.z]}>
      <group ref={body}>
        {/* Torso (bañador) */}
        <mesh geometry={TORSO_GEOM} position={[0, 1.05, 0]} castShadow>
          <meshStandardMaterial color={suit} roughness={0.45} metalness={0.05} />
        </mesh>

        {/* Cabeza + gorro de baño */}
        <group position={[0, 1.5, 0]}>
          <mesh geometry={HEAD_GEOM} castShadow>
            <meshStandardMaterial color={headColor} roughness={0.35} />
          </mesh>
          <mesh
            geometry={HEAD_GEOM}
            scale={[1.13, 0.55, 1.13]}
            position={[0, 0.1, 0]}
          >
            <meshStandardMaterial
              color={exiting ? "#ff5f56" : suit}
              roughness={0.25}
              metalness={0.1}
            />
          </mesh>
        </group>

        {/* Brazo izquierdo */}
        <group ref={armL} position={[-0.22, 1.32, 0]}>
          <mesh geometry={ARM_GEOM} position={[0, -0.26, 0]} castShadow>
            <meshStandardMaterial color={SKIN_SHADOW} roughness={0.4} />
          </mesh>
        </group>

        {/* Brazo derecho */}
        <group ref={armR} position={[0.22, 1.32, 0]}>
          <mesh geometry={ARM_GEOM} position={[0, -0.26, 0]} castShadow>
            <meshStandardMaterial color={SKIN_SHADOW} roughness={0.4} />
          </mesh>
        </group>

        {/* Pierna izquierda */}
        <group ref={legL} position={[-0.09, 0.65, 0]}>
          <mesh geometry={LEG_GEOM} position={[0, -0.31, 0]} castShadow>
            <meshStandardMaterial color={SKIN_SHADOW} roughness={0.4} />
          </mesh>
        </group>

        {/* Pierna derecha */}
        <group ref={legR} position={[0.09, 0.65, 0]}>
          <mesh geometry={LEG_GEOM} position={[0, -0.31, 0]} castShadow>
            <meshStandardMaterial color={SKIN_SHADOW} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export const Persons = () => {
  const persons = useSimulationStore((s) => s.persons);
  return (
    <>
      {persons.map((p) => (
        <PersonModel key={p.id} person={p} />
      ))}
    </>
  );
};
