import {
  addEntity,
  COMPARATOR,
  createEmptyBlueprint,
  encodePlan,
} from "@jensforstmann/factorio-blueprint-tools";
import { Title } from "@solidjs/meta";
import { Component, createEffect, createSignal, For } from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";
import { CheckboxInput, NumberInput, TextInput } from "~/components/inputs";
import { CheatCommand } from "./CheatCommand";
import VanillaDataRaw from "./vanillaData.json";
import VanillaLocalesRaw from "./vanillaLocales";

type EmptyObj = Record<PropertyKey, never>;
type EmptyLuaArray = EmptyObj; // Factorio's helpers.table_to_json() function will convert an empty array/table to {} instead of []

type SourceRecipe<EmptyArray> = {
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

type SourceItem = {
  name: string;
  stack_size: number;
};

type SourceEntity = {
  name: string;
  tile_width: number;
  tile_height: number;
};

type SourceCraftingMachine<EmptyArray> = SourceEntity & {
  crafting_categories: string[] | EmptyArray;
};

type SourceInserter = SourceEntity & {
  inserter_pickup_position: number[];
  inserter_drop_position: number[];
};

type SourceLogisticContainer = SourceEntity & {
  logistic_mode: string;
};

type SourceGroup = {
  name: string;
  order: string;
};

type SourceData<EmptyArray> = {
  recipes: SourceRecipe<EmptyArray>[] | EmptyArray;
  items: SourceItem[] | EmptyArray;
  crafting_machines: SourceCraftingMachine<EmptyArray>[] | EmptyArray;
  inserters: SourceInserter[] | EmptyArray;
  logistic_containers: SourceLogisticContainer[] | EmptyArray;
  groups: SourceGroup[] | EmptyArray;
  subgroups: SourceGroup[] | EmptyArray;
};

// assign imported data here to let typescript check our assumption (the defined types above)
const VanillaDataChecked: SourceData<EmptyLuaArray> = VanillaDataRaw;

type AppData = {
  recipes: Array<
    SourceRecipe<[]> & {
      selected: boolean;
      display_name: string;
      group_display_name: string;
    }
  >;
  items: SourceItem[];
  crafting_machines: Array<
    SourceCraftingMachine<[]> & {
      display_name: string;
    }
  >;
  inserters: Array<
    SourceInserter & {
      display_name: string;
    }
  >;
  logistic_containers: Array<
    SourceLogisticContainer & {
      display_name: string;
    }
  >;
  groups: Array<SourceGroup & { display_name: string }>;
  subgroups: SourceGroup[];
  categories: string[];
};

const getLocale = (rawLocales: string, key: string) => {
  return rawLocales
    .split("\n")
    .find((row) => row.startsWith(key + "="))
    ?.split("=", 2)[1];
};

const convertSourceDataToAppData = (
  data: SourceData<EmptyLuaArray>,
  locales: string,
): AppData => {
  const categories = new Set<string>();
  data.recipes.forEach((r) => categories.add(r.category));
  return {
    recipes: !Array.isArray(data.recipes)
      ? []
      : data.recipes.map((recipe) => ({
          ...recipe,
          ingredients: Array.isArray(recipe.ingredients)
            ? recipe.ingredients
            : [],
          selected: false,
          display_name:
            getLocale(locales, "recipes." + recipe.name) || recipe.name,
          group_display_name:
            getLocale(locales, "groups." + recipe.group_name) ||
            recipe.group_name,
        })),
    items: !Array.isArray(data.items) ? [] : data.items,
    crafting_machines: !Array.isArray(data.crafting_machines)
      ? []
      : data.crafting_machines.map((crafting_machine) => ({
          ...crafting_machine,
          crafting_categories: Array.isArray(
            crafting_machine.crafting_categories,
          )
            ? crafting_machine.crafting_categories
            : [],
          display_name:
            getLocale(locales, "crafting_machines." + crafting_machine.name) ||
            crafting_machine.name,
        })),
    inserters: !Array.isArray(data.inserters)
      ? []
      : data.inserters.map((inserter) => ({
          ...inserter,
          display_name:
            getLocale(locales, "inserters." + inserter.name) || inserter.name,
        })),
    logistic_containers: !Array.isArray(data.logistic_containers)
      ? []
      : data.logistic_containers.map((logistic_container) => ({
          ...logistic_container,
          display_name:
            getLocale(
              locales,
              "logistic_containers." + logistic_container.name,
            ) || logistic_container.name,
        })),
    groups: !Array.isArray(data.groups)
      ? []
      : data.groups.map((group) => ({
          ...group,
          display_name:
            getLocale(locales, "groups." + group.name) || group.name,
        })),
    subgroups: !Array.isArray(data.subgroups) ? [] : data.subgroups,
    categories: Array.from(categories),
  };
};

const VanillaAppData = convertSourceDataToAppData(
  VanillaDataChecked,
  VanillaLocalesRaw,
);

type Settings = {
  machineName: string;
  machineWidth: number;
  machineHeight: number;
  machineSpeed: number;
  rowLength: number;
  columnSpace: number;
  rowSpace: number;
  sourceChestName: string;
  sourceChestWidth: number;
  sourceChestHeight: number;
  requestFromBufferChests: boolean;
  targetChestName: string;
  targetChestWidth: number;
  targetChestHeight: number;
  targetChestSetRequest: boolean;
  inserterName: string;
  outserterName: string;
  requestStackLimit: number;
  craftStackLimit: number;
};

type AppRecipe = SourceRecipe<[]> & { selected?: boolean };

const getItemStackSize = (itemName: string, items: SourceItem[]) => {
  return items.find((i) => i.name === itemName)?.stack_size ?? 1;
};

const getBlueprint = (settings: Settings, appData: AppData): string => {
  let currentRow = 0;
  let currentCol = 0;
  const blockWidth =
    Math.max(
      settings.machineWidth,
      settings.sourceChestWidth + settings.targetChestWidth,
    ) + settings.columnSpace;
  const blockHeight =
    settings.machineHeight +
    Math.max(settings.sourceChestHeight, settings.targetChestHeight) +
    settings.rowSpace +
    1;
  const bp = createEmptyBlueprint();
  bp.blueprint.label = "Factorio-Make-Everything";
  bp.blueprint.description =
    "This blueprint was generated by this site:\nhttps://gaming-tools.jensforstmann.vercel.app/factorio/make-everything-generator\n\nReport bugs & issues or make suggestions at:\nhttps://github.com/JensForstmann/gaming-tools";
  bp.blueprint.icons = [
    { signal: { type: "virtual", name: "signal-M" }, index: 1 },
    { signal: { type: "virtual", name: "signal-E" }, index: 2 },
    { signal: { type: "virtual", name: "signal-black" }, index: 3 },
    { signal: { type: "virtual", name: "signal-black" }, index: 4 },
  ];

  appData.recipes
    .filter((r) => r.selected)
    .forEach((r) => {
      addEntity(bp, {
        name: settings.machineName,
        position: {
          x: currentCol * blockWidth + settings.machineWidth / 2,
          y: currentRow * blockHeight + settings.machineHeight / 2,
        },
        recipe: r.name,
      });
      addEntity(bp, {
        name: settings.inserterName,
        position: {
          x: currentCol * blockWidth + 0.5,
          y: currentRow * blockHeight + settings.machineHeight + 0.5,
        },
        direction: 8,
      });
      addEntity(bp, {
        name: settings.outserterName,
        position: {
          x: currentCol * blockWidth + settings.sourceChestWidth + 0.5,
          y: currentRow * blockHeight + settings.machineHeight + 0.5,
        },
        control_behavior: {
          logistic_condition: {
            first_signal: {
              type: "item",
              name: r.main_product,
            },
            constant:
              getItemStackSize(r.main_product, appData.items) *
              settings.craftStackLimit,
            comparator: COMPARATOR.lessThan,
          },
          connect_to_logistic_network: true,
        },
      });
      addEntity(bp, {
        name: settings.sourceChestName,
        position: {
          x: currentCol * blockWidth + settings.sourceChestWidth / 2,
          y:
            currentRow * blockHeight +
            settings.machineHeight +
            1 +
            settings.sourceChestHeight / 2,
        },
        request_filters: {
          sections: [
            {
              index: 1,
              filters: r.ingredients.map((ing, idx) => {
                return {
                  index: idx + 1,
                  name: ing.name,
                  quality: "normal",
                  comparator: COMPARATOR.equal,
                  count: Math.max(
                    1,
                    Math.floor(
                      Math.min(
                        getItemStackSize(ing.name, appData.items) *
                          settings.requestStackLimit,
                        Math.max(
                          ing.amount,
                          (ing.amount *
                            r.request_paste_multiplier *
                            settings.machineSpeed) /
                            r.energy,
                        ),
                      ),
                    ),
                  ),
                };
              }),
            },
          ],
          request_from_buffers: settings.requestFromBufferChests,
        },
      });
      addEntity(bp, {
        name: settings.targetChestName,
        position: {
          x:
            currentCol * blockWidth +
            settings.sourceChestWidth +
            settings.targetChestWidth / 2,
          y:
            currentRow * blockHeight +
            settings.machineHeight +
            1 +
            settings.targetChestHeight / 2,
        },
        request_filters: settings.targetChestSetRequest
          ? {
              sections: [
                {
                  index: 1,
                  filters: [
                    {
                      index: 1,
                      name: r.main_product,
                      quality: "normal",
                      comparator: COMPARATOR.equal,
                      count: 1_000_000,
                    },
                  ],
                },
              ],
            }
          : undefined,
      });

      currentCol++;
      if (currentCol === settings.rowLength) {
        currentCol = 0;
        currentRow++;
      }
    });
  return encodePlan(bp);
};

const HelpSection = () => {
  return (
    <div class="collapse collapse-arrow bg-base-200">
      <input type="checkbox" />
      <h3 class="collapse-title m-0">Help / Example</h3>
      <div class="collapse-content">
        <p>
          This generator gives you a blueprint to produce the selected recipes.
        </p>
        <img
          src="/images/make-everything-generator-assembling-machines.png"
          alt="assembling machines"
        />

        <p>
          The requester chest will request the items you need for the recipe. It
          will respect the speed of the machine and the time needed to craft the
          item.
        </p>
        <img
          src="/images/make-everything-generator-requester-chest.png"
          alt="requester chest"
        />

        <p>The outserter will prevent producing too much of one item.</p>
        <img
          src="/images/make-everything-generator-outserter.png"
          alt="outserter"
        />

        <p>
          The buffer chest will request the product so manually picking up items
          is as easy as always.
        </p>
        <img
          src="/images/make-everything-generator-buffer-chest.png"
          alt="buffer chest"
        />

        <p>
          This app and the generated blueprint can be fully customized by
          changing several settings. Mods are also fully supported via a cheat
          command to extract the recipes from your current game.
        </p>
      </div>
    </div>
  );
};

const Settings: Component<{
  settings: Settings;
  setSettings: SetStoreFunction<Settings>;
}> = (props) => {
  return (
    <>
      <div class="grid grid-cols-4 space-x-4">
        <TextInput
          label="Machine Name"
          value={props.settings.machineName}
          setValue={(v) => props.setSettings("machineName", v)}
        />
        <NumberInput
          label="Machine Width"
          value={props.settings.machineWidth}
          setValue={(v) => props.setSettings("machineWidth", v)}
          min={1}
        />
        <NumberInput
          label="Machine Height"
          value={props.settings.machineHeight}
          setValue={(v) => props.setSettings("machineHeight", v)}
          min={1}
        />
        <NumberInput
          label="Machine Speed"
          value={props.settings.machineSpeed}
          setValue={(v) => props.setSettings("machineSpeed", v)}
          min={0}
        />
      </div>
      <div class="grid grid-cols-4 space-x-4">
        <NumberInput
          label="Machines per Row"
          value={props.settings.rowLength}
          setValue={(v) => props.setSettings("rowLength", v)}
          min={1}
        />
        <NumberInput
          label="Space between Rows"
          value={props.settings.rowSpace}
          setValue={(v) => props.setSettings("rowSpace", v)}
          min={0}
        />
        <NumberInput
          label="Space between Machines"
          value={props.settings.columnSpace}
          setValue={(v) => props.setSettings("columnSpace", v)}
          min={0}
        />
      </div>
      <div class="grid grid-cols-4 space-x-4">
        <TextInput
          label="Source Chest Name"
          value={props.settings.sourceChestName}
          setValue={(v) => props.setSettings("sourceChestName", v)}
        />
        <NumberInput
          label="Source Chest Width"
          value={props.settings.sourceChestWidth}
          setValue={(v) => props.setSettings("sourceChestWidth", v)}
          min={1}
        />
        <NumberInput
          label="Source Chest Height"
          value={props.settings.sourceChestHeight}
          setValue={(v) => props.setSettings("sourceChestHeight", v)}
          min={1}
        />
        <CheckboxInput
          label="Request from Buffer Chests"
          value={props.settings.requestFromBufferChests}
          setValue={(v) => props.setSettings("requestFromBufferChests", v)}
        />
      </div>
      <div class="grid grid-cols-4 space-x-4">
        <TextInput
          label="Target Chest Name"
          value={props.settings.targetChestName}
          setValue={(v) => props.setSettings("targetChestName", v)}
        />
        <NumberInput
          label="Target Chest Width"
          value={props.settings.targetChestWidth}
          setValue={(v) => props.setSettings("targetChestWidth", v)}
          min={1}
        />
        <NumberInput
          label="Target Chest Height"
          value={props.settings.targetChestHeight}
          setValue={(v) => props.setSettings("targetChestHeight", v)}
          min={1}
        />
        <CheckboxInput
          label="Target Chest set Requests"
          value={props.settings.targetChestSetRequest}
          setValue={(v) => props.setSettings("targetChestSetRequest", v)}
        />
      </div>
      <div class="grid grid-cols-4 space-x-4">
        <TextInput
          label="Inserter Name"
          value={props.settings.inserterName}
          setValue={(v) => props.setSettings("inserterName", v)}
        />
        <TextInput
          label="Outserter Name"
          value={props.settings.outserterName}
          setValue={(v) => props.setSettings("outserterName", v)}
        />
      </div>
      <div class="grid grid-cols-4 space-x-4">
        <NumberInput
          label="Request Stack Limit"
          value={props.settings.requestStackLimit}
          setValue={(v) => props.setSettings("requestStackLimit", v)}
          min={0}
        />
        <NumberInput
          label="Craft Stack Limit"
          value={props.settings.craftStackLimit}
          setValue={(v) => props.setSettings("craftStackLimit", v)}
          min={0}
        />
      </div>
    </>
  );
};

const Page = () => {
  let globalCheckbox: HTMLInputElement | undefined;
  let showPopupInput: HTMLInputElement | undefined;

  const [appData, setAppData] = createStore<AppData>(VanillaAppData);

  const [search, setSearch] = createSignal("");
  const [categoryFilter, setCategoryFilter] = createSignal("");
  const [groupFilter, setGroupFilter] = createSignal("");
  const [subgroupFilter, setSubgroupFilter] = createSignal("");

  const [settings, setSettings] = createStore<Settings>({
    machineName: "assembling-machine-3",
    machineWidth: 3,
    machineHeight: 3,
    machineSpeed: 1.25,
    rowLength: 5,
    columnSpace: 0,
    rowSpace: 0,
    sourceChestName: "requester-chest",
    sourceChestWidth: 1,
    sourceChestHeight: 1,
    requestFromBufferChests: true,
    targetChestName: "buffer-chest",
    targetChestWidth: 1,
    targetChestHeight: 1,
    targetChestSetRequest: true,
    inserterName: "bulk-inserter",
    outserterName: "bulk-inserter",
    requestStackLimit: 3,
    craftStackLimit: 4,
  });

  const toggleRecipe = (name: string) => {
    setAppData(
      "recipes",
      (recipe) => recipe.name === name,
      "selected",
      (selected) => !selected,
    );
  };

  const resetSearchAndFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setGroupFilter("");
    setSubgroupFilter("");
  };

  const filteredRecipes = () => {
    return appData.recipes.filter(
      (r) =>
        (search() === "" ||
          r.name.includes(search()) ||
          r.display_name.includes(search())) &&
        (categoryFilter() === "" || r.category === categoryFilter()) &&
        (groupFilter() === "" || r.group_name === groupFilter()) &&
        (subgroupFilter() === "" || r.subgroup_name === subgroupFilter()),
    );
  };

  createEffect(() => {
    if (globalCheckbox) {
      const selected = filteredRecipes().filter(
        (r) => r.selected === true,
      ).length;
      const notSelected = filteredRecipes().length - selected;
      if (selected === 0) {
        globalCheckbox.indeterminate = false;
        globalCheckbox.checked = false;
      } else if (notSelected === 0) {
        globalCheckbox.indeterminate = false;
        globalCheckbox.checked = true;
      } else {
        globalCheckbox.indeterminate = true;
        globalCheckbox.checked = false;
      }
    }
  });

  return (
    <div class="w-full max-w-4xl m-auto mb-48 prose">
      <Title>Make Everything Generator | Factorio | Gaming Tools</Title>
      <div>
        <h2>Make Everything Generator</h2>
        <p>This tool can be used to build bot based malls/hubs.</p>
      </div>
      <div class="h-8"></div>
      <HelpSection />
      <div class="mt-8">
        <label for="import" class="btn">
          Import Custom Recipes (Modded Gameplay)
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
            <h3 class="mt-0">Import Recipes</h3>
            <button
              class="btn btn-primary"
              onClick={() => navigator.clipboard.writeText(CheatCommand)}
            >
              Copy Cheat Command
            </button>
            <p>
              Copy this cheat command and execute it ingame.
              <br />A file called "recipes_dump.json" will be created in your{" "}
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
                    const [json, locales] = text.split("\n\n", 2);
                    setAppData(
                      convertSourceDataToAppData(JSON.parse(json), locales),
                    );
                    resetSearchAndFilters();
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
          </div>
        </label>
      </div>
      <table class="table table-sm w-full mt-8 table-pin-rows">
        <thead>
          <tr class="bg-base-300">
            <th class="py-6 align-middle rounded-tl-lg">
              <label>
                <input
                  type="checkbox"
                  class="checkbox checkbox-lg"
                  ref={globalCheckbox}
                  onChange={() => {
                    const _filteredRecipes = filteredRecipes();
                    const _selectedRecipes = _filteredRecipes.filter(
                      (recipe) => recipe.selected,
                    );
                    setAppData(
                      "recipes",
                      (r) =>
                        _filteredRecipes.find((r2) => r2.name === r.name) !==
                        undefined,
                      "selected",
                      _selectedRecipes.length !== _filteredRecipes.length,
                    );
                  }}
                />
              </label>
            </th>
            <th class="py-6 align-top">
              Recipe
              <TextInput value={search()} setValue={setSearch} />
            </th>
            <th class="py-6 align-top">
              <div>Group</div>
              <select
                class="select w-full max-w-xs"
                onChange={(e) => setGroupFilter(e.currentTarget.value)}
              >
                <option value={""}>filter...</option>
                <For each={appData.groups}>
                  {(group) => (
                    <option value={group.name}>{group.display_name}</option>
                  )}
                </For>
              </select>
            </th>
            <th class="py-6 align-top">
              <div>Subgroup</div>
              <select
                class="select w-full max-w-xs"
                onChange={(e) => setSubgroupFilter(e.currentTarget.value)}
              >
                <option value={""}>filter...</option>
                <For each={appData.subgroups}>
                  {(subgroup) => (
                    <option value={subgroup.name}>{subgroup.name}</option>
                  )}
                </For>
              </select>
            </th>
            <th class="py-6 align-top rounded-tr-lg">
              <div>Category</div>
              <select
                class="select w-full max-w-xs"
                onChange={(e) => setCategoryFilter(e.currentTarget.value)}
              >
                <option value={""}>filter...</option>
                <For each={appData.categories}>
                  {(category) => <option>{category}</option>}
                </For>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={filteredRecipes()}>
            {(recipe) => (
              <tr>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      class="checkbox"
                      checked={recipe.selected}
                      onChange={() => toggleRecipe(recipe.name)}
                    />
                  </label>
                </td>
                <td>{recipe.display_name}</td>
                <td>{recipe.group_display_name}</td>
                <td>{recipe.subgroup_name}</td>
                <td>{recipe.category}</td>
              </tr>
            )}
          </For>
        </tbody>
        <tfoot>
          <tr class="bg-base-300">
            <th class="rounded-bl-lg"></th>
            <th>Recipe</th>
            <th>Group</th>
            <th>Subgroup</th>
            <th class="rounded-br-lg">Category</th>
          </tr>
        </tfoot>
      </table>
      <div class="mt-8">
        <h3>Settings</h3>
        <Settings settings={settings} setSettings={setSettings} />
      </div>
      <div class="mt-8">
        <button
          class="btn btn-primary"
          onClick={() => {
            navigator.clipboard.writeText(getBlueprint(settings, appData));
          }}
        >
          Copy Blueprint
        </button>
      </div>
    </div>
  );
};

export default Page;
