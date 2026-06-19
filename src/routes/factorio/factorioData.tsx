import { Component } from "solid-js";
import { SelectInput } from "~/components/inputs";
import { CheatCommand } from "./CheatCommand";
import SpaceAgeDataRaw from "./data/spaceAge.json";
import SpaceAgeLocalesRaw from "./data/spaceAgeLocales";
import VanillaDataRaw from "./data/vanilla.json";
import VanillaLocalesRaw from "./data/vanillaLocales";

type EmptyObj = Record<PropertyKey, never>;
type EmptyLuaArray = EmptyObj; // Factorio's helpers.table_to_json() function will convert an empty array/table to {} instead of []

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isEmptyObject = (value: unknown): value is {} => {
  return isObject(value) && Object.keys(value).length === 0;
};

export type SourceRecipe<EmptyArray> = {
  name: string;
  category: string;
  order: string;
  energy: number;
  group_name: string;
  subgroup_name: string;
  request_paste_multiplier: number;
  main_product: string;
  ingredients:
    | {
        name: string;
        amount: number;
      }[]
    | EmptyArray;
};

export type SourceItem = {
  name: string;
  stack_size: number;
  /** in grams */
  weight: number;
};

export type SourceEntity = {
  name: string;
  item_to_place_this: {
    name: string;
    count: number;
  };
};

export type SourceTile = {
  name: string;
  item_to_place_this: {
    name: string;
    count: number;
  };
};

export type SourceEntityWithSize = {
  name: string;
  tile_width: number;
  tile_height: number;
};

export type SourceCraftingMachine<EmptyArray> = SourceEntityWithSize & {
  crafting_categories: string[] | EmptyArray;
  crafting_speed: number;
  is_burner: boolean;
};

export type SourceInserter = SourceEntityWithSize & {
  inserter_pickup_position: number[];
  inserter_drop_position: number[];
};

type SourceInventorySizes = Record<string, number>;

export type SourceLogisticContainer = SourceEntityWithSize & {
  /** key = quality */
  inventory_sizes: SourceInventorySizes;
  logistic_mode?: string;
};

export type SourceGroup = {
  name: string;
  order: string;
};

export type SourceQuality = {
  name: string;
};

export type SourceRocketSilo = SourceEntityWithSize & {
  name: string;
  inventory_sizes: SourceInventorySizes;
  /** in grams */
  lift_weight: number;
};

type SourceData<EmptyArray> = {
  recipes: SourceRecipe<EmptyArray>[] | EmptyArray;
  items: SourceItem[] | EmptyArray;
  entities: SourceEntity[] | EmptyArray;
  tiles: SourceTile[] | EmptyArray;
  crafting_machines: SourceCraftingMachine<EmptyArray>[] | EmptyArray;
  inserters: SourceInserter[] | EmptyArray;
  logistic_containers: SourceLogisticContainer[] | EmptyArray;
  groups: SourceGroup[] | EmptyArray;
  subgroups: SourceGroup[] | EmptyArray;
  qualities: Array<SourceQuality> | EmptyArray;
  rocket_silos: SourceRocketSilo[] | EmptyArray;
};

// Assign imported data here to let typescript check our assumption (the defined types above).
// If typescript errors here, then `vanillaData.json` is not in the expected format.
export const VanillaData: SourceData<EmptyLuaArray> = VanillaDataRaw;
export const SpaceAgeData: SourceData<EmptyLuaArray> = SpaceAgeDataRaw;

export const recursivelyConvertEmptyObjectsToEmptyArrays = (current: any) => {
  if (isObject(current)) {
    Object.keys(current).forEach((key) => {
      if (isEmptyObject(current[key])) {
        current[key] = [];
      } else {
        recursivelyConvertEmptyObjectsToEmptyArrays(current[key]);
      }
    });
    return;
  }
  if (Array.isArray(current)) {
    current.forEach((c) => recursivelyConvertEmptyObjectsToEmptyArrays(c));
    return;
  }
};

recursivelyConvertEmptyObjectsToEmptyArrays(VanillaData);
recursivelyConvertEmptyObjectsToEmptyArrays(SpaceAgeData);

export type Locales = Record<string, string>;
const convertLocales = (raw: string) => {
  const locales: Locales = {};
  raw
    .trim()
    .split("\n")
    .forEach((row) => {
      const [key, value] = row.split("=", 2);
      if (key && value) {
        locales[key] = value;
      }
    });
  return locales;
};
export const VanillaLocales = convertLocales(VanillaLocalesRaw);
export const SpaceAgeLocales = convertLocales(SpaceAgeLocalesRaw);

export type RecipeSet = "VANILLA" | "SPACE_AGE" | "CUSTOM";
export const FactorioDataImporter: Component<{
  recipeSet: RecipeSet;
  onChange: (
    data: typeof VanillaData,
    locales: Locales,
    recipeSet: RecipeSet,
  ) => void;
}> = (props) => {
  let showPopupInput: HTMLDialogElement | undefined;

  return (
    <div class="mt-8">
      <SelectInput
        label="Recipe set"
        entries={
          [
            { label: "No mods (Vanilla)", value: "VANILLA" },
            { label: "Space Age", value: "SPACE_AGE" },
            { label: "Custom (Modded Gameplay)", value: "CUSTOM" },
          ] satisfies { label: string; value: RecipeSet }[]
        }
        setValue={(v) => {
          if (v === "VANILLA") {
            props.onChange(VanillaData, VanillaLocales, "VANILLA");
          } else if (v === "SPACE_AGE") {
            props.onChange(SpaceAgeData, SpaceAgeLocales, "SPACE_AGE");
          } else {
            if (showPopupInput) {
              showPopupInput.showModal();
            }
          }
        }}
        currentValue={props.recipeSet}
      />
      <dialog class="modal" ref={showPopupInput}>
        <div class="modal-box relative">
          <label
            class="btn btn-sm btn-circle absolute right-2 top-2"
            onClick={() => showPopupInput?.close()}
          >
            ✕
          </label>
          <h3 class="mt-0">Import Custom Data</h3>
          <p>
            This imports data from your modded game to be available in this app.
          </p>
          <button
            class="btn btn-primary"
            onClick={() => navigator.clipboard.writeText(CheatCommand)}
          >
            Copy Cheat Command
          </button>
          <p>Copy this cheat command and execute it ingame. *</p>
          <p>
            A file called <code>export-data-for-gaming-tools.gtd</code> will be
            created in your{" "}
            <a
              href="https://wiki.factorio.com/Application_directory"
              target="_blank"
            >
              script-output
            </a>{" "}
            folder of Factorio which you must select below.
          </p>
          <input
            type="file"
            class="file-input file-input-bordered w-full max-w-xs"
            accept=".gtd"
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              const input = e.currentTarget;
              if (file) {
                try {
                  const text = await file.text();
                  const [json, localeLines] = text.split("\n\n", 2);
                  const data = JSON.parse(json);
                  recursivelyConvertEmptyObjectsToEmptyArrays(data);
                  props.onChange(data, convertLocales(localeLines), "CUSTOM");
                  if (showPopupInput) {
                    input.value = "";
                    showPopupInput.close();
                  }
                } catch (err) {
                  console.error(err);
                }
              }
            }}
          />
          <p class="text-sm">
            * Executing cheat commands will disable achievements. You can take a
            savegame and reload it afterwards.
          </p>
        </div>
      </dialog>
    </div>
  );
};

export const getItemToBuild = (
  data: typeof VanillaData,
  type: "entity" | "tile",
  name: string,
) => {
  const key = type === "entity" ? "entities" : "tiles";
  return data[key].find((x) => x.name === name)?.item_to_place_this;
};
