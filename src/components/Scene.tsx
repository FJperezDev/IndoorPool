import { OrbitControls, Environment } from "@react-three/drei";
import { HeatMap } from "./HeatMap";
import { Persons } from "./Persons";
import { Pool } from "./Pool";

export const Scene = () => {
  return (
    <>
      {/* Color de fondo del "universo" fuera del edificio */}
      <color attach="background" args={["#101216"]} />

      {/* Luz hemisférica: cielo y suelo (relleno natural de interior) */}
      <hemisphereLight args={["#eef4ff", "#20303a", 0.7]} />
      <ambientLight intensity={0.25} />

      {/* Luz principal: sol entrando por la cristalera */}
      <directionalLight
        position={[6, 14, -8]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0004}
      />

      {/* Luz de relleno fría desde el frente */}
      <directionalLight position={[-8, 8, 10]} intensity={0.35} color="#9fd4ff" />

      {/* Luz cenital de la sala */}
      <pointLight position={[0, 5, 0]} intensity={0.8} distance={30} decay={1.6} />

      {/* Elementos de la simulación */}
      <Pool />
      <HeatMap />
      <Persons />

      {/* Controles para el Tribunal */}
      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.05} // Evita que la cámara baje por debajo del suelo
        minDistance={5}
        maxDistance={45}
        target={[0, 1, 0]}
      />

      {/* Entorno HDRI para reflejos en cristal y agua */}
      <Environment preset="apartment" />
    </>
  );
};
