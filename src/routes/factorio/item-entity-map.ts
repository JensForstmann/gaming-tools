// 1.) select lines to sort -> F1 -> Sort Lines Ascending
// https://toniguga.it/blog/2020/03/17/how-to-remove-duplicate-lines-in-visual-studio-code/
export const entityItemMap: {
  [key: string]: { item: string; count?: number };
} = {
  "chute-miniloader-inserter": { item: "chute-miniloader" },
  "concrete-wall-ruin": { item: "concrete-wall" },
  "curved-rail": { item: "rail", count: 4 },
  "express-filter-miniloader-inserter": { item: "express-filter-miniloader" },
  "express-miniloader-inserter": { item: "express-miniloader" },
  "fast-filter-miniloader-inserter": { item: "fast-filter-miniloader" },
  "fast-miniloader-inserter": { item: "fast-miniloader" },
  "filter-miniloader-inserter": { item: "filter-miniloader" },
  "furnace-ruin": { item: "stone-furnace" },
  "hazard-concrete-left": { item: "hazard-concrete" },
  "hazard-concrete-right": { item: "hazard-concrete" },
  "iron-wood-chest-remnants": { item: "iron-chest" },
  "iron-wood-chest": { item: "iron-chest" },
  "miniloader-inserter": { item: "miniloader" },
  "railloader-chest": { item: "railloader" },
  "railloader-placement-proxy": { item: "railloader" },
  "railunloader-chest": { item: "railunloader" },
  "railunloader-placement-proxy": { item: "railunloader" },
  "refined-hazard-concrete-left": { item: "refined-hazard-concrete" },
  "refined-hazard-concrete-right": { item: "refined-hazard-concrete" },
  "rough-stone-path": { item: "stone" },
  "se-core-miner-drill": { item: "se-core-miner" },
  "se-fuel-refinery-spaced": { item: "se-fuel-refinery" },
  "se-meteor-defence-container": { item: "se-meteor-defence" },
  "se-meteor-point-defence-container": { item: "se-meteor-point-defence" },
  "se-pylon-construction-radar-radar": { item: "se-pylon-construction-radar" },
  "se-pylon-construction-radar-roboport": {
    item: "se-pylon-construction-radar",
  },
  "se-pylon-construction-roboport": { item: "se-pylon-construction" },
  "se-space-assembling-machine-grounded": {
    item: "se-space-assembling-machine",
  },
  "se-space-biochemical-laboratory-grounded": {
    item: "se-space-biochemical-laboratory",
  },
  "se-space-capsule-_-vehicle": { item: "se-space-capsule" },
  "se-space-curved-rail": { item: "se-space-rail", count: 4 },
  "se-space-decontamination-facility-grounded": {
    item: "se-space-decontamination-facility",
  },
  "se-space-hypercooler-grounded": { item: "se-space-hypercooler" },
  "se-space-laser-laboratory-grounded": { item: "se-space-laser-laboratory" },
  "se-space-manufactory-grounded": { item: "se-space-manufactory" },
  "se-space-mechanical-laboratory-grounded": {
    item: "se-space-mechanical-laboratory",
  },
  "se-space-particle-accelerator-grounded": {
    item: "se-space-particle-accelerator",
  },
  "se-space-radiation-laboratory-grounded": {
    item: "se-space-radiation-laboratory",
  },
  "se-space-radiator-2-grounded": { item: "se-space-radiator-2" },
  "se-space-radiator-grounded": { item: "se-space-radiator" },
  "se-space-straight-rail": { item: "se-space-rail" },
  "se-space-supercomputer-1-grounded": { item: "se-space-supercomputer-1" },
  "se-space-supercomputer-2-grounded": { item: "se-space-supercomputer-2" },
  "se-space-supercomputer-3-grounded": { item: "se-space-supercomputer-3" },
  "se-space-supercomputer-4-grounded": { item: "se-space-supercomputer-4" },
  "se-space-thermodynamics-laboratory-grounded": {
    item: "se-space-thermodynamics-laboratory",
  },
  "se-spaceship-clamp-place": { item: "se-spaceship-clamp" },
  "se-spaceship-console-output": { item: "se-struct-generic-output" },
  "space-filter-miniloader-inserter": { item: "space-filter-miniloader" },
  "space-miniloader-inserter": { item: "space-miniloader" },
  "steel-wall-ruin": { item: "steel-wall" },
  "stone-path": { item: "stone-brick" },
  "stone-rubble": { item: "stone-wall" },
  "stone-wall-ruin": { item: "stone-wall" },
  "straight-rail": { item: "rail" },
  vase: { item: "wood" },
  "wood-half-chest-left": { item: "wooden-chest" },
  "wood-half-chest-right": { item: "wooden-chest" },
  "wooden-barrel": { item: "wood" },
  "workshop-ruin": { item: "assembling-machine-1" },
};