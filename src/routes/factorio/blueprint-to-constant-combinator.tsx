import {
  addEntity,
  Blueprint,
  BlueprintBook,
  COMPARATOR,
  createEmptyBlueprint,
  decodePlan,
  DEFINES,
  encodePlan,
  Entity,
  isBlueprint,
  isBlueprintBook,
  ItemFilter,
  Plan,
} from "@jensforstmann/factorio-blueprint-tools";
import { Title } from "@solidjs/meta";
import { createEffect, createSignal, Show } from "solid-js";
import {
  CheckboxInput,
  NumberInput,
  SelectInput,
  TextAreaInput,
} from "~/components/inputs";
import { useSettings } from "~/components/settings";
import {
  FactorioDataImporter,
  getItemToBuild,
  VanillaData,
  VanillaLocales,
} from "./factorioData";
import { createStore } from "solid-js/store";

// make this only for bp2cc
// maximum signals -> only X signals per cc/req
// if requested amounts > chest size: continue with next chest
const convertItemsToRequester = (
  items: {
    name: string;
    quality: string;
    count: number;
  }[],
  data: typeof VanillaData,
  settings: {
    signalLimit: number;
    chestSize: number;
    rocketWeightLimit: number;
  },
): {
  /** only the signals, ignoring the chest size limit */
  pure: Array<ItemFilter & { count: number }>[];
  /** takes chest size limits in account */
  spread: {
    filter: Array<
      ItemFilter & {
        count: number;
      }
    >;
    items: NonNullable<Entity["items"]>;
  }[];
  rockets: Array<{ items: NonNullable<Entity["items"]>; weight: number }>;
} => {
  const getStackSize = (itemName: string) => {
    const dataItem = data.items.find((i) => i.name === itemName);
    if (!dataItem) {
      throw new Error(`Could not get item stafck size for ${itemName}`);
    }
    return dataItem?.stack_size ?? 1;
  };
  /** all the items, may be split across multiple stacks */
  const itemStacks: typeof items = [];
  items.forEach((item) => {
    const stackSize = getStackSize(item.name);
    let rest = item.count;
    while (rest > 0) {
      let count = Math.min(rest, stackSize);
      rest -= count;
      itemStacks.push({
        name: item.name,
        quality: item.quality,
        count: count,
      });
    }
  });

  let currentItemNumber = 0;
  let currentStack = 0;
  let prevItem: string | undefined;
  const combined: ReturnType<typeof convertItemsToRequester>["spread"] = [];
  let currentCombined: (typeof combined)[number];

  const pure: ReturnType<typeof convertItemsToRequester>["pure"] = [];
  let currentPure: (typeof pure)[number];
  let pureItemNumber = 0;

  itemStacks.forEach((item) => {
    if (item.name !== prevItem) {
      currentItemNumber++;
      pureItemNumber++;
    }
    prevItem = item.name;

    if (
      currentItemNumber >= settings.signalLimit || // item limit is reached
      currentStack >= settings.chestSize || // chest is full
      !currentCombined // first iteration
    ) {
      currentItemNumber = 0;
      currentStack = 0;
      currentCombined = {
        filter: [],
        items: [],
      };
      combined.push(currentCombined);
    }

    if (pureItemNumber >= settings.signalLimit || !currentPure) {
      pureItemNumber = 0;
      currentPure = [];
      pure.push(currentPure);
    }

    let existingCurrentCombinedItem = currentCombined.items.find(
      (cci) => cci.id.name === item.name && cci.id.quality === item.quality,
    );
    if (!existingCurrentCombinedItem) {
      existingCurrentCombinedItem = {
        id: {
          name: item.name,
          quality: item.quality,
        },
        items: {
          in_inventory: [],
        },
      };
      currentCombined.items.push(existingCurrentCombinedItem);
    }
    existingCurrentCombinedItem.items.in_inventory!.push({
      inventory: 1,
      stack: currentStack++, // 0-based
      count: item.count,
    });

    let existingFilter = currentCombined.filter.find(
      (crf) => crf.name === item.name && crf.quality === item.quality,
    );
    if (existingFilter) {
      existingFilter.count += item.count;
    } else {
      currentCombined.filter.push({
        index: currentStack, // 1-based
        name: item.name,
        quality: item.quality,
        comparator: COMPARATOR.equal,
        count: item.count,
      });
    }

    let existingPure = currentPure.find(
      (cp) => cp.name === item.name && cp.quality === item.quality,
    );
    if (existingPure) {
      existingPure.count += item.count;
    } else {
      currentPure.push({
        index: currentStack, // 1-based
        name: item.name,
        quality: item.quality,
        comparator: COMPARATOR.equal,
        count: item.count,
      });
    }
  });

  const rockets: ReturnType<typeof convertItemsToRequester>["rockets"] = [];
  const fillOneRocket = (
    rocket: (typeof rockets)[number],
    itemWeight: number,
    stackSize: number,
    item: (typeof items)[number],
    rest: number,
  ) => {
    const weightLeft = settings.rocketWeightLimit - rocket.weight;
    const occupiedStacks = rocket.items.reduce(
      (pv, cv) => pv + cv.items.in_inventory!.length,
      0,
    );
    const emptyStacks = settings.chestSize - occupiedStacks;
    let possibleItemCount = Math.min(
      rest,
      Math.floor(weightLeft / itemWeight),
      emptyStacks * stackSize,
    );
    while (rest > 0 && possibleItemCount > 0) {
      const possibleStackCount = Math.min(rest, possibleItemCount, stackSize);
      rest -= possibleStackCount;
      possibleItemCount -= possibleStackCount;
      let stack = rocket.items.reduce(
        (pv, cv) => pv + cv.items.in_inventory!.length,
        0,
      );
      let itemInInventory = rocket.items.find(
        (i) => i.id.name === item.name && i.id.quality === item.quality,
      );
      if (!itemInInventory) {
        itemInInventory = {
          id: {
            name: item.name,
            quality: item.quality,
          },
          items: {
            in_inventory: [],
          },
        };
        rocket.items.push(itemInInventory);
      }
      itemInInventory.items.in_inventory!.push({
        inventory: 9,
        stack: stack,
        count: possibleStackCount,
      });
      rocket.weight += possibleStackCount * itemWeight;
    }

    return rest;
  };
  const itemsWithWeights = items.map((item) => {
    const itemWeight = data.items.find((i) => i.name === item.name)?.weight;
    if (itemWeight === undefined) {
      throw new Error(`Could not get item weight for ${item.name}`);
    }
    return {
      ...item,
      weight: itemWeight,
    };
  });
  const rocketableItems = itemsWithWeights.filter(
    (item) => item.weight <= settings.rocketWeightLimit,
  );
  const fatItems = itemsWithWeights.filter(
    (item) => item.weight > settings.rocketWeightLimit,
  );
  fatItems.forEach((fatItem) => {
    const recipes = data.recipes.filter((r) => r.main_product === fatItem.name);
    const possibleRecipes = recipes.filter((r) =>
      r.ingredients.reduce(
        (pv, cv) =>
          pv &&
          (data.items.find((i) => i.name === cv.name)?.weight ??
            Number.MAX_SAFE_INTEGER) <= settings.rocketWeightLimit,
        true,
      ),
    );
    possibleRecipes[0]?.ingredients.forEach((ing) => {
      const existingRocketableItem = rocketableItems.find(
        (i) => i.name === ing.name && i.quality === fatItem.quality,
      );
      if (!existingRocketableItem) {
        rocketableItems.push({
          name: ing.name,
          quality: fatItem.quality,
          weight: data.items.find((i) => i.name === ing.name)!.weight,
          count: fatItem.count * ing.amount,
        });
      } else {
        existingRocketableItem.count += fatItem.count * ing.amount;
      }
      console.info(
        `Add ${fatItem.count * ing.amount} ${fatItem.quality} ${ing.name} for ${fatItem.count} non shippable ${fatItem.quality} ${fatItem.name}`,
      );
    });
  });
  rocketableItems.forEach((item) => {
    const itemWeight = data.items.find((i) => i.name === item.name)?.weight;
    if (itemWeight === undefined) {
      throw new Error(`Could not get item weight for ${item.name}`);
    }
    if (itemWeight > settings.rocketWeightLimit) {
      throw new Error(`Item ${item.name} does not fit into a rocket`);
    }
    const stackSize = getStackSize(item.name);
    let rest = item.count;
    while (rest > 0) {
      // fill available rockets
      rockets.forEach((rocket) => {
        rest = fillOneRocket(rocket, itemWeight, stackSize, item, rest);
      });

      // create new rockets
      while (rest > 0) {
        const newRocket: (typeof rockets)[number] = {
          items: [],
          weight: 0,
        };
        rockets.push(newRocket);
        const newRest = fillOneRocket(
          newRocket,
          itemWeight,
          stackSize,
          item,
          rest,
        );
        if (newRest === rest) {
          throw new Error(`Filling a new rocket with items was not possible.`);
        }
        rest = newRest;
      }
    }
  });

  return {
    pure: pure,
    spread: combined,
    rockets: rockets,
  };
};

type ItemToBuild = {
  name: string;
  quality: string;
  count: number;
};

const convert = (
  inputBp: string,
  settings: Settings,
  factorioData: typeof VanillaData,
): string => {
  const startTime = Date.now();
  try {
    const items: ItemToBuild[] = [];

    const processPlan = (bp: Plan) => {
      if (isBlueprintBook(bp)) {
        processBook(bp);
      } else if (isBlueprint(bp)) {
        processBp(bp);
      }
    };
    const processBook = (book: BlueprintBook) => {
      book.blueprint_book.blueprints?.forEach((bp) => processPlan(bp));
    };
    const processBp = (bp: Blueprint) => {
      bp.blueprint.entities?.forEach((entity) => {
        const itemToBuild = getItemToBuild(factorioData, "entity", entity.name);
        if (!itemToBuild) {
          throw new Error(
            `Could not find item to build entity ${entity.name}`,
          );
        }
        addToItems(
          itemToBuild.name,
          itemToBuild.count,
          entity.quality ?? "normal",
        );
        entity.items?.forEach((item) => {
          // modules
          const count =
            item.items.in_inventory?.reduce(
              (acc, x) => acc + (x.count ?? 1),
              0,
            ) ?? 0;
          addToItems(item.id.name, count, item.id.quality ?? "normal");
        });
      });
      bp.blueprint.tiles?.forEach((tile) => {
        const itemToBuild = getItemToBuild(factorioData, "tile", tile.name);
        if (!itemToBuild) {
          throw new Error(`Could not find item to build entity ${tile.name}`);
        }
        addToItems(itemToBuild.name, itemToBuild.count, "normal");
      });
    };
    const addToItems = (name: string, count: number, quality: string) => {
      if (count === 0) {
        return;
      }
      const existing = items.find(
        (item) => item.name === name && item.quality === quality,
      );
      if (existing) {
        existing.count += count;
      } else {
        items.push({
          name: name,
          quality: quality,
          count: count,
        });
      }
    };

    processPlan(decodePlan(inputBp));
    items.sort((a, b) => Math.abs(b.count) - Math.abs(a.count));

    const blueprint = createEmptyBlueprint();
    blueprint.blueprint.icons = [
      {
        signal: {
          type: "item",
          name: "constant-combinator",
        },
        index: 1,
      },
    ];
    blueprint.blueprint.wires = [];

    const container =
      settings.generationMode === "ROCKET_SILOS"
        ? factorioData.rocket_silos.find(
            (rs) => rs.name === settings.rocketSiloName,
          )
        : factorioData.logistic_containers.find(
            (c) => c.name === settings.logisticChestName,
          );
    if (!container) {
      throw new Error(
        `Could not get container ${settings.generationMode === "ROCKET_SILOS" ? settings.rocketSiloName : settings.logisticChestName}`,
      );
    }

    const chestSize = !settings.accountForInventorySize
      ? 1_000_000
      : container.inventory_sizes[settings.quality];
    if (!chestSize) {
      throw new Error(
        `Could not get container inventory size for ${settings.quality} ${settings.generationMode === "ROCKET_SILOS" ? settings.rocketSiloName : settings.logisticChestName}, got ${chestSize}`,
      );
    }

    const reallyChunked = convertItemsToRequester(items, factorioData, {
      chestSize: chestSize,
      signalLimit:
        settings.signalLimit <= 0
          ? Number.MAX_SAFE_INTEGER
          : settings.signalLimit,
      rocketWeightLimit: factorioData.rocket_silos[0].lift_weight || 1_000_000,
    });

    const unitWidth =
      settings.generationMode === "CONSTANT_COMBINATORS_AND_CHESTS" ||
      settings.generationMode === "CHESTS" ||
      settings.generationMode === "ROCKET_SILOS"
        ? container.tile_width
        : 1;
    const unitHeight =
      settings.generationMode === "ROCKET_SILOS"
        ? container.tile_height
        : settings.generationMode === "CONSTANT_COMBINATORS_AND_CHESTS"
          ? container.tile_height + 1
          : settings.generationMode === "CHESTS"
            ? container.tile_height
            : 1;
    const area =
      unitWidth *
      unitHeight *
      (settings.generationMode === "ROCKET_SILOS"
        ? reallyChunked.rockets.length
        : reallyChunked.spread.length);
    const sqrt = Math.sqrt(area);
    const unitsPerLine = Math.ceil(sqrt / unitWidth);

    if (settings.generationMode === "ROCKET_SILOS") {
      reallyChunked.rockets.forEach(({ items }, index) => {
        const line =
          settings.outputPlacement === "SQUARE"
            ? Math.floor(index / unitsPerLine)
            : 0;
        const posInLine =
          settings.outputPlacement === "SQUARE" ? index % unitsPerLine : index;
        addEntity(blueprint, {
          name: settings.rocketSiloName,
          quality: settings.quality,
          position: {
            x: unitWidth * posInLine + unitWidth / 2,
            y: line * unitHeight + unitHeight / 2,
          },
          items: items,
        });
      });
    } else {
      // fake logistic chest == will get requests for constructions bots
      const logisticMode = factorioData.logistic_containers.find(
        (c) => c.name === settings.logisticChestName,
      )?.logistic_mode;
      const isFakeLogisticChest =
        logisticMode === undefined ||
        (logisticMode !== "buffer" && logisticMode !== "requester");

      reallyChunked.spread.forEach(({ filter, items }, index) => {
        let constantCombinator: Entity | undefined = undefined;
        let containerEntity: Entity | undefined = undefined;
        const line =
          settings.outputPlacement === "SQUARE"
            ? Math.floor(index / unitsPerLine)
            : 0;
        const posInLine =
          settings.outputPlacement === "SQUARE" ? index % unitsPerLine : index;

        if (
          settings.generationMode === "CONSTANT_COMBINATORS" ||
          settings.generationMode === "CONSTANT_COMBINATORS_AND_CHESTS"
        ) {
          constantCombinator = addEntity(blueprint, {
            name: "constant-combinator",
            position: {
              x: unitWidth * posInLine + 0.5,
              y: line * unitHeight + 0.5,
            },
            control_behavior: {
              sections: {
                sections: [
                  {
                    index: 1,
                    filters: filter.map((f, index) => ({
                      index: index + 1,
                      name: f.name,
                      quality: f.quality,
                      comparator: COMPARATOR.equal,
                      count: settings.negateConstantCombinatorSignals
                        ? -f.count
                        : f.count,
                    })),
                  },
                ],
              },
            },
          });
        }

        if (
          settings.generationMode === "CHESTS" ||
          settings.generationMode === "CONSTANT_COMBINATORS_AND_CHESTS"
        ) {
          containerEntity = addEntity(blueprint, {
            name: settings.logisticChestName,
            quality: settings.quality,
            position: {
              x: unitWidth * posInLine + unitWidth / 2,
              y: line * unitHeight + 1 + container.tile_height / 2,
            },
            request_filters: isFakeLogisticChest
              ? undefined
              : {
                  request_from_buffers: settings.requestFromBuffers,
                  trash_not_requested: settings.trashUnrequested,
                  sections:
                    settings.generationMode !== "CHESTS"
                      ? undefined
                      : [
                          {
                            index: 1,
                            filters: filter.map((f, index) => ({
                              index: index + 1,
                              name: f.name,
                              quality: f.quality,
                              comparator: COMPARATOR.equal,
                              count: settings.negateConstantCombinatorSignals
                                ? -f.count
                                : f.count,
                            })),
                          },
                        ],
                },
            items: !isFakeLogisticChest ? undefined : items,
          });
        }

        if (constantCombinator && containerEntity) {
          containerEntity.control_behavior = {
            circuit_mode_of_operation: 1,
            circuit_condition_enabled: false,
          };
          // add green wire
          blueprint.blueprint.wires!.push([
            constantCombinator.entity_number,
            DEFINES.wire_connector_id.circuit_green,
            containerEntity.entity_number,
            DEFINES.wire_connector_id.circuit_green,
          ]);
        }
      });
    }

    return encodePlan(blueprint);
  } catch (err) {
    console.warn(err);
    return err + "";
  } finally {
    console.info(`conver() took ${Date.now() - startTime} ms,`);
  }
};

const HelpSection = () => {
  return (
    <div class="collapse collapse-arrow bg-base-200">
      <input type="checkbox" />
      <div class="collapse-title font-semibold">Help / Example</div>
      <div class="collapse-content">
        <img src="/images/blueprint-to-constant-combinator-blueprint.png" />
        <p>
          Export Blueprint String and paste into the Input Blueprint String
          field.
        </p>

        <p>
          Copy the Output Blueprint String and import into Factorio. Result:
        </p>
        <img src="/images/blueprint-to-constant-combinator-outcome.png" />
        <img src="/images/blueprint-to-constant-combinator-requester.png" />
      </div>
    </div>
  );
};

type Settings = {
  generationMode:
    | "CONSTANT_COMBINATORS"
    | "CHESTS"
    | "CONSTANT_COMBINATORS_AND_CHESTS"
    | "ROCKET_SILOS";
  outputPlacement: "LINE" | "SQUARE";
  signalLimit: number;
  negateConstantCombinatorSignals: boolean;
  trashUnrequested: boolean;
  requestFromBuffers: boolean;
  logisticChestName: string;
  quality: string;
  rocketSiloName: string;
  accountForInventorySize: boolean;
};

const Page = () => {
  const [appData, setAppData] = createStore({
    data: VanillaData,
    locales: VanillaLocales,
  });
  const [inputBp, setInputBp] = createSignal("");

  const [settings, setSettings] = useSettings<Settings>({
    generationMode: "CONSTANT_COMBINATORS",
    outputPlacement: "LINE",
    signalLimit: 1,
    negateConstantCombinatorSignals: false,
    trashUnrequested: false,
    requestFromBuffers: false,
    logisticChestName: "requester-chest",
    rocketSiloName: "rocket-silo",
    quality: "normal",
    accountForInventorySize: true,
  });

  const [outputBp, setOutputBp] = createSignal("");

  createEffect(() => {
    setOutputBp(convert(inputBp(), settings, appData.data));
  });

  return (
    <div class="w-full max-w-4xl m-auto prose">
      <Title>Blueprint to Constant Combinator | Factorio | Gaming Tools</Title>
      <div>
        <h2>Blueprint to Constant Combinator/Chest/Rocket Silo</h2>
        <p>
          Convert a Factorio blueprint string to constant combinators holding
          the signals of items needed to build the blueprint. It's also possible
          to directly generalte logistic (requester/buffer) chests.
          <br />
          You don't have the logistic system unlocked, yet? Don't worry. Non
          logistic chests are also supported. They will be filled by
          constructions bots instead.
          <br />
          Wan't to travel to another planet? Generate perfectly filled rocket
          silos, too.
        </p>
      </div>
      <div class="h-8"></div>
      <HelpSection />
      <FactorioDataImporter
        onChange={(data, locales) => {
          setAppData({
            data: data,
            locales: locales,
          });
        }}
      />
      <div class="my-8">
        <TextAreaInput
          label="Input Blueprint String"
          value={inputBp()}
          setValue={(v) => setInputBp(v)}
        />
        <div class="grid grid-cols-3 gap-x-4">
          <div class="col-span-2">
            <SelectInput
              label="Generation mode"
              currentValue={settings.generationMode}
              setValue={(v) => setSettings("generationMode", v)}
              entries={
                [
                  {
                    label: "Only constant combinators",
                    value: "CONSTANT_COMBINATORS",
                  },
                  {
                    label: "Only chests",
                    value: "CHESTS",
                  },
                  {
                    label: "Constant combinators and chests",
                    value: "CONSTANT_COMBINATORS_AND_CHESTS",
                  },
                  {
                    label: "Rocket silos",
                    value: "ROCKET_SILOS",
                  },
                ] satisfies Array<{
                  label: string;
                  value: Settings["generationMode"];
                }>
              }
              class="w-full"
            />
          </div>
          <SelectInput
            label="Output placement"
            currentValue={settings.outputPlacement}
            setValue={(v) => setSettings("outputPlacement", v)}
            entries={[
              {
                label: "Line",
                value: "LINE",
              },
              {
                label: "Square",
                value: "SQUARE",
              },
            ]}
            class="w-full"
          />
          <NumberInput
            label={"Maximum items per entity"}
            value={settings.signalLimit}
            setValue={(v) => setSettings("signalLimit", v)}
            min={0}
            step={1}
          />
          <CheckboxInput
            label="Account for inventory size"
            value={settings.accountForInventorySize}
            setValue={(v) => {
              setSettings("accountForInventorySize", v);
            }}
          />
          <CheckboxInput
            label="Negative amounts"
            value={settings.negateConstantCombinatorSignals}
            setValue={(v) => {
              setSettings("negateConstantCombinatorSignals", v);
            }}
          />
          <Show when={settings.generationMode !== "ROCKET_SILOS"}>
            <SelectInput
              label="Chest"
              currentValue={settings.logisticChestName}
              setValue={(v) => setSettings("logisticChestName", v)}
              entries={appData.data.logistic_containers.map((c) => ({
                label: appData.locales["logistic_containers." + c.name],
                value: c.name,
              }))}
            />
          </Show>
          <Show when={settings.generationMode === "ROCKET_SILOS"}>
            <SelectInput
              label="Rocket silo"
              currentValue={settings.rocketSiloName}
              setValue={(v) => setSettings("rocketSiloName", v)}
              entries={appData.data.rocket_silos.map((rs) => ({
                label: appData.locales["rocket_silos." + rs.name],
                value: rs.name,
              }))}
            />
          </Show>
          <div class="col-span-2">
            <SelectInput
              label="Quality"
              currentValue={settings.quality}
              entries={appData.data.qualities.map((q) => ({
                label: appData.locales["qualities." + q.name],
                value: q.name,
              }))}
              setValue={(v) => setSettings("quality", v)}
            />
          </div>
          <CheckboxInput
            label="Trash unrequested"
            value={settings.trashUnrequested}
            setValue={(v) => {
              setSettings("trashUnrequested", v);
            }}
            disabled={settings.generationMode === "CONSTANT_COMBINATORS"}
          />
          <CheckboxInput
            label="Request from buffer chests"
            value={settings.requestFromBuffers}
            setValue={(v) => {
              setSettings("requestFromBuffers", v);
            }}
            disabled={settings.generationMode === "CONSTANT_COMBINATORS"}
          />
        </div>
        <TextAreaInput
          label="Output Blueprint String"
          value={inputBp() === "" ? "" : outputBp()}
        />
        <div
          class="btn my-4 btn-primary w-full"
          onMouseDown={() => navigator.clipboard.writeText(outputBp())}
        >
          Copy
        </div>
      </div>
    </div>
  );
};

export default Page;
