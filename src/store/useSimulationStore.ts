import { create } from "zustand";
import {
  resetSolver,
  gotoIteration,
  solverState,
} from "../math/subSuperSolver";

export type ActionStatus = "entering" | "wandering" | "swimming" | "exiting";

export type ViewMode = "sub" | "super" | "gap" | "solution";

export type DoorMode = "auto" | "open" | "closed";

export interface Person {
  id: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  temp: number;
  status: ActionStatus;
}

interface SimState {
  persons: Person[];
  maxCapacity: number;
  isDoorOpen: boolean;
  doorMode: DoorMode;
  viewMode: ViewMode;
  sweepsPerFrame: number;
  buildingTransparent: boolean;
  running: boolean;
  targetIteration: number;
  addPerson: () => void;
  removePerson: () => void;
  fillCapacity: () => void;
  clearPersons: () => void;
  updatePositions: () => void;
  setViewMode: (v: ViewMode) => void;
  setSweepsPerFrame: (n: number) => void;
  setBuildingTransparent: (v: boolean) => void;
  setDoorMode: (m: DoorMode) => void;
  setRunning: (v: boolean) => void;
  setTargetIteration: (n: number) => void;
  stepBy: (delta: number) => void;
  refresh: () => void;
  resetSimulation: () => void;
}

let nextId = 1;

const getRandomWanderTarget = () => {
  let nx = (Math.random() - 0.5) * 18;
  let nz = (Math.random() - 0.5) * 18;
  if (Math.abs(nx) < 6.5 && Math.abs(nz) < 8.5) nx = nx > 0 ? 7 : -7;
  return { x: nx, z: nz };
};

const getRandomSwimTarget = () => ({
  x: (Math.random() - 0.5) * 10,
  z: (Math.random() - 0.5) * 14,
});

export const useSimulationStore = create<SimState>((set, get) => ({
  persons: [],
  maxCapacity: 50,
  isDoorOpen: false,
  doorMode: "auto",
  viewMode: "solution",
  sweepsPerFrame: 12,
  buildingTransparent: true,
  running: true,
  targetIteration: 0,

  addPerson: () => {
    const { persons, maxCapacity } = get();
    if (persons.length >= maxCapacity) return;
    const newPerson: Person = {
      id: nextId++,
      x: 12,
      z: 0,
      targetX: 8,
      targetZ: (Math.random() - 0.5) * 4,
      temp: 33 + Math.random() * 4,
      status: "entering",
    };
    set({ persons: [...persons, newPerson] });
    get().refresh();
  },

  removePerson: () => {
    const { persons } = get();
    const personToExit = persons.find((p) => p.status !== "exiting");
    if (!personToExit) return;
    set({
      persons: persons.map((p) =>
        p.id === personToExit.id
          ? { ...p, status: "exiting", targetX: 13, targetZ: 0 }
          : p,
      ),
    });
    get().refresh();
  },

  fillCapacity: () => {
    const { persons, maxCapacity } = get();
    const missing = maxCapacity - persons.length;
    if (missing <= 0) return;
    const newcomers: Person[] = [];
    for (let k = 0; k < missing; k++) {
      const x = (Math.random() - 0.5) * 18;
      const z = (Math.random() - 0.5) * 18;
      const inPool = x > -6 && x < 6 && z > -8 && z < 8;
      newcomers.push({
        id: nextId++,
        x,
        z,
        targetX: inPool
          ? (Math.random() - 0.5) * 10
          : (Math.random() - 0.5) * 18,
        targetZ: inPool
          ? (Math.random() - 0.5) * 14
          : (Math.random() - 0.5) * 18,
        temp: 33 + Math.random() * 4,
        status: inPool ? "swimming" : "wandering",
      });
    }
    set({ persons: [...persons, ...newcomers] });
    get().refresh();
  },

  clearPersons: () => {
    set({ persons: [], isDoorOpen: false });
    get().refresh();
  },

  updatePositions: () => {
    const doorBefore = get().isDoorOpen;
    set((state) => {
      const nextPersons: Person[] = [];
      let sensorOpen = false;

      state.persons.forEach((p) => {
        const dx = p.targetX - p.x;
        const dz = p.targetZ - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Sensor de la puerta corredera (hueco en x = +11, z ∈ [-1, 1])
        if (p.x > 10 && Math.abs(p.z) < 1.5) sensorOpen = true;

        if (dist < 0.5) {
          if (p.status === "exiting") return;
          let nextStatus = p.status;
          if (p.status === "entering")
            nextStatus = Math.random() > 0.5 ? "swimming" : "wandering";
          else if (p.status === "wandering")
            nextStatus = Math.random() > 0.6 ? "swimming" : "wandering";
          else if (p.status === "swimming")
            nextStatus = Math.random() > 0.3 ? "swimming" : "wandering";

          const nextTarget =
            nextStatus === "swimming"
              ? getRandomSwimTarget()
              : getRandomWanderTarget();
          nextPersons.push({
            ...p,
            status: nextStatus,
            targetX: nextTarget.x,
            targetZ: nextTarget.z,
          });
        } else {
          const speed = 0.25;
          nextPersons.push({
            ...p,
            x: p.x + (dx / dist) * Math.min(speed, dist),
            z: p.z + (dz / dist) * Math.min(speed, dist),
          });
        }
      });
      const isDoorOpen =
        state.doorMode === "open"
          ? true
          : state.doorMode === "closed"
            ? false
            : sensorOpen;
      return { persons: nextPersons, isDoorOpen };
    });
    // Un cambio de estado de la puerta altera las condiciones de contorno:
    // las sucesiones en curso ya no son sub/super-soluciones del problema.
    if (get().isDoorOpen !== doorBefore) get().refresh();
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setSweepsPerFrame: (sweepsPerFrame) => set({ sweepsPerFrame }),
  setDoorMode: (doorMode) => {
    set({ doorMode });
    get().refresh();
  },
  setRunning: (running) => {
    if (running) {
      set({ running: true });
    } else {
      set({ running: false, targetIteration: solverState.iteration });
    }
  },
  setTargetIteration: (n) => {
    const next = Math.max(0, Math.floor(n));
    const { persons, isDoorOpen } = get();
    gotoIteration(persons, isDoorOpen, next);
    set({ targetIteration: next });
  },
  stepBy: (delta) => {
    const { targetIteration, persons, isDoorOpen } = get();
    const next = Math.max(0, targetIteration + delta);
    gotoIteration(persons, isDoorOpen, next);
    set({ targetIteration: next });
  },
  refresh: () => {
    const { running, persons, isDoorOpen, targetIteration } = get();
    if (!running) {
      gotoIteration(persons, isDoorOpen, targetIteration);
    } else {
      // Con escenario nuevo (parámetros, aforo o puerta) las sucesiones en
      // curso pueden no ser sub/super-soluciones del problema modificado:
      // se reinician en u = 0 y u~ = 1 para preservar el encajonamiento.
      resetSolver();
      set({ targetIteration: 0 });
    }
  },
  resetSimulation: () => {
    resetSolver();
    set({ persons: [], isDoorOpen: false, targetIteration: 0 });
  },
  setBuildingTransparent: (buildingTransparent) => set({ buildingTransparent }),
}));
