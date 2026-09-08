import { PoolBasin } from "./pool/PoolBasin";
import { Building } from "./pool/Building";
import { Water } from "./pool/Water";
import { Ladder } from "./pool/Ladder";

export const Pool = () => {
  const POOL_X = 6;

  return (
    <group>
      {/* Vaso estático de la piscina (suelo, lineas, poyetes) */}
      <PoolBasin />

      {/* Escaleras de acceso (izquierda y derecha) */}
      <Ladder x={-POOL_X} z={6} dir={1} />
      <Ladder x={POOL_X} z={6} dir={-1} />

      {/* Superficie animada del agua */}
      <Water />

      {/* Estructura del edificio, cristalera y puerta automática */}
      <Building />
    </group>
  );
};
