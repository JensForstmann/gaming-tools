import {
  addEntity,
  COMPARATOR,
  createEmptyBlueprint,
  DEFINES,
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
import { useSettings } from "~/components/settings";
import {
  FactorioDataImporter,
  Locales,
  type SourceCraftingMachine,
  type SourceEntityWithSize,
  type SourceGroup,
  type SourceInserter,
  type SourceItem,
  type SourceQuality,
  type SourceRecipe,
  VanillaData,
  VanillaLocales,
} from "./factorioData";

type AppCraftingMachine = SourceCraftingMachine<never> & {
  display_name: string;
};

type AppCategory = {
  name: string;
  machines: Array<AppCraftingMachine>;
};

const LogisticModes = [
  "active-provider",
  "passive-provider",
  "storage",
  "buffer",
  "requester",
  "none",
] as const;
type LogisticMode = (typeof LogisticModes)[number];
const isLogisticMode = (x: unknown): x is LogisticMode =>
  x === undefined || LogisticModes.includes(x as any);

type AppLogisticContainer = SourceEntityWithSize & {
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
  data: typeof VanillaData,
  locales: Locales,
): AppData => {
  const categoriesSet = new Set<string>();
  data.recipes.forEach((r) => categoriesSet.add(r.category));
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
          locales["crafting_machines." + crafting_machine.name] ||
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
          display_name: locales["recipes." + recipe.name] || recipe.name,
          group_display_name:
            locales["groups." + recipe.group_name] || recipe.group_name,
        })),
    items: !Array.isArray(data.items) ? [] : data.items,
    inserters: !Array.isArray(data.inserters)
      ? []
      : data.inserters.map((inserter) => ({
          ...inserter,
          display_name: locales["inserters." + inserter.name] || inserter.name,
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
            logistic_mode: logistic_container.logistic_mode ?? "none",
            display_name:
              locales["logistic_containers." + logistic_container.name] ||
              logistic_container.name,
          };
        }),
    groups: !Array.isArray(data.groups)
      ? []
      : data.groups.map((group) => ({
          ...group,
          display_name: locales["groups." + group.name] || group.name,
        })),
    subgroups: !Array.isArray(data.subgroups) ? [] : data.subgroups,
    categories: Array.from(categoriesSet)
      .sort((a, b) => a.localeCompare(b))
      .map((category) => {
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
          display_name: locales["qualities." + quality.name] || quality.name,
        })),
  };
};

const VanillaAppData = convertSourceDataToAppData(VanillaData, VanillaLocales);

type Settings = {
  selectedMachines: Array<{ category: string; machine: string }>;
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

const DefaultSettings: Settings = {
  selectedMachines: VanillaAppData.categories.map((category) => ({
    category: category.name,
    machine: getBestCraftingMachine(category.machines)?.name ?? "",
  })),
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
    (i) => i.name === settings.inserter.name,
  );
  if (!inserter) {
    throw new Error(`Inserter ${settings.inserter.name} not found`);
  }

  const outserter = appData.inserters.find(
    (i) => i.name === settings.outserter.name,
  );
  if (!outserter) {
    throw new Error(`Outserter ${settings.outserter.name} not found`);
  }

  const sourceChest = appData.logistic_containers.find(
    (c) => c.name === settings.sourceChest.name,
  );
  if (!sourceChest) {
    throw new Error(`Requester chest ${settings.sourceChest.name} not found`);
  }

  const targetChest = appData.logistic_containers.find(
    (c) => c.name === settings.targetChest.name,
  );
  if (!targetChest) {
    throw new Error(`Provider chest ${settings.targetChest.name} not found`);
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
      const selectedMachineName = settings.selectedMachines.find(
        (entry) => entry.category === category.name,
      )?.machine;
      if (!selectedMachineName) {
        throw new Error(
          `no selected machine found for category ${category.name}`,
        );
      }
      const machine = category.machines.find(
        (machine) => machine.name === selectedMachineName,
      );
      if (!machine) {
        throw new Error(
          `selected machine ${selectedMachineName} not found for category ${category.name}`,
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
          direction: DEFINES.direction.south,
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
        const ingredients = r.ingredients.map((ing) => ({
          name: ing.name,
          quality: settings.productQuality,
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
        }));

        const items: Entity["items"] = [];
        if (
          appData.logistic_containers.find(
            (c) => c.name === settings.sourceChest.name,
          )?.logistic_mode === "none"
        ) {
          let stack = 0;
          ingredients.forEach((ing) => {
            let rest = ing.count;
            const stackSize =
              appData.items.find((i) => i.name === ing.name)?.stack_size ?? 1;
            while (rest > 0) {
              let count = Math.min(rest, stackSize);
              rest -= count;
              items.push({
                id: {
                  name: ing.name,
                  quality: ing.quality,
                },
                items: {
                  in_inventory: [
                    {
                      inventory: 1,
                      stack: stack++,
                      count: count,
                    },
                  ],
                },
              });
            }
          });
        }

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
          request_filters:
            appData.logistic_containers.find(
              (c) => c.name === settings.sourceChest.name,
            )?.logistic_mode === "none"
              ? undefined
              : {
                  sections: [
                    {
                      index: 1,
                      filters: ingredients.map((ing, idx) => ({
                        index: idx + 1,
                        name: ing.name,
                        quality: ing.quality,
                        comparator: COMPARATOR.equal,
                        count: ing.count,
                      })),
                    },
                  ],
                  request_from_buffers: settings.sourceChest.requestFromBuffers,
                  trash_not_requested: settings.sourceChest.trashUnrequested,
                },
          items:
            appData.logistic_containers.find(
              (c) => c.name === settings.sourceChest.name,
            )?.logistic_mode !== "none"
              ? undefined
              : items,
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
      <div class="collapse-title font-semibold">Help / Example</div>
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
  appData: AppData;
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
    return getChestByName(props.settings.sourceChest.name);
  };
  const currentTargetChest = () => {
    return getChestByName(props.settings.targetChest.name);
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
                currentValue={
                  props.settings.selectedMachines.find(
                    (entry) => entry.category === category.name,
                  )?.machine
                }
                setValue={(v) => {
                  const index = props.settings.selectedMachines.findIndex(
                    (entry) => entry.category === category.name,
                  );
                  if (index >= 0) {
                    props.setSettings("selectedMachines", index, "machine", v);
                  }
                }}
              />
            </Show>
          )}
        </For>
      </div>

      <h4>Products</h4>
      <div class="grid grid-cols-3 gap-x-4">
        <NumberInput
          label="Wanted amount (in stacks)"
          value={props.settings.craftStackLimit}
          setValue={(v) => props.setSettings("craftStackLimit", v)}
          min={0}
        />
        <SelectInput
          label="Product quality"
          currentValue={props.settings.productQuality}
          entries={props.appData.qualities.map((q) => ({
            label: q.display_name,
            value: q.name,
          }))}
          setValue={(v) => props.setSettings("productQuality", v)}
        />
      </div>

      <h4>Layout</h4>
      <div class="grid grid-cols-3 gap-x-4">
        <NumberInput
          label="Blueprint max width (in tiles)"
          value={props.settings.blueprintMaxWidth}
          setValue={(v) => props.setSettings("blueprintMaxWidth", v)}
          min={0}
        />
        <NumberInput
          label="Space between rows (in tiles)"
          value={props.settings.rowSpace}
          setValue={(v) => props.setSettings("rowSpace", v)}
          min={0}
        />
        <NumberInput
          label="Space between columns (in tiles)"
          value={props.settings.columnSpace}
          setValue={(v) => props.setSettings("columnSpace", v)}
          min={0}
        />
      </div>

      <h4>Input Chest</h4>
      <div class="grid grid-cols-3 gap-x-4">
        <SelectInput
          label="Input chest"
          entries={props.appData.logistic_containers
            .filter((c) =>
              ["buffer", "requester", "none"].includes(c.logistic_mode),
            )
            .map((c) => ({
              label: c.display_name,
              value: c.name,
            }))}
          currentValue={props.settings.sourceChest.name}
          setValue={(v) => props.setSettings("sourceChest", "name", v)}
        />
        <CheckboxInput
          label="Trash unrequested"
          value={props.settings.sourceChest.trashUnrequested}
          setValue={(v) =>
            props.setSettings("sourceChest", "trashUnrequested", v)
          }
        />
        <div></div>
        <NumberInput
          label="Limit requested items (in stacks)"
          value={props.settings.sourceChest.limitRequestStacks}
          setValue={(v) =>
            props.setSettings("sourceChest", "limitRequestStacks", v)
          }
          min={0}
        />
        <CheckboxInput
          label="Request from buffer chests"
          value={props.settings.sourceChest.requestFromBuffers}
          setValue={(v) =>
            props.setSettings("sourceChest", "requestFromBuffers", v)
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
          currentValue={props.settings.targetChest.name}
          setValue={(v) => props.setSettings("targetChest", "name", v)}
        />
        <CheckboxInput
          label="Trash unrequested"
          value={props.settings.targetChest.trashUnrequested}
          setValue={(v) =>
            props.setSettings("targetChest", "trashUnrequested", v)
          }
          disabled={
            !(["buffer"] as LogisticMode[]).includes(
              currentTargetChest()?.logistic_mode!,
            )
          }
        />
        <CheckboxInput
          label="Set request filter for product"
          value={props.settings.targetChest.setRequestFilter}
          setValue={(v) =>
            props.setSettings("targetChest", "setRequestFilter", v)
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
          currentValue={props.settings.inserter.name}
          setValue={(v) => props.setSettings("inserter", "name", v)}
        />
        <CheckboxInput
          label="Set inserter limit"
          value={props.settings.inserter.setLimit}
          setValue={(v) => props.setSettings("inserter", "setLimit", v)}
        />
        <div></div>
        <SelectInput
          label="Outserter"
          entries={props.appData.inserters.map((i) => ({
            label: i.display_name,
            value: i.name,
          }))}
          currentValue={props.settings.outserter.name}
          setValue={(v) => props.setSettings("outserter", "name", v)}
        />
        <CheckboxInput
          label="Set outserter limit"
          value={props.settings.outserter.setLimit}
          setValue={(v) => props.setSettings("outserter", "setLimit", v)}
        />
      </div>
    </>
  );
};

const Page = () => {
  let globalCheckbox: HTMLInputElement | undefined;

  const [appData, setAppData] = createStore<AppData>(VanillaAppData);
  const [settings, setSettings] = useSettings(DefaultSettings);

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
    <>
      <div class="w-full max-w-4xl m-auto prose">
        <Title>
          "Make Everything" Blueprint Generator | Factorio | Gaming Tools
        </Title>
        <div>
          <h2>"Make Everything" Blueprint Generator</h2>
          <p>
            This tool can be used to build bot based malls/hubs. Just pick the
            recipes you want to craft, select your machines, qualities and more
            and you're good to go.
            <br />
            You don't have the logistic system unlocked, yet? Don't worry. Non
            logistic chests are also supported. They will be filled by
            constructions bots instead.
          </p>
        </div>
        <div class="h-8"></div>
        <HelpSection />
        <FactorioDataImporter
          onChange={(data, locales) => {
            setAppData(convertSourceDataToAppData(data, locales));
            resetSearchAndFilters();
          }}
        />
      </div>
      <div class="w-full max-w-4xl m-auto mb-48">
        <table class="table table-md w-full mt-8 table-pin-rows">
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
        <div class="mt-8 prose w-full max-w-4xl m-auto">
          <Settings
            settings={settings}
            setSettings={setSettings}
            appData={appData}
          />
        </div>
        <div class="mt-8">
          <button
            class="btn btn-primary"
            onClick={() => {
              navigator.clipboard.writeText(getBlueprint(settings, appData));
            }}
          >
            Generate & Copy Blueprint
          </button>
        </div>
      </div>
    </>
  );
};

export default Page;
