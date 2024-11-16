import {
  addEntity,
  COMPARATOR,
  createEmptyBlueprint,
  encodePlan,
  Entity,
} from "@jensforstmann/factorio-blueprint-tools";
import { Title } from "@solidjs/meta";
import { Component, createEffect, createSignal, For, Show } from "solid-js";
import { createStore, SetStoreFunction } from "solid-js/store";
import {
  CheckboxInput,
  NumberInput,
  SelectInput,
  TextInput,
} from "~/components/inputs";
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
  crafting_speed: number;
  is_burner: boolean;
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

type SourceQuality = {
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

// assign imported data here to let typescript check our assumption (the defined types above)
const VanillaDataChecked: SourceData<EmptyLuaArray> = VanillaDataRaw;

type AppCraftingMachine = SourceCraftingMachine<never> & {
  display_name: string;
};

type AppCategory = {
  name: string;
  machines: Array<AppCraftingMachine>;
  selectedMachine: string;
};

const LogisticModes = [
  "active-provider",
  "passive-provider",
  "storage",
  "buffer",
  "requester",
] as const;
type LogisticMode = (typeof LogisticModes)[number];
const isLogisticMode = (x: unknown): x is LogisticMode =>
  LogisticModes.includes(x as any);

type AppLogisticContainer = SourceEntity & {
  display_name: string;
  logistic_mode: LogisticMode;
};

type AppQuality = SourceQuality & {
  display_name: string;
};

type AppData = {
  recipes: Array<
    SourceRecipe<never> & {
      selected: boolean;
      display_name: string;
      group_display_name: string;
    }
  >;
  items: SourceItem[];
  inserters: Array<
    SourceInserter & {
      display_name: string;
    }
  >;
  logistic_containers: Array<AppLogisticContainer>;
  groups: Array<SourceGroup & { display_name: string }>;
  subgroups: SourceGroup[];
  categories: Array<AppCategory>;
  qualities: Array<AppQuality>;
  settings: Settings;
};

const getLocale = (rawLocales: string, key: string) => {
  return rawLocales
    .split("\n")
    .find((row) => row.startsWith(key + "="))
    ?.split("=", 2)[1];
};

const getBestCraftingMachine = (machines: AppCraftingMachine[]) => {
  let fastest: SourceCraftingMachine<string[]> | undefined;

  machines.forEach((machine) => {
    if (!fastest) {
      fastest = machine;
      return;
    }
    if (fastest.is_burner && !machine.is_burner) {
      fastest = machine; // electrical machines are always better (mostly)
      return;
    }
    if (
      fastest.is_burner === machine.is_burner &&
      machine.crafting_speed > fastest.crafting_speed
    ) {
      fastest = machine;
    }
  });

  return fastest;
};

const convertSourceDataToAppData = (
  data: SourceData<EmptyLuaArray>,
  locales: string,
): AppData => {
  const categoriesSet = new Set<string>();
  data.recipes.forEach((r) => categoriesSet.add(r.category));
  const categories = Array.from(categoriesSet).sort((a, b) =>
    a.localeCompare(b),
  );
  const crafting_machines: AppCraftingMachine[] = !Array.isArray(
    data.crafting_machines,
  )
    ? []
    : data.crafting_machines.map((crafting_machine) => ({
        ...crafting_machine,
        crafting_categories: Array.isArray(crafting_machine.crafting_categories)
          ? crafting_machine.crafting_categories
          : [],
        display_name:
          getLocale(locales, "crafting_machines." + crafting_machine.name) ||
          crafting_machine.name,
      }));

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
    inserters: !Array.isArray(data.inserters)
      ? []
      : data.inserters.map((inserter) => ({
          ...inserter,
          display_name:
            getLocale(locales, "inserters." + inserter.name) || inserter.name,
        })),
    logistic_containers: !Array.isArray(data.logistic_containers)
      ? []
      : data.logistic_containers.map((logistic_container) => {
          if (!isLogisticMode(logistic_container.logistic_mode)) {
            throw new Error(
              `unknown logistic_mode for ${logistic_container.name}`,
            );
          }
          return {
            ...logistic_container,
            logistic_mode: logistic_container.logistic_mode,
            display_name:
              getLocale(
                locales,
                "logistic_containers." + logistic_container.name,
              ) || logistic_container.name,
          };
        }),
    groups: !Array.isArray(data.groups)
      ? []
      : data.groups.map((group) => ({
          ...group,
          display_name:
            getLocale(locales, "groups." + group.name) || group.name,
        })),
    subgroups: !Array.isArray(data.subgroups) ? [] : data.subgroups,
    categories: categories.map((category) => {
      const machines = crafting_machines.filter((machine) =>
        machine.crafting_categories.includes(category),
      );
      return {
        name: category,
        machines: machines,
        selectedMachine: getBestCraftingMachine(machines)?.name ?? "",
      };
    }),
    qualities: !Array.isArray(data.qualities)
      ? []
      : data.qualities.map((quality) => ({
          ...quality,
          display_name:
            getLocale(locales, "qualities." + quality.name) || quality.name,
        })),
    settings: {
      blueprintMaxWidth: 12,
      columnSpace: 0,
      rowSpace: 0,
      sourceChest: {
        name: "requester-chest",
        requestFromBuffers: true,
        trashUnrequested: true,
        limitRequestStacks: 3,
      },
      targetChest: {
        name: "buffer-chest",
        trashUnrequested: true,
        setRequestFilter: true,
      },
      inserter: {
        name: "bulk-inserter",
        setLimit: false,
      },
      outserter: {
        name: "bulk-inserter",
        setLimit: true,
      },
      craftStackLimit: 4,
      productQuality: "normal",
    },
  };
};

const VanillaAppData = convertSourceDataToAppData(
  VanillaDataChecked,
  VanillaLocalesRaw,
);

type Settings = {
  blueprintMaxWidth: number;
  columnSpace: number;
  rowSpace: number;
  sourceChest: {
    name: string;
    trashUnrequested: boolean;
    requestFromBuffers: boolean;
    limitRequestStacks: number;
  };
  targetChest: {
    name: string;
    trashUnrequested: boolean;
    setRequestFilter: boolean;
  };
  inserter: {
    name: string;
    setLimit: boolean;
  };
  outserter: {
    name: string;
    setLimit: boolean;
  };
  craftStackLimit: number;
  productQuality: string;
};

const getItemStackSize = (itemName: string, items: SourceItem[]) => {
  return items.find((i) => i.name === itemName)?.stack_size ?? 1;
};

const getBlueprint = (settings: Settings, appData: AppData): string => {
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

  const inserter = appData.inserters.find(
    (i) => i.name === appData.settings.inserter.name,
  );
  if (!inserter) {
    throw new Error(`Inserter ${appData.settings.inserter.name} not found`);
  }

  const outserter = appData.inserters.find(
    (i) => i.name === appData.settings.outserter.name,
  );
  if (!outserter) {
    throw new Error(`Outserter ${appData.settings.outserter.name} not found`);
  }

  const sourceChest = appData.logistic_containers.find(
    (c) => c.name === appData.settings.sourceChest.name,
  );
  if (!sourceChest) {
    throw new Error(
      `Requester chest ${appData.settings.sourceChest.name} not found`,
    );
  }

  const targetChest = appData.logistic_containers.find(
    (c) => c.name === appData.settings.targetChest.name,
  );
  if (!targetChest) {
    throw new Error(
      `Provider chest ${appData.settings.targetChest.name} not found`,
    );
  }

  const getInserterLimitControlBehavior = (
    main_product: string,
  ): Entity["control_behavior"] => ({
    logistic_condition: {
      first_signal: {
        type: "item",
        name: main_product,
        quality: settings.productQuality,
      },
      constant:
        getItemStackSize(main_product, appData.items) *
        settings.craftStackLimit,
      comparator: COMPARATOR.lessThan,
    },
    connect_to_logistic_network: true,
  });

  let currentX = 0;
  let currentY = 0;
  let currentMaxHeight = 0;

  appData.recipes
    .filter((r) => r.selected)
    .forEach((r) => {
      const category = appData.categories.find((c) => c.name === r.category);
      if (!category) {
        throw new Error(`category ${r.category} not found`);
      }
      const machine = category.machines.find(
        (machine) => machine.name === category.selectedMachine,
      );
      if (!machine) {
        throw new Error(
          `selected machine ${category.selectedMachine} not found for category ${category.name}`,
        );
      }

      const blockWidth = Math.max(
        machine.tile_width,
        Math.max(inserter.tile_width, sourceChest.tile_width) +
          Math.max(outserter.tile_width, targetChest.tile_width),
      );
      const blockHeight =
        machine.tile_height +
        Math.max(
          inserter.tile_height + sourceChest.tile_height,
          outserter.tile_height + targetChest.tile_height,
        );

      if (
        currentX + blockWidth > settings.blueprintMaxWidth &&
        currentX !== 0
      ) {
        currentX = 0;
        currentY += currentMaxHeight + settings.rowSpace;
        currentMaxHeight = 0;
      }

      currentMaxHeight = Math.max(currentMaxHeight, blockHeight);

      addEntity(bp, {
        name: machine.name,
        position: {
          x: currentX + machine.tile_width / 2,
          y: currentY + machine.tile_height / 2,
        },
        recipe: r.name,
        recipe_quality: settings.productQuality,
      });
      if (r.ingredients.length > 0) {
        addEntity(bp, {
          name: settings.inserter.name,
          position: {
            x: currentX + inserter.tile_width / 2,
            y: currentY + machine.tile_height + inserter.tile_height / 2,
          },
          direction: 8,
          control_behavior: settings.inserter.setLimit
            ? getInserterLimitControlBehavior(r.main_product)
            : undefined,
        });
      }
      addEntity(bp, {
        name: settings.outserter.name,
        position: {
          x:
            currentX +
            Math.max(inserter.tile_width, sourceChest.tile_width) +
            outserter.tile_width / 2,
          y: currentY + machine.tile_height + outserter.tile_height / 2,
        },
        control_behavior: settings.outserter.setLimit
          ? getInserterLimitControlBehavior(r.main_product)
          : undefined,
      });
      if (r.ingredients.length > 0) {
        addEntity(bp, {
          name: settings.sourceChest.name,
          position: {
            x: currentX + sourceChest.tile_width / 2,
            y:
              currentY +
              machine.tile_height +
              inserter.tile_height +
              sourceChest.tile_height / 2,
          },
          request_filters: {
            sections: [
              {
                index: 1,
                filters: r.ingredients.map((ing, idx) => ({
                  index: idx + 1,
                  name: ing.name,
                  quality: settings.productQuality,
                  comparator: COMPARATOR.equal,
                  count: Math.max(
                    1,
                    Math.floor(
                      Math.min(
                        getItemStackSize(ing.name, appData.items) *
                          settings.sourceChest.limitRequestStacks,
                        Math.max(
                          ing.amount,
                          (ing.amount *
                            r.request_paste_multiplier *
                            machine.crafting_speed) /
                            r.energy,
                        ),
                      ),
                    ),
                  ),
                })),
              },
            ],
            request_from_buffers: settings.sourceChest.requestFromBuffers,
            trash_not_requested: settings.sourceChest.trashUnrequested,
          },
        });
      }
      addEntity(bp, {
        name: settings.targetChest.name,
        position: {
          x:
            currentX +
            Math.max(inserter.tile_width, sourceChest.tile_width) +
            targetChest.tile_width / 2,
          y:
            currentY +
            machine.tile_height +
            outserter.tile_height +
            targetChest.tile_height / 2,
        },
        request_filters: settings.targetChest.setRequestFilter
          ? {
              sections: [
                {
                  index: 1,
                  filters: [
                    {
                      index: 1,
                      name: r.main_product,
                      quality: settings.productQuality,
                      comparator: COMPARATOR.equal,
                      count: 1_000_000,
                    },
                  ],
                },
              ],
              trash_not_requested: settings.targetChest.trashUnrequested,
            }
          : undefined,
      });

      currentX += blockWidth + settings.columnSpace;
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
  appData: AppData;
  setAppData: SetStoreFunction<AppData>;
}> = (props) => {
  const currentCategories = () => {
    const categories = new Set<string>();
    props.appData.recipes
      .filter((r) => r.selected)
      .forEach((r) => categories.add(r.category));
    return Array.from(categories);
  };
  const getChestByName = (name: string) => {
    return props.appData.logistic_containers.find((lc) => lc.name === name);
  };
  const currentSourceChest = () => {
    return getChestByName(props.appData.settings.sourceChest.name);
  };
  const currentTargetChest = () => {
    return getChestByName(props.appData.settings.targetChest.name);
  };
  return (
    <>
      <h3>Settings</h3>
      <p>Most parameters of the blueprint can be adjusted here.</p>

      <h4>Crafting Machines</h4>
      <Show when={currentCategories().length === 0}>
        Select recipes to produce. Then configure the crafting machines here.
      </Show>
      <div class="grid grid-cols-3 gap-x-4">
        <For each={props.appData.categories}>
          {(category, idx) => (
            <Show when={currentCategories().includes(category.name)}>
              <SelectInput
                label={category.name}
                entries={category.machines.map((machine) => ({
                  label: machine.display_name,
                  value: machine.name,
                }))}
                currentValue={category.selectedMachine}
                setValue={(v) =>
                  props.setAppData("categories", idx(), "selectedMachine", v)
                }
              />
            </Show>
          )}
        </For>
      </div>

      <h4>Products</h4>
      <div class="grid grid-cols-3 gap-x-4">
        <NumberInput
          label="Wanted product amount (in stacks)"
          value={props.appData.settings.craftStackLimit}
          setValue={(v) => props.setAppData("settings", "craftStackLimit", v)}
          min={0}
        />
        <SelectInput
          label="Product quality"
          currentValue={props.appData.settings.productQuality}
          entries={props.appData.qualities.map((q) => ({
            label: q.display_name,
            value: q.name,
          }))}
          setValue={(v) => props.setAppData("settings", "productQuality", v)}
        />
      </div>

      <h4>Layout</h4>
      <div class="grid grid-cols-3 gap-x-4">
        <NumberInput
          label="Blueprint max width (in tiles)"
          value={props.appData.settings.blueprintMaxWidth}
          setValue={(v) => props.setAppData("settings", "blueprintMaxWidth", v)}
          min={0}
        />
        <NumberInput
          label="Space between rows (in tiles)"
          value={props.appData.settings.rowSpace}
          setValue={(v) => props.setAppData("settings", "rowSpace", v)}
          min={0}
        />
        <NumberInput
          label="Space between columns (in tiles)"
          value={props.appData.settings.columnSpace}
          setValue={(v) => props.setAppData("settings", "columnSpace", v)}
          min={0}
        />
      </div>

      <h4>Input Chest</h4>
      <div class="grid grid-cols-3 gap-x-4">
        <SelectInput
          label="Input chest"
          entries={props.appData.logistic_containers
            .filter((c) => ["buffer", "requester"].includes(c.logistic_mode))
            .map((c) => ({
              label: c.display_name,
              value: c.name,
            }))}
          currentValue={props.appData.settings.sourceChest.name}
          setValue={(v) =>
            props.setAppData("settings", "sourceChest", "name", v)
          }
        />
        <CheckboxInput
          label="Trash unrequested"
          value={props.appData.settings.sourceChest.trashUnrequested}
          setValue={(v) =>
            props.setAppData("settings", "sourceChest", "trashUnrequested", v)
          }
        />
        <div></div>
        <NumberInput
          label="Limit requested items (in stacks)"
          value={props.appData.settings.sourceChest.limitRequestStacks}
          setValue={(v) =>
            props.setAppData("settings", "sourceChest", "limitRequestStacks", v)
          }
          min={0}
        />
        <CheckboxInput
          label="Request from buffer chests"
          value={props.appData.settings.sourceChest.requestFromBuffers}
          setValue={(v) =>
            props.setAppData("settings", "sourceChest", "requestFromBuffers", v)
          }
          disabled={(["buffer"] as LogisticMode[]).includes(
            currentSourceChest()?.logistic_mode!,
          )}
        />
      </div>

      <h4>Output Chest</h4>
      <div class="grid grid-cols-3 gap-x-4">
        <SelectInput
          label="Output chest"
          entries={props.appData.logistic_containers
            .filter((c) =>
              [
                "active-provider",
                "buffer",
                "passive-provider",
                "storage",
              ].includes(c.logistic_mode),
            )
            .map((c) => ({
              label: c.display_name,
              value: c.name,
            }))}
          currentValue={props.appData.settings.targetChest.name}
          setValue={(v) =>
            props.setAppData("settings", "targetChest", "name", v)
          }
        />
        <CheckboxInput
          label="Trash unrequested"
          value={props.appData.settings.targetChest.trashUnrequested}
          setValue={(v) =>
            props.setAppData("settings", "targetChest", "trashUnrequested", v)
          }
          disabled={
            !(["buffer"] as LogisticMode[]).includes(
              currentTargetChest()?.logistic_mode!,
            )
          }
        />
        <CheckboxInput
          label="Set request filter for product"
          value={props.appData.settings.targetChest.setRequestFilter}
          setValue={(v) =>
            props.setAppData("settings", "targetChest", "setRequestFilter", v)
          }
          disabled={(
            ["active-provider", "passive-provider"] as LogisticMode[]
          ).includes(currentTargetChest()?.logistic_mode!)}
        />
      </div>

      <h4>Inserter & Outserter</h4>
      <div class="grid grid-cols-3 gap-x-4">
        <SelectInput
          label="Inserter"
          entries={props.appData.inserters.map((i) => ({
            label: i.display_name,
            value: i.name,
          }))}
          currentValue={props.appData.settings.inserter.name}
          setValue={(v) => props.setAppData("settings", "inserter", "name", v)}
        />
        <CheckboxInput
          label="Set inserter limit"
          value={props.appData.settings.inserter.setLimit}
          setValue={(v) =>
            props.setAppData("settings", "inserter", "setLimit", v)
          }
        />
        <div></div>
        <SelectInput
          label="Outserter"
          entries={props.appData.inserters.map((i) => ({
            label: i.display_name,
            value: i.name,
          }))}
          currentValue={props.appData.settings.outserter.name}
          setValue={(v) => props.setAppData("settings", "outserter", "name", v)}
        />
        <CheckboxInput
          label="Set outserter limit"
          value={props.appData.settings.outserter.setLimit}
          setValue={(v) =>
            props.setAppData("settings", "outserter", "setLimit", v)
          }
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
      <Title>
        "Make Everything" Blueprint Generator | Factorio | Gaming Tools
      </Title>
      <div>
        <h2>"Make Everything" Blueprint Generator</h2>
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
              Copy this cheat command and execute it ingame. *
              <br />A file called{" "}
              <code>make-everything-generator-export.meg</code> will be created
              in your{" "}
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
            <p class="text-sm">
              * Executing cheat commands will disable achievements. You can take
              a savegame and reload it afterwards.
            </p>
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
                  {(category) => <option>{category.name}</option>}
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
        <Settings appData={appData} setAppData={setAppData} />
      </div>
      <div class="mt-8">
        <button
          class="btn btn-primary"
          onClick={() => {
            navigator.clipboard.writeText(
              getBlueprint(appData.settings, appData),
            );
          }}
        >
          Generate & Copy Blueprint
        </button>
      </div>
    </div>
  );
};

export default Page;
