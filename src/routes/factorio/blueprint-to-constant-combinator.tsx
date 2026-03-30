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
import { createEffect, createSignal } from "solid-js";
import { itemMapping } from "./item-mapping";
import {
  CheckboxInput,
  NumberInput,
  SelectInput,
  TextAreaInput,
} from "~/components/inputs";
import { useSettings } from "~/components/settings";
import {
  FactorioDataImporter,
  SourceLogisticContainer,
  SourceRocketSilo,
  VanillaData,
  VanillaLocales,
} from "./factorioData";
import { createStore } from "solid-js/store";

const convertToItem = (entity: string) => {
  return {
    item: itemMapping[entity]?.item ?? entity,
    count: itemMapping[entity]?.count ?? 1,
  };
};

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
  containers: Array<SourceRocketSilo & SourceLogisticContainer>,
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
        const { item, count } = convertToItem(entity.name);
        addToItems(item, count, entity.quality ?? "normal");
        entity.items?.forEach((item) => {
          // modules
          const count = item.items.in_inventory?.length ?? 0;
          addToItems(item.id.name, count, item.id.quality ?? "normal");
        });
      });
      bp.blueprint.tiles?.forEach((tile) => {
        const { item, count } = convertToItem(tile.name);
        addToItems(item, count, "normal");
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

    const logisticChest = containers.find(
      (c) => c.name === settings.logisticChestName,
    );
    if (!logisticChest) {
      throw new Error(`Could not get container ${settings.logisticChestName}`);
    }

    const chestSize = !settings.accountForInventorySize
      ? 1_000_000
      : logisticChest.inventory_sizes[settings.logisticChestQuality];
    if (!chestSize) {
      throw new Error(
        `Could not get container inventory size for ${settings.logisticChestQuality} ${settings.logisticChestName}, got ${chestSize}`,
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

    /* Possible scenarions:
        Option A: only CC, no chest limits
        Option B: only CC, with chest limits
        Option C: only Chest, no chest limits ~ (makes no sense)
        Option D: only Chest, with chest limits
        Option E: CC+Chest, no chest limits ~ (makes no sense)
        Option F: CC+Chest, with chest limits
    */

    const isRocketSilo =
      factorioData.rocket_silos.findIndex(
        (s) => s.name === settings.logisticChestName,
      ) > -1;

    const unitWidth =
      settings.generationMode === "BOTH" ||
      settings.generationMode === "LOGISTIC_CHESTS" ||
      isRocketSilo
        ? logisticChest.tile_width
        : 1;
    const unitHeight = isRocketSilo
      ? logisticChest.tile_height
      : settings.generationMode === "BOTH"
        ? logisticChest.tile_height + 1
        : settings.generationMode === "LOGISTIC_CHESTS"
          ? logisticChest.tile_height
          : 1;
    const area =
      unitWidth *
      unitHeight *
      (isRocketSilo
        ? reallyChunked.rockets.length
        : reallyChunked.spread.length);
    const sqrt = Math.sqrt(area);
    const unitsPerLine = Math.ceil(sqrt / unitWidth);

    if (isRocketSilo) {
      reallyChunked.rockets.forEach(({ items }, index) => {
        const line =
          settings.outputPlacement === "SQUARE"
            ? Math.floor(index / unitsPerLine)
            : 0;
        const posInLine =
          settings.outputPlacement === "SQUARE" ? index % unitsPerLine : index;
        addEntity(blueprint, {
          name: settings.logisticChestName,
          quality: settings.logisticChestQuality,
          position: {
            x: unitWidth * posInLine + unitWidth / 2,
            y: line * unitHeight + unitHeight / 2,
          },
          items: items,
        });
      });
    } else {
      // fake logistic chest == will get requests for constructions bots
      const isFakeLogisticChest =
        logisticChest.logistic_mode === undefined ||
        !["buffer", "requester"].includes(logisticChest.logistic_mode);

      reallyChunked.spread.forEach(({ filter, items }, index) => {
        let constantCombinator: Entity | undefined = undefined;
        let requesterChest: Entity | undefined = undefined;
        const line =
          settings.outputPlacement === "SQUARE"
            ? Math.floor(index / unitsPerLine)
            : 0;
        const posInLine =
          settings.outputPlacement === "SQUARE" ? index % unitsPerLine : index;

        if (
          settings.generationMode === "CONSTANT_COMBINATORS" ||
          settings.generationMode === "BOTH"
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
          settings.generationMode === "LOGISTIC_CHESTS" ||
          settings.generationMode === "BOTH"
        ) {
          requesterChest = addEntity(blueprint, {
            name: settings.logisticChestName,
            quality: settings.logisticChestQuality,
            position: {
              x: unitWidth * posInLine + unitWidth / 2,
              y: line * unitHeight + 1 + logisticChest.tile_height / 2,
            },
            request_filters: isFakeLogisticChest
              ? undefined
              : {
                  request_from_buffers: settings.requestFromBuffers,
                  trash_not_requested: settings.trashUnrequested,
                  sections:
                    settings.generationMode !== "LOGISTIC_CHESTS"
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

        if (constantCombinator && requesterChest) {
          requesterChest.control_behavior = {
            circuit_mode_of_operation: 1,
            circuit_condition_enabled: false,
          };
          // add green wire
          blueprint.blueprint.wires!.push([
            constantCombinator.entity_number,
            DEFINES.wire_connector_id.circuit_green,
            requesterChest.entity_number,
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
  generationMode: "CONSTANT_COMBINATORS" | "LOGISTIC_CHESTS" | "BOTH";
  outputPlacement: "LINE" | "SQUARE";
  signalLimit: number;
  negateConstantCombinatorSignals: boolean;
  trashUnrequested: boolean;
  requestFromBuffers: boolean;
  logisticChestName: string;
  logisticChestQuality: string;
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
    logisticChestQuality: "normal",
    accountForInventorySize: true,
  });

  const [outputBp, setOutputBp] = createSignal("");

  const logisticChests = () => {
    const chests: Array<
      SourceRocketSilo & SourceLogisticContainer & { locale: string }
    > = [];
    appData.data.logistic_containers.forEach((v) => {
      chests.push({
        name: v.name,
        locale: appData.locales["logistic_containers." + v.name] || v.name,
        inventory_sizes: v.inventory_sizes,
        lift_weight: Number.MAX_SAFE_INTEGER,
        tile_height: v.tile_height,
        tile_width: v.tile_width,
        logistic_mode: v.logistic_mode,
      });
    });
    appData.data.rocket_silos.forEach((v) => {
      chests.push({
        name: v.name,
        locale: appData.locales["rocket_silos." + v.name] || v.name,
        inventory_sizes: v.inventory_sizes,
        lift_weight: v.lift_weight,
        tile_height: v.tile_height,
        tile_width: v.tile_width,
        logistic_mode: undefined,
      });
    });
    return chests;
  };

  createEffect(() => {
    setOutputBp(convert(inputBp(), settings, logisticChests(), appData.data));
  });

  return (
    <div class="w-full max-w-4xl m-auto prose">
      <Title>Blueprint to Constant Combinator | Factorio | Gaming Tools</Title>
      <div>
        <h2>Blueprint to Constant Combinator</h2>
        <p>
          Convert a factorio blueprint string to constant combinators holding
          the signals of items needed to build the blueprint.
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
              entries={[
                {
                  label: "Only constant combinators",
                  value: "CONSTANT_COMBINATORS",
                },
                {
                  label: "Only logistic chests",
                  value: "LOGISTIC_CHESTS",
                },
                {
                  label: "Both (constant combinators and logistic chests)",
                  value: "BOTH",
                },
              ]}
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
          <SelectInput
            label="Logistic chest"
            currentValue={settings.logisticChestName}
            setValue={(v) => setSettings("logisticChestName", v)}
            entries={logisticChests().map((c) => ({
              label: c.locale,
              value: c.name,
            }))}
          />
          <div class="col-span-2">
            <SelectInput
              label="Chest quality"
              currentValue={settings.logisticChestQuality}
              entries={appData.data.qualities.map((q) => ({
                label: appData.locales["qualities." + q.name],
                value: q.name,
              }))}
              setValue={(v) => setSettings("logisticChestQuality", v)}
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
