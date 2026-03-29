import { Component } from "solid-js";
import VanillaDataRaw from "./vanillaData.json";
import VanillaLocalesRaw from "./vanillaLocales";
import { CheatCommand } from "./CheatCommand";

type EmptyObj = Record<PropertyKey, never>;
type EmptyLuaArray = EmptyObj; // Factorio's helpers.table_to_json() function will convert an empty array/table to {} instead of []

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
};

export type SourceEntity = {
  name: string;
  tile_width: number;
  tile_height: number;
};

export type SourceCraftingMachine<EmptyArray> = SourceEntity & {
  crafting_categories: string[] | EmptyArray;
  crafting_speed: number;
  is_burner: boolean;
};

export type SourceInserter = SourceEntity & {
  inserter_pickup_position: number[];
  inserter_drop_position: number[];
};

type SourceLogisticContainer = SourceEntity & {
  logistic_mode?: string;
};

export type SourceGroup = {
  name: string;
  order: string;
};

export type SourceQuality = {
  name: string;
};

type SourceData<EmptyArray> = {
  recipes: SourceRecipe<EmptyArray>[] | EmptyArray;
  items: SourceItem[] | EmptyArray;
  crafting_machines: SourceCraftingMachine<EmptyArray>[] | EmptyArray;
  inserters: SourceInserter[] | EmptyArray;
  logistic_containers: SourceLogisticContainer[] | EmptyArray;
  groups: SourceGroup[] | EmptyArray;
  subgroups: SourceGroup[] | EmptyArray;
  qualities: Array<SourceQuality> | EmptyArray;
};

// Assign imported data here to let typescript check our assumption (the defined types above).
// If typescript errors here, then `vanillaData.json` is not in the expected format.
export const VanillaData: SourceData<EmptyLuaArray> = VanillaDataRaw;

export type Locales = Record<string, string>;
const convertLocales = (raw: string) => {
  const locales: Locales = {};
  raw.trim().split("\n").forEach((row) => {
    const [key, value] = row.split("=", 2);
    if (key && value) {
      locales[key] = value;
    }
  });
  return locales;
};
export const VanillaLocales = convertLocales(VanillaLocalesRaw);

export const FactorioDataImporter: Component<{
  onChange: (data: typeof VanillaData, locales: Locales) => void;
}> = (props) => {
  let showPopupInput: HTMLInputElement | undefined;

  return (
    <div class="mt-8">
      <label for="import" class="btn">
        Import Custom Data (Modded Gameplay)
      </label>
      <input
        type="checkbox"
        id="import"
        class="modal-toggle"
        ref={showPopupInput}
      />
      <label for="import" class="modal cursor-pointer">
        <div class="modal-box relative">
          <label
            for="import"
            class="btn btn-sm btn-circle absolute right-2 top-2"
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
            A file called <code>export-for-gaming-tools.data</code> will be
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
            accept=".meg"
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              const input = e.currentTarget;
              if (file) {
                try {
                  const text = await file.text();
                  const [json, localeLines] = text.split("\n\n", 2);
                  props.onChange(JSON.parse(json), convertLocales(localeLines));
                  if (showPopupInput) {
                    input.value = "";
                    showPopupInput.checked = false;
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
      </label>
    </div>
  );
};
