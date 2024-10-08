import {
  addEntity,
  createEmptyBlueprint,
  encodePlan,
} from "@jensforstmann/factorio-blueprint-tools";
import { Title } from "@solidjs/meta";
import { Component, createEffect, createSignal, For } from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";
import { CheckboxInput, NumberInput, TextInput } from "~/components/inputs";
import { CheatCommand } from "./CheatCommand";
import VanillaRecipes from "./vanillaRecipes.json";

type Recipe = {
  name: string;
  enabled: boolean;
  category: string;
  order: string;
  energy: number;
  group_name: string;
  group_order: string;
  subgroup_name: string;
  subgroup_order: string;
  request_paste_multiplier: number;
  can_be_researched: boolean;
  main_product: null | string;
  main_product_stack_size: null | number;
  ingredients: Array<{
    name: string;
    amount: number;
    stack_size: number;
  }>;
  selected?: boolean;
};

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

const getBlueprint = (settings: Settings, recipes: Recipe[]): string => {
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

  recipes
    .filter((r) => r.selected)
    .sort((a, b) => {
      if (a.group_name === b.group_name) {
        if (a.subgroup_name === b.subgroup_name) {
          return a.order > b.order ? 1 : -1;
        }
        return a.subgroup_order > b.subgroup_order ? 1 : -1;
      }
      return a.group_order > b.group_order ? 1 : -1;
    })
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
        direction: 4,
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
              (r.main_product_stack_size ?? 1) * settings.craftStackLimit,
            comparator: "<",
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
        request_filters: r.ingredients.map((ing, idx) => {
          return {
            index: idx + 1,
            name: ing.name,
            count: Math.max(
              1,
              Math.floor(
                Math.min(
                  ing.stack_size * settings.requestStackLimit,
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
        request_from_buffers: settings.requestFromBufferChests,
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
        request_filters:
          settings.targetChestSetRequest && r.main_product
            ? [
                {
                  index: 1,
                  name: r.main_product,
                  count: 1_000_000,
                },
              ]
            : [],
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

const filterRecipes = (recipes: Array<Recipe>) => {
  return recipes.filter((r) => r.enabled || r.can_be_researched);
};

const Page = () => {
  let globalCheckbox: HTMLInputElement | undefined;
  let showPopupInput: HTMLInputElement | undefined;
  const [recipes, setRecipes] = createStore<Array<Recipe>>(
    filterRecipes(VanillaRecipes),
  );
  const [settings, setSettings] = createStore<Settings>({
    machineName: "assembling-machine-3",
    machineWidth: 3,
    machineHeight: 3,
    machineSpeed: 1.25,
    rowLength: 5,
    columnSpace: 0,
    rowSpace: 0,
    sourceChestName: "logistic-chest-requester",
    sourceChestWidth: 1,
    sourceChestHeight: 1,
    requestFromBufferChests: true,
    targetChestName: "logistic-chest-buffer",
    targetChestWidth: 1,
    targetChestHeight: 1,
    targetChestSetRequest: true,
    inserterName: "stack-inserter",
    outserterName: "stack-inserter",
    requestStackLimit: 3,
    craftStackLimit: 4,
  });
  const toggleRecipe = (name: string) => {
    setRecipes(
      (recipe) => recipe.name === name,
      "selected",
      (selected) => !selected,
    );
  };
  const categories = [...new Set(recipes.map((r) => r.category))].sort();
  const groups = [...new Set(recipes.map((r) => r.group_name))].sort();
  const subGroups = [...new Set(recipes.map((r) => r.subgroup_name))].sort();
  const [categoryFilter, setCategoryFilter] = createSignal("");
  const [groupFilter, setGroupFilter] = createSignal("");
  const [subGroupFilter, setSubGroupFilter] = createSignal("");
  const [search, setSearch] = createSignal("");

  const filteredRecipes = () => {
    return recipes.filter(
      (r) =>
        (search() === "" || r.name.includes(search())) &&
        (categoryFilter() === "" || r.category === categoryFilter()) &&
        (groupFilter() === "" || r.group_name === groupFilter()) &&
        (subGroupFilter() === "" || r.subgroup_name === subGroupFilter()),
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
              accept="application/json"
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                const input = e.currentTarget;
                if (file) {
                  try {
                    const text = await file.text();
                    const recipes: Recipe[] = JSON.parse(text);
                    setRecipes(filterRecipes(recipes));
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
                    setRecipes(
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
              Name
              <TextInput value={search()} setValue={setSearch} />
            </th>
            <th class="py-6 align-top">
              <div>Category</div>
              <select
                class="select w-full max-w-xs"
                onChange={(e) => setCategoryFilter(e.currentTarget.value)}
              >
                <option value={""}>filter...</option>
                <For each={categories}>
                  {(category) => <option>{category}</option>}
                </For>
              </select>
            </th>
            <th class="py-6 align-top">
              <div>Group</div>
              <select
                class="select w-full max-w-xs"
                onChange={(e) => setGroupFilter(e.currentTarget.value)}
              >
                <option value={""}>filter...</option>
                <For each={groups}>{(group) => <option>{group}</option>}</For>
              </select>
            </th>
            <th class="py-6 align-top rounded-tr-lg">
              <div>Subgroup</div>
              <select
                class="select w-full max-w-xs"
                onChange={(e) => setSubGroupFilter(e.currentTarget.value)}
              >
                <option value={""}>filter...</option>
                <For each={subGroups}>
                  {(subGroup) => <option>{subGroup}</option>}
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
                <td>{recipe.name}</td>
                <td>{recipe.category}</td>
                <td>{recipe.group_name}</td>
                <td>{recipe.subgroup_name}</td>
              </tr>
            )}
          </For>
        </tbody>
        <tfoot>
          <tr class="bg-base-300">
            <th class="rounded-bl-lg"></th>
            <th>Name</th>
            <th>Category</th>
            <th>Group</th>
            <th class="rounded-br-lg">Subgroup</th>
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
            navigator.clipboard.writeText(
              getBlueprint(
                settings,
                recipes.filter((r) => r.selected),
              ),
            );
          }}
        >
          Copy Blueprint
        </button>
      </div>
    </div>
  );
};

export default Page;
