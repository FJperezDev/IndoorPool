import { create } from "zustand";
import { resetSolver } from "../math/subSuperSolver";

export type ActionStatus = "entering" | "wandering" | "swimming" | "exiting";

export type ViewMode = "sub" | "super" | "gap" | "solution";

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
  viewMode: ViewMode;
  sweepsPerFrame: number;
  buildingTransparent: boolean;
  addPerson: () => void;
  removePerson: () => void;
  fillCapacity: () => void;
  clearPersons: () => void;
  updatePositions: () => void;
  setViewMode: (v: ViewMode) => void;
  setSweepsPerFrame: (n: number) => void;
  setBuildingTransparent: (v: boolean) => void;
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
  viewMode: "solution",
  sweepsPerFrame: 12,
  buildingTransparent: true,

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
  },

  clearPersons: () => set({ persons: [], isDoorOpen: false }),

  updatePositions: () => {
    set((state) => {
      const nextPersons: Person[] = [];
      let doorOpen = false;

      state.persons.forEach((p) => {
        const dx = p.targetX - p.x;
        const dz = p.targetZ - p.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (p.x > 8.5 && Math.abs(p.z) < 2) doorOpen = true; // Sensor de puerta

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
      return { persons: nextPersons, isDoorOpen: doorOpen };
    });
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setSweepsPerFrame: (sweepsPerFrame) => set({ sweepsPerFrame }),
  resetSimulation: () => {
    resetSolver();
    set({ persons: [], isDoorOpen: false });
  },
  setBuildingTransparent: (buildingTransparent) => set({ buildingTransparent }),
}));
