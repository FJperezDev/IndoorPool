import { Person } from "../store/useSimulationStore";

// Asegúrate de que lleva "export" delante:
export const GRID_SIZE = 40;
export const AMBIENT_TEMP = 25;

export const calculatePerronHeatMap = (persons: Person[]): number[][] => {
  let grid = Array(GRID_SIZE)
    .fill(0)
    .map(() => Array(GRID_SIZE).fill(AMBIENT_TEMP));

  persons.forEach((p) => {
    const gx = Math.floor(((p.x + 10) / 20) * GRID_SIZE);
    const gz = Math.floor(((p.z + 10) / 20) * GRID_SIZE);

    if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) {
      grid[gx][gz] = p.temp;
    }
  });

  const iterations = 5;
  for (let iter = 0; iter < iterations; iter++) {
    const newGrid = grid.map((row) => [...row]);
    for (let i = 1; i < GRID_SIZE - 1; i++) {
      for (let j = 1; j < GRID_SIZE - 1; j++) {
        newGrid[i][j] =
          (grid[i - 1][j] + grid[i + 1][j] + grid[i][j - 1] + grid[i][j + 1]) /
          4;
      }
    }
    persons.forEach((p) => {
      const gx = Math.floor(((p.x + 10) / 20) * GRID_SIZE);
      const gz = Math.floor(((p.z + 10) / 20) * GRID_SIZE);
      if (gx >= 1 && gx < GRID_SIZE - 1 && gz >= 1 && gz < GRID_SIZE - 1) {
        newGrid[gx][gz] = p.temp;
      }
    });
    grid = newGrid;
  }

  return grid;
};
