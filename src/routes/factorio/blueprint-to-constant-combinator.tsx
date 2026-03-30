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
} => {
  /** all the items, may be split across multiple stacks */
  const itemStacks: typeof items = [];
  items.forEach((item) => {
    let rest = item.count;
    const dataItem = data.items.find((i) => i.name === item.name);
    if (!dataItem) {
      console.warn(
        `no data item found for ${item.name}, assuming stack size of 1`,
      );
    }
    const stackSize = dataItem?.stack_size ?? 1;
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

  return {
    pure: pure,
    spread: combined,
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

    // fake logistic chest == normal steel chest
    const logisticChest = factorioData.logistic_containers.find(
      (c) => c.name === settings.logisticChestName,
    );

    items.sort((a, b) => Math.abs(b.count) - Math.abs(a.count));
    const reallyChunked = convertItemsToRequester(items, factorioData, {
      chestSize: settings.considerInventorySize
        ? (logisticChest?.inventory_sizes[settings.logisticChestQuality] ?? 48)
        : 1_000_000,
      signalLimit: Math.max(1, settings.signalLimit),
    });

    /* Possible scenarions:
        Option A: only CC, no chest limits
        Option B: only CC, with chest limits
        Option C: only Chest, no chest limits ~ (makes no sense)
        Option D: only Chest, with chest limits
        Option E: CC+Chest, no chest limits ~ (makes no sense)
        Option F: CC+Chest, with chest limits
    */

    const isFakeLogisticChest = logisticChest?.logistic_mode === undefined;

    reallyChunked.spread.forEach(({ filter, items }, index) => {
      let constantCombinator: Entity | undefined = undefined;
      let requesterChest: Entity | undefined = undefined;

      if (
        settings.generationMode === "CONSTANT_COMBINATORS" ||
        settings.generationMode === "BOTH"
      ) {
        constantCombinator = addEntity(blueprint, {
          name: "constant-combinator",
          position: {
            x: 0.5 + index,
            y: 0.5,
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
          position: {
            x: 0.5 + index,
            y: 1.5,
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

    return encodePlan(blueprint);
  } catch (err) {
    console.warn(err);
    return "";
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
  signalLimit: number;
  negateConstantCombinatorSignals: boolean;
  trashUnrequested: boolean;
  requestFromBuffers: boolean;
  logisticChestName: string;
  logisticChestQuality: string;
  considerInventorySize: boolean;
};

const Page = () => {
  const [appData, setAppData] = createStore({
    data: VanillaData,
    locales: VanillaLocales,
  });
  const [inputBp, setInputBp] = createSignal(
    "0eNqd3dvqJ9ldh+F76eNR/lWrtrkVCZJNow1JT5iZuCHMvTutMDkQ8f0+ZyrpN8VnWVmdXz0kf/v0+z/99fNffvjy9adPv/nbpy9/+P7rj59+809/+/Tjl3/5+rs/ffu/ff3dnz9/+s2nn3743dcf//L9Dz/9w+8//+mnTz9/9+nL1z9+/o9Pv9l+/u13nz5//enLT18+/8+f/e//5T//+etf//z7zz/88g/47v9ofPfpL9//+Msf+/7rt3+eX1Lrev/x/O7Tf/7yP23/eP7yT/HHLz98/sP//AO2/efv/ld6H6SfWXr19L3N0scg/TFLn4P0mqWvQXqfpe9B+pyln0H6mKXfQfqepbePQfsatgfv4z18H7fBC3kPX8ht8EY+wzdyG7ySz/CV3Abv5DN8J7fBS/kMX8pt8FY+w7dyG7yWz/C13Abv5TN8L/fBe/kM38t98F4+w3dnH7yXz/QOHryX7/Dd2Qfv5Tt85/fBe/kO35198F6+w3d+H7yX7/Dd2Qfv5Tt85/fBe/kO3501eC/f4Tu/Bu/lO3x31uC9fKd/ge3v5fExfHfWMWgP3/l1DtrDd2ddg/bwnV/3oD18d9YzaA/f+fUO2sN35/gYtIfv/LEN2sP38tgH7eF7eQzey2367ywH7+U2fC+PwXu5Dd/LY/BebsP38hi8l9vwvTwG7+U2fC+PwXu5Dd/Lc/BebsP38qTfe1Zr0w8+sb3kuffWPuS5Y/uUX6riJpf8VBXbtzx33OSR547tV35ja5tcH/IjW2xv8txtk2uX547tJb8Oxk0O+Xkwtk957rjJJc8d27f8rhk3eeR3zdim32PbJjf9Hhvb9Hts2+Sm32Nje8lzx00Oee7YPuV35LjJJb8jx/Ytzx03eeS5Y/uV37/bJs+H/P4d25s8d9vk2eW5Y3vJ7/Zxk0N+t4/tU547bnLJc8f2Ld8b4iaPfG+IbfpO0jZ56TtJbNN3ktim7ySxveS521m+hzx3bJ/yfSducsn3ndi+5bnjJo88d2y/8l1qj67gQz5M1fgmT75ifJcnr/El39TqLId8VKvxU568znLJk9f4Ld8D6yyPfBCscfqSGWfZ6FNmjdO3zBqnj5k1vuTJ44FO+M/7TOOnfIets1zyIbbGb3nyOssjT17jr3xDjrPsH/IRucY3efI4y77Lk9f4ku/fdZZDPoDX+ClPXme55Mlr/JZv93WWRz7e1zipgzjLInZQ4+QO4iyL4EGNL3nyOsshT17jp5iJOsslaKLGb3nyOssjT17jr3iPOMsEBm3TO3Qig7bpHTqhQdv0Dh3ZoOkdOsJB0zt0pIOmd+iIB03v0JEPmt6hIyA0vUNNCMVZjAjVOBmhM8YJCdU4KaEjxokJ1Tg5oToLQaEaJylUZyEqVONkheIshoVqnLRQnMW4UI2TF6qzEBiqcRJDdRYiQzVOZqjOQmioxkkNxVmMDdU4uaE4i8GhGic5VGchOlTjZIfqLISHapz0UJ2F+FCNkx+KsxggqnESRHEWI0Q1ToaozkKIqMZJEdVZiBHVODmiOgtBohonSRRnMUpU42SJapwwUY2TJooHapyoxskT1VkIFNU4iaI6C5GiGidTdMT/TAQyRTVOpuiMcTJFNU6mqM5CpqjGyRTVWcgU1TiZojoLmaIaJ1MUZzFTVONkimqcTFGNkymKB2qmqMbJFNVZyBTVOJmiOguZohonUxRnMVNU42SK4ixmimqcTFGdhUxRjZMpqrOQKapxMkV1FjJFNU6mKM5ipqjGyRTFWcwU1TiZojoLmaIaJ1NUZyFTVONkiuosZIpqnExRnMVMUY2TKYqzmCmqcTJFdRYyRTVOpqjOQqaoxskU1VnIFNU4maI4i5miGidTdMc4maIaJ1N0xTiZohonU1RnIVNU42SK6ixkimqcTFGcxUxRjZMpirOYKapxMkV1FjJFNU6mqM5CpqjGyRTVWcgU1TiZojiLmaIaJ1MUZzFTVONkiuosZIpqnExRnYVMUY2TKaqzkCmqcTJFcRYzRTVOpijOYqaoxskU1VnIFNU4maI6C5miGidTVGchU1TjZIriLGaKapxMUY2TKapxMkXxQM0U1TiZojoLmaIaJ1NUZyFTVONkiq743+dApqjGyRTdMU6mqMbJFNVZyBTVOJmiOguZohonU1RnIVNU42SK4ixmimqcTFGNkymqcTJF8UDNFNU4maI6C5miGidTVGchU1TjZIriLGaKapxMUZzFTFGNkymqs5ApqnEyRXUWMkU1TqaozkKmqMbJFMVZzBTVOJmiOIuZohonU1RnIVNU42SK6ixkimqcTFGdhUxRjZMpirOYKapxMkVxFjNFNU6mqM5CpqjGyRTVWcgU1TiZojoLmaIaJ1MUZzFTVONkit4YJ1NU42SKnhgnU1TjZIrqLGSKapxMUZ2FTFGNkymKs5gpqnEyRXEWM0U1TqaozkKmqMbJFNVZyBTVOJmiOguZohonUxRnMVNU42SK4ixmimqcTFGdhUxRjZMpqrOQKapxMkV1FjJFNU6mKM5ipqjGyRTFWcwU1TiZojoLmaIaJ1NUZyFTVONkiuosZIpqnExRnMVMUY2TKapxMkU1TqYoHqiZohonU1RnIVNU42SK6ixkimqcTFGb5TBTVONkit4YJ1NU42SK6ixkimqcTFGdhUxRjZMpqrOQKapxMkVxFjNFNU6mqMbJFNU4maJ4oGaKapxMUZ2FTFGNkymqs5ApqnEyRXEWM0U1TqYozmKmqMbJFNVZyBTVOJmiOguZohonU1RnIVNU42SK4ixmimqcTFGcxUxRjZMpqrOQKapxMkV1FjJFNU6mqM5CpqjGyRTFWcwU1TiZojiLmaIaJ1NUZyFTVONkiuosZIpqnExRnYVMUY2TKYqzmCmqcTFFx0eMiynK8SXxLcYPmaXGxRTlWcQU5fgt8TrLI7PUuJiiOguZohzfJB5nGZmiNY2LKcqziCnK8VPidZZLZqlxMUV5FjFFOf5KPM4yMkX3NC6mKMfFFOW4mKJ6oGSKclxMUZ5FTFGOiynKs4gpynExRXUWMkU5LqaozkKmKMfFFOVZxBTluJiiPIuYohwXU5RnEVOU42KK6ixkinJcTFGOiynK8SXxeKAjUzS9/ckU5VnEFOX4LfE6yyOz1LiYojjLSaYoxzeJbzG+yyw1LqYozyKmKMdPiddZLpmlxsUU5VnEFOX4K/E4y8gUXdO4mKI6C5miHF8Sr7McMkuNiynKs4gpyvFb4nWWR2apcTFFdRYyRTm+STzOMjJF0wuaTFGeRUxRjp8Sr7NcMkuNiynKs4gpyvFX4nGWkSmaXtBkiuosZIpyfEm8znLILDUupijPIqYox2+J11kemaXGxRTVWcgU5fgm8TjLyBRN71AyRXkWMUU5fkq8znLJLDUupijPIqYox1+Jx1lGpmh6h45M0a830R7ju8icGidTtGKcTFGNnyJz6iyXyJwaJ1NUZyFTVOOvyJw4y8gUrWmcTFGcxUxRjS+ROXWWQ2ROjZMpqrOQKarxW2ROneURmVPjZIriLGaKapxMUY2TKapxMkXxQM0U1TiZojoLmaIaJ1NUZyFTVONkiuIsZopqnExRnMVMUY2TKaqzkCmqcTJFdRYyRTVOpqjOQqaoxskUxVnMFNX4JjInzjIyRdM71ExRnYVMUY2fInPqLJfInBonU1RnIVNU46/InDbLNTJF+zROpmiPcTJFNb5E5tRZDpE5NU6mqM5CpqjGb5E5dZZHZE6NkymKs5gpqvFNZE6N7yJzapxMUTxQM0U1forMqbNcInNqnExRnYVMUY2/InPiLCNTNL3mzBTFWcwU1fgSmVNnOUTm1DiZojoLmaIav0Xm1FkekTk1TqYozmKmqMY3kTlxlpEpmt6hZorqLGSKavwUmVNnuUTm1DiZojoLmaIaf0XmxFlGpmh6h5opirOYKarxJTKnznKIzKlxMkV1FjJFNX6LzKmzPCJzapxMUZzFTFGNkyk6YpxMUY2TKTpjnExRjZMpqrOQKapxMkV1FjJFNU6mKM5ipqjGyRTFWcwU1TiZojoLmaIaJ1NUZyFTVONkiuosZIpqnExRnMVMUY2TKapxMkU1TqYoHqiZohonU1RnIVNU42SK6ixkimqcTFGcxUxRjZMpirOYKapxMkV1FjJFNU6mqM5CpqjGyRTVWcgU1TiZojiLmaIaJ1MUZzFTVONkiuosZIpqnExRnYVMUY2TKaqzkCmqcTJFbZbbTFGNkyk6YpxMUY2TKaqzkCmqcTJFdRYyRTVOpqjOQqaoxskUxVnMFNU4maIaJ1NU42SK4oGaKapxMkV1FjJFNU6mqM5CpqjGyRTFWcwU1TiZojiLmaIaJ1NUZyFTVONkiuosZIpqnExRnYVMUY2TKYqzmCmqcTJFcRYzRTVOpqjOQqaoxskU1VnIFNU4maI6C5miGidTFGcxU1TjZIriLGaKapxMUZ2FTFGNkymqs5ApqnEyRXUWMkU1TqYozmKmqMbJFF0xTqaoxskU3TFOpqjGyRTVWcgU1TiZojoLmaIaJ1MUZzFTVONkiuIsZopqnExRnYVMUY2TKaqzkCmqcTJFdRYyRTVOpijOYqaoxskU1TiZohonUxQP1ExRjZMpqrOQKapxMkV1FjJFNU6mKM5ipqjGyRTFWcwU1TiZojoLmaIaJ1NUZyFTVONkiuosZIpqnExRnMVMUY2TKYqzmCmqcTJFdRYyRTVOpqjOQqaoxskU1VnIFNU4maI2y2OmqMbJFF0xTqaoxskU1VnIFNU4maI6C5miGidTVGchU1TjZIriLGaKapxMUY2TKapxMkXxQM0U1TiZojoLmaIaJ1NUZyFTVONkiuIsZopqnExRnMVMUY2TKaqzkCmqcTJFdRYyRTVOpqjOQqaoxskUxVnMFNU4maI4i5miGidTVGchU1TjZIrqLGSKapxMUZ2FTFGNkymKs5gpqnEyRXEWM0U1TqaozkKmqMbJFNVZyBTVOJmiOguZohonUxRnMVNU42SKnhgnU1TjZIreGCdTVONkiuosZIpqnExRnYVMUY2TKYqzmCmqcTJFcRYzRTVOpqjOQqaoxskU1VnIFNU4maI6C5miGidTFGcxU1TjZIpqnExRjZMpigdqpqjGyRTVWcgU1TiZojoLmaIaJ1MUZzFTVONkiuIsZopqnExRnYVMUY2TKaqzkCmqcTJFdRYyRTVOpijOYqaoxskUxVnMFNU4maI6C5miGidTVGchU1TjZIrqLGSKapxMUZvlNVNU42SKnhgnU1TjZIrqLGSKapxMUZ2FTFGNkymqs5ApqnEyRXEWM0U1TqaoxskU1TiZonigZopqnExRnYVMUY2TKaqzkCmqcTJFcRYzRTVOpijOYqaoxskU1VnIFNU4maI6C5miGidTVGchU1TjZIriLGaKapxMUZzFTFGNkymqs5ApqnEyRXUWMkU1TqaozkKmqMbJFMVZzBTVOJmiOIuZohonU1RnIVNU42SK6ixkimqcTFGdhUxRjZMpirOYKapxMUXnR4yLKcrxJfEtxg+ZpcbFFOVZxBTl+C3xOssjs9S4mKI6C5miHN8kHmcZmaJ9GhdTlGcRU5Tjp8TrLJfMUuNiivIsYopy/JV4nGVkiq5pXExRnYVMUY6LKcqziCnKcTFFeRYxRTkupijPIqYox8UU1VnIFOW4mKI6C5miHBdTlGcRU5TjYoryLGKKclxMUZ5FTFGOiymqs5ApynExRXUWMkU5viReZzlklhoXU5RnEVOU47fE6yyPzFLjYoriLNsHoaJe36S+1fouy+S6uKK+jMCiXj+lnpe5ZJlcF1vUlxFc1Ouv1OsyI150j+vii/IyBIx6fUk9L3PIMrkuxqgvI8io12+p52UeWSbXxRnlZQga9fom9brMiBqNb22yRn0ZwUa9fko9L3PJMrku3qgvI+Co11+p12VG5Gh8a5M5yssQOur1JfW8zCHL5Lq4o76MwKNev6Wel3lkmVwXe5SXIXzU65vU6zIjfjS+V8kf9WUEIPX6KfW8zCXL5LoYpL6MIKRef6VelxkxpPG9OnJIv95Nq9Z34Ty5ThJpr3WiSLl+iujJy1xCenKdNFJehjhSrr+ieuoyI5C0j+skkuoyRpJyfYnsycscQntynVRSXoZYUq7fonvyMo/wnlwnmVSXMZqU62ST6jKGk3KddFJehnhSrpNPyssQUMp1Ekp5GSJKuU5GqS5jSCnXSSnVZYwp5To5pbwMQaVcJ6mUlyGqlOtklfIyhJVynbRSXca4Uq5von5yfRf2k+skluqpGlnK9VPkT17mEvqT66SW8jLElnL9FfsTl9lGbmmN6+SWVq2TW8r1JfYnL3OI/cl1ckt5GXJLuX6L/cnLPGJ/cp3cUl3G3FKub2J/cn0X+5Pr5JbqqZpbyvVT7E9e5hL7k+vklvIy5JZy/RX7U5cZuaXxzWduqS5jbinXl9ifvMwh9ifXyS3lZcgt5fot9icv84j9yXVyS3UZc0u5von9qcuM3NL4XjW3lJcht5Trp9ifvMwl9ifXyS3lZcgt5for9qcuM3JL43vV3FJdxtxSri+xP3mZQ+xPrpNbysuQW8r1W+xPXuYR+5Pr5JbqMuaWcp3c0lnr5JZyndzSUevklnKd3FJehtxSrpNbysuQW8p1ckt1GXNLuU5uqS5jbinXyS3lZcgt5Tq5pbwMuaVcJ7eUlyG3lOvkluoy5pZyndxSXcbcUq6TW8rLkFvKdXJLeRlyS7lObikvQ24p18kt1WXMLeU6uaW6jLmlXCe3lJcht5Tr5JbyMuSWcp3cUl6G3FKuk1uqy5hbynVyS7lObinXyS3VUzW3lOvklvIy5JZyndxSXobcUq6TW4rL7OaWcp3c0lnr5JZyndxSXobcUq6TW8rLkFvKdXJLeRlyS7lObqkuY24p18kt5Tq5pVwnt1RP1dxSrpNbysuQW8p1ckt5GXJLuU5uqS5jbinXyS3VZcwt5Tq5pbwMuaVcJ7eUlyG3lOvklvIy5JZyndxSXcbcUq6TW6rLmFvKdXJLeRlyS7lObikvQ24p18kt5WXILeU6uaW6jLmlXCe3VJcxt5Tr5JbyMuSWcp3cUl6G3FKuk1vKy5BbynVyS3UZc0u5Tm7prnVyS7lObumqdXJLuU5uKS9DbinXyS3lZcgt5Tq5pbqMuaVcJ7dUlzG3lOvklvIy5JZyndxSXobcUq6TW8rLkFvKdXJLdRlzS7lObqkuY24p18kt5WXILeU6uaW8DLmlXCe3lJcht5Tr5JbqMuaWcp3cUl3G3FKuk1vKy5BbynVyS3kZcku5Tm4pL0NuKdfJLdVlzC3lOrmlXCe3lOvkluqpmlvKdXJLeRlyS7lObikvQ24p18ktxWWWuaVcJ7d01zq5pVwnt5SXIbeU6+SW8jLklnKd3FJehtxSrpNbqsuYW8p1cku5Tm4p18kt1VM1t5Tr5JbyMuSWcp3cUl6G3FKuk1uqy5hbynVyS3UZc0u5Tm4pL0NuKdfJLeVlyC3lOrmlvAy5pVwnt1SXMbeU6+SW6jLmlnKd3FJehtxSrpNbysuQW8p1ckt5GXJLuU5uqS5jbinXyS3VZcwt5Tq5pbwMuaVcJ7eUlyG3lOvklvIy5JZyndxSXcbcUq6TW3prndxSrpNbemqd3FKuk1vKy5BbynVyS3kZcku5Tm6pLmNuKdfJLdVlzC3lOrmlvAy5pVwnt5SXIbeU6+SW8jLklnKd3FJdxtxSrpNbqsuYW8p1ckt5GXJLuU5uKS9DbinXyS3lZcgt5Tq5pbqMuaVcJ7dUlzG3lOvklvIy5JZyndxSXobcUq6TW8rLkFvKdXJLdRlzS7lObinXyS3lOrmleqrmlnKd3FJehtxSrpNbysuQW8p1cktxmcPcUq6TW3prndxSrpNbysuQW8p1ckt5GXJLuU5uKS9DbinXyS3VZcwt5Tq5pVwnt5Tr5JbqqZpbynVyS3kZcku5Tm4pL0NuKdfJLdVlzC3lOrmluoy5pVwnt5SXIbeU6+SW8jLklnKd3FJehtxSrpNbqsuYW8p1ckt1GXNLuU5uKS9DbinXyS3lZcgt5Tq5pbwMuaVcJ7dUlzG3lOvkluoy5pZyndxSXobcUq6TW8rLkFvKdXJLeRlyS7lObqkuY24p18UtXR+1Lm6p15fUt1o/ZJlcF7fUlxG31Ou31PMyjyyT6+KW8jLklnp9k3pdZuSW1rgubqkvI26p10+p52UuWSbXxS31ZcQt9for9brMyC3d47q4pV4Xt9Tr4pbyqZJb6nVxS30ZcUu9Lm6pLyNuqdfFLeVlyC31urilvAy5pV4Xt9SXEbfU6+KW+jLilnpd3FJfRtxSr4tbysuQW+p1cUu9Lm6p15fU66mO3NL47wTklvoy4pZ6/ZZ6XuaRZXJd3FJd5iS31Oub1Lda32WZXBe31JcRt9Trp9TzMpcsk+vilvoy4pZ6/ZV6XWbklq5xXdxSXobcUq8vqedlDlkm18Ut9WXELfX6LfW8zCPL5Lq4pbwMuaVe36Relxm5pfGtTW6pLyNuqddPqedlLlkm18Ut9WXELfX6K/W6zMgtjW9tckt5GXJLvb6knpc5ZJlcF7fUlxG31Ou31PMyjyyT6+KW8jLklnp9k3pdZuSWxvcquaW+jLilXj+lnpe5ZJlcF7fUlxG31Ouv1OsyI7c0vldHbunXu2mv9V3sT66TW1q1Tm4p10+xP3mZS+xPrpNbysuQW8r1V+xPXWbklta4Tm6pLmNuKdeX2J+8zCH2J9fJLeVlyC3l+i32Jy/ziP3JdXJLdRlzS7lObinXyS3lOrmleqrmlnKd3FJehtxSrpNbysuQW8p1ckt1GXNLuU5uqS5jbinXyS3lZcgt5Tq5pbwMuaVcJ7eUlyG3lOvkluoy5pZyfRP7U5cZuaXxvWpuKS9DbinXT7E/eZlL7E+uk1vKy5BbyvVX7E9c5hq5pX1cJ7e01zq5pVxfYn/yMofYn1wnt5SXIbeU67fYn7zMI/Yn18kt1WXMLeX6JvYn13exP7lObqmeqrmlXD/F/uRlLrE/uU5uKS9DbinXX7E/dZmRWxrffOaW6jLmlnJ9if3Jyxxif3Kd3FJehtxSrt9if/Iyj9ifXCe3VJcxt5Trm9ifuszILY3vVXNLeRlyS7l+iv3Jy1xif3Kd3FJehtxSrr9if+oyI7c0vlfNLdVlzC3l+hL7k5c5xP7kOrmlvAy5pVy/xf7kZR6xP7lObqkuY24p18ktHbVObinXyS2dtU5uKdfJLeVlyC3lOrmlvAy5pVwnt1SXMbeU6+SW6jLmlnKd3FJehtxSrpNbysuQW8p1ckt5GXJLuU5uqS5jbinXyS3lOrmlXCe3VE/V3FKuk1vKy5BbynVyS3kZcku5Tm6pLmNuKdfJLdVlzC3lOrmlvAy5pVwnt5SXIbeU6+SW8jLklnKd3FJdxtxSrpNbqsuYW8p1ckt5GXJLuU5uKS9DbinXyS3lZcgt5Tq5pbjMbW4p18ktHbVObinXyS3lZcgt5Tq5pbwMuaVcJ7eUlyG3lOvkluoy5pZyndxSrpNbynVyS/VUzS3lOrmlvAy5pVwnt5SXIbeU6+SW6jLmlnKd3FJdxtxSrpNbysuQW8p1ckt5GXJLuU5uKS9DbinXyS3VZcwt5Tq5pbqMuaVcJ7eUlyG3lOvklvIy5JZyndxSXobcUq6TW6rLmFvKdXJLdRlzS7lObikvQ24p18kt5WXILeU6uaW8DLmlXCe3VJcxt5Tr5JauWie3lOvklu5aJ7eU6+SW8jLklnKd3FJehtxSrpNbqsuYW8p1ckt1GXNLuU5uKS9DbinXyS3lZcgt5Tq5pbwMuaVcJ7dUlzG3lOvklnKd3FKuk1uqp2puKdfJLeVlyC3lOrmlvAy5pVwnt1SXMbeU6+SW6jLmlnKd3FJehtxSrpNbysuQW8p1ckt5GXJLuU5uqS5jbinXyS3VZcwt5Tq5pbwMuaVcJ7eUlyG3lOvklvIy5JZyndxSXOYxt5Tr5JauWie3lOvklvIy5JZyndxSXobcUq6TW8rLkFvKdXJLdRlzS7lObinXyS3lOrmleqrmlnKd3FJehtxSrpNbysuQW8p1ckt1GXNLuU5uqS5jbinXyS3lZcgt5Tq5pbwMuaVcJ7eUlyG3lOvkluoy5pZyndxSXcbcUq6TW8rLkFvKdXJLeRlyS7lObikvQ24p18kt1WXMLeU6uaW6jLmlXCe3lJcht5Tr5JbyMuSWcp3cUl6G3FKuk1uqy5hbynVyS0+tk1vKdXJLb62TW8p1ckt5GXJLuU5uKS9DbinXyS3VZcwt5Tq5pbqMuaVcJ7eUlyG3lOvklvIy5JZyndxSXobcUq6TW6rLmFvKdXJLuU5uKdfJLdVTNbeU6+SW8jLklnKd3FJehtxSrpNbqsuYW8p1ckt1GXNLuU5uKS9DbinXyS3lZcgt5Tq5pbwMuaVcJ7dUlzG3lOvkluoy5pZyndxSXobcUq6TW8rLkFvKdXJLeRlyS7lObiku85pbynVyS0+tk1vKdXJLeRlyS7lObikvQ24p18kt5WXILeU6uaW6jLmlXCe3lOvklnKd3FI9VXNLuU5uKS9DbinXyS3lZcgt5Tq5pbqMuaVcJ7dUlzG3lOvklvIy5JZyndxSXobcUq6TW8rLkFvKdXJLdRlzS7lObqkuY24p18kt5WXILeU6uaW8DLmlXCe3lJcht5Tr5JbqMuaWcp3cUl3G3FKuk1vKy5BbynVyS3kZcku5Tm4pL0NuKdfJLdVlzC3lurilbxil1cUt9fqS+lbrhyyT6+KW+jLilnr9lnpe5pFlcl3cUl6G3FKvb1Kvy4zc0j6ui1vqy4hb6vVT6nmZS5bJdXFLfRlxS73+Sr0uM3JL17gubikvQ26p18Ut9WXELfW6uKW+jLilXhe31JcRt9Tr4pbyMuSWel3cUl6G3FKvi1vqy4hb6nVxS30ZcUu9Lm6pLyNuqdfFLeVlyC31urilvAy5pV5fUs/LHLJMrotb6suIW+r1W+p5mUeWyXVxS3GZ/YPcUq9vUt9qfZdlcl3cUl9G3FKvn1LPy1yyTK6LW+rLiFvq9VfqdZmRW7rHdXFLeRlyS72+pJ6XOWSZXBe31JcRt9Trt9TzMo8sk+vilvIy5JZ6fZN6XWbklsa3Nrmlvoy4pV4/pZ6XuWSZXBe31JcRt9Trr9TrMiO3NL61yS3lZcgt9fqSel7mkGVyXdxSX0bcUq/fUs/LPLJMrotbysuQW+r1Tep1mZFbGt+r5Jb6MuKWev2Uel7mkmVyXdxSX0bcUq+/Uq/LjNzS+F4duaVf76ZV67vYn1wnt7TXOrmlXD/F/uRlLrE/uU5uKS9DbinXX7E/dZmRW9rHdXJLdRlzS7m+xP7kZQ6xP7lObikvQ24p12+xP3mZR+xPrpNbqsuYW8p1ckt1GXNLuU5uKS9DbinXyS3lZcgt5Tq5pbwMuaVcJ7dUlzG3lOvkluoy5pZyndxSXobcUq6TW8rLkFvKdXJLeRlyS7lObqkuY24p1zexP7m+i/3JdXJL9VTNLeX6KfYnL3OJ/cl1ckt5GXJLuf6K/YnLbCO3tMZ1ckur1skt5foS+5OXOcT+5Dq5pbwMuaVcv8X+5GUesT+5Tm6pLmNuKdc3sT+5vov9yXVyS/VUzS3l+in2Jy9zif3JdXJLeRlyS7n+iv2py4zc0vjmM7dUlzG3lOtL7E9e5hD7k+vklvIy5JZy/Rb7k5d5xP7kOrmluoy5pVzfxP7UZUZuaXyvmlvKy5BbyvVT7E9e5hL7k+vklvIy5JZy/RX7U5cZuaXxvWpuqS5jbinXl9ifvMwh9ifXyS3lZcgt5fot9icv84j9yXVyS3UZc0u5Tm7prHVyS7lObumodXJLuU5uKS9DbinXyS3lZcgt5Tq5pbqMuaVcJ7dUlzG3lOvklvIy5JZyndxSXobcUq6TW8rLkFvKdXJLdRlzS7lObqkuY24p18kt5WXILeU6uaW8DLmlXCe3lJcht5Tr5JbqMuaWcp3cUl3G3FKuk1vKy5BbynVyS3kZcku5Tm4pL0NuKdfJLdVlzC3lOrmlXCe3lOvkluqpmlvKdXJLeRlyS7lObikvQ24p18ktxWV2c0u5Tm7prHVyS7lObikvQ24p18kt5WXILeU6uaW8DLmlXCe3VJcxt5Tr5JZyndxSrpNbqqdqbinXyS3lZcgt5Tq5pbwMuaVcJ7dUlzG3lOvkluoy5pZyndxSXobcUq6TW8rLkFvKdXJLeRlyS7lObqkuY24p18kt1WXMLeU6uaW8DLmlXCe3lJcht5Tr5JbyMuSWcp3cUl3G3FKuk1uqy5hbynVyS3kZcku5Tm4pL0NuKdfJLeVlyC3lOrmluoy5pVwnt3TXOrmlXCe3dNU6uaVcJ7eUlyG3lOvklvIy5JZyndxSXcbcUq6TW6rLmFvKdXJLeRlyS7lObikvQ24p18kt5WXILeU6uaW6jLmlXCe3VJcxt5Tr5JbyMuSWcp3cUl6G3FKuk1vKy5BbynVyS3UZc0u5Tm6pLmNuKdfJLeVlyC3lOrmlvAy5pVwnt5SXIbeU6+SW6jLmlnKd3FKuk1vKdXJL9VTNLeU6uaW8DLmlXCe3lJcht5Tr5JbiMsvcUq6TW7prndxSrpNbysuQW8p1ckt5GXJLuU5uKS9DbinXyS3VZcwt5Tq5pVwnt5Tr5JbqqZpbynVyS3kZcku5Tm4pL0NuKdfJLdVlzC3lOrmluoy5pVwnt5SXIbeU6+SW8jLklnKd3FJehtxSrpNbqsuYW8p1ckt1GXNLuU5uKS9DbinXyS3lZcgt5Tq5pbwMuaVcJ7dUlzG3lOvkluoy5pZyndxSXobcUq6TW8rLkFvKdXJLeRlyS7lObqkuY24p18ktvbVObinXyS09tU5uKdfJLeVlyC3lOrmlvAy5pVwnt1SXMbeU6+SW6jLmlnKd3FJehtxSrpNbysuQW8p1ckt5GXJLuU5uqS5jbinXyS3VZcwt5Tq5pbwMuaVcJ7eUlyG3lOvklvIy5JZyndxSXcbcUq6TW6rLmFvKdXJLeRlyS7lObikvQ24p18kt5WXILeU6uaW6jLmlXCe3lOvklnKd3FI9VXNLuU5uKS9DbinXyS3lZcgt5Tq5pbjMYW4p18ktvbVObinXyS3lZcgt5Tq5pbwMuaVcJ7eUlyG3lOvkluoy5pZyndxSrpNbynVyS/VUzS3lOrmlvAy5pVwnt5SXIbeU6+SW6jLmlnKd3FJdxtxSrpNbysuQW8p1ckt5GXJLuU5uKS9DbinXyS3VZcwt5Tq5pbqMuaVcJ7eUlyG3lOvklvIy5JZyndxSXobcUq6TW6rLmFvKdXJLdRlzS7lObikvQ24p18kt5WXILeU6uaW8DLmlXCe3VJcxt5Tr4pa+fdZqdXFLvb6kvtX6Icvkurilvoy4pV6/pZ6XeWSZXBe3lJcht9Trm9TrMiO3tMZ1cUt9GXFLvX5KPS9zyTK5Lm6pLyNuqddfqddlRm7pHtfFLfW6uKVeF7eUT5XcUq+LW+rLiFvqdXFLfRlxS70ubikvQ26p18Ut5WXILfW6uKW+jLilXhe31JcRt9Tr4pb6MuKWel3cUl6G3FKvi1vqdXFLvb6kXk915JbGfycgt9SXEbfU67fU8zKPLJPr4pbqMie5pV7fpL7V+i7L5Lq4pb6MuKVeP6Wel7lkmVwXt9SXEbfU66/U6zIjt3SN6+KW8jLklnp9ST0vc8gyuS5uqS8jbqnXb6nnZR5ZJtfFLeVlyC31+ib1uszILY1vbXJLfRlxS71+Sj0vc8kyuS5uqS8jbqnXX6nXZUZuaXxrk1vKy5Bb6vUl9bzMIcvkurilvoy4pV6/pZ6XeWSZXBe3lJcht9Trm9TrMiO3NL5XyS31ZcQt9fop9bzMJcvkurilvoy4pV5/pV6XGbml8b06cku/3k17re9if3Kd3NKqdXJLuX6K/cnLXGJ/cp3cUl6G3FKuv2J/6jIjt7TGdXJLdRlzS7m+xP7kZQ6xP7lObikvQ24p12+xP3mZR+xPrpNbqsuYW8p1cku5Tm4p18kt1VM1t5Tr5JbyMuSWcp3cUl6G3FKuk1uqy5hbynVyS3UZc0u5Tm4pL0NuKdfJLeVlyC3lOrmlvAy5pVwnt1SXMbeU65vYn7rMyC2N71VzS3kZcku5for9yctcYn9yndxSXobcUq6/Yn/iMtfILe3jOrmlvdbJLeX6EvuTlznE/uQ6uaW8DLmlXL/F/uRlHrE/uU5uqS5jbinXN7E/ub6L/cl1ckv1VM0t5fop9icvc4n9yXVyS3kZcku5/or9qcuM3NL45jO3VJcxt5TrS+xPXuYQ+5Pr5JbyMuSWcv0W+5OXecT+5Dq5pbqMuaVc38T+1GVGbml8r5pbysuQW8r1U+xPXuYS+5Pr5JbyMuSWcv0V+1OXGbml8b1qbqkuY24p15fYn7zMIfYn18kt5WXILeX6LfYnL/OI/cl1ckt1GXNLuU5u6ah1cku5Tm7prHVyS7lObikvQ24p18kt5WXILeU6uaW6jLmlXCe3VJcxt5Tr5JbyMuSWcp3cUl6G3FKuk1vKy5BbynVyS3UZc0u5Tm4p18kt5Tq5pXqq5pZyndxSXobcUq6TW8rLkFvKdXJLdRlzS7lObqkuY24p18kt5WXILeU6uaW8DLmlXCe3lJcht5Tr5JbqMuaWcp3cUl3G3FKuk1vKy5BbynVyS3kZcku5Tm4pL0NuKdfJLcVlbnNLuU5u6ah1cku5Tm4pL0NuKdfJLeVlyC3lOrmlvAy5pVwnt1SXMbeU6+SWcp3cUq6TW6qnam4p18kt5WXILeU6uaW8DLmlXCe3VJcxt5Tr5JbqMuaWcp3cUl6G3FKuk1vKy5BbynVyS3kZcku5Tm6pLmNuKdfJLdVlzC3lOrmlvAy5pVwnt5SXIbeU6+SW8jLklnKd3FJdxtxSrpNbqsuYW8p1ckt5GXJLuU5uKS9DbinXyS3lZcgt5Tq5pbqMuaVcJ7d01Tq5pVwnt3TXOrmlXCe3lJcht5Tr5JbyMuSWcp3cUl3G3FKuk1uqy5hbynVyS3kZcku5Tm4pL0NuKdfJLeVlyC3lOrmluoy5pVwnt5Tr5JZyndxSPVVzS7lObikvQ24p18kt5WXILeU6uaW6jLmlXCe3VJcxt5Tr5JbyMuSWcp3cUl6G3FKuk1vKy5BbynVyS3UZc0u5Tm6pLmNuKdfJLeVlyC3lOrmlvAy5pVwnt5SXIbeU6+SW4jKPuaVcJ7d01Tq5pVwnt5SXIbeU6+SW8jLklnKd3FJehtxSrpNbqsuYW8p1cku5Tm4p18kt1VM1t5Tr5JbyMuSWcp3cUl6G3FKuk1uqy5hbynVyS3UZc0u5Tm4pL0NuKdfJLeVlyC3lOrmlvAy5pVwnt1SXMbeU6+SW6jLmlnKd3FJehtxSrpNbysuQW8p1ckt5GXJLuU5uqS5jbinXyS3VZcwt5Tq5pbwMuaVcJ7eUlyG3lOvklvIy5JZyndxSXcbcUq6TW3pqndxSrpNbemud3FKuk1vKy5BbynVyS3kZcku5Tm6pLmNuKdfJLdVlzC3lOrmlvAy5pVwnt5SXIbeU6+SW8jLklnKd3FJdxtxSrpN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popw3G7Vq3mxUzp+ki/I4F+minDcblccxG5XzL+miOs7IRq153mxUHQdtVM4v0kV5nIN0Uc6bjcrjmI3K+Zt0UR7nIV2U82aj6jhoo3LebFTOm43KebNR9WjRRuW82ag8jtmonDcblccxG5XzZqPqOGijct5sVB0HbVTOm43K45iNynmzUXkcs1E5bzYqj2M2KufNRtVx0Ebl/Ea6qI4zslHzuxZtVB7HbFTOn6SL8jgX6aKcNxuVxzEblfMv6aI4zjWyUfs8bzZqr3mzUTm/SBflcQ7SRTlvNiqPYzYq52/SRXmch3RRzpuNquOgjcr5jXRRzu+ki3LebFQ9WrRROX+SLsrjXKSLct5sVB7HbFTOv6SL6jgjGzW/DNFG1XHQRuX8Il2UxzlIF+W82ag8jtmonL9JF+VxHtJFOW82qo6DNirnN9JFdZyRjZrftWij8jhmo3L+JF2Ux7lIF+W82ag8jtmonH9JF9VxRjZqfteijarjoI3K+UW6KI9zkC7KebNReRyzUTl/ky7K4zyki3LebFQdB21UzpuNOmrebFTOm406a95sVM6bjcrjmI3KebNReRyzUTlvNqqOgzYq581G1XHQRuW82ag8jtmonDcblccxG5XzZqPyOGajct5sVB0HbVTOm43KebNROW82qh4t2qicNxuVxzEblfNmo/I4ZqNy3mxUHQdtVM6bjarjoI3KebNReRyzUTlvNiqPYzYq581G5XHMRuW82ag6DtqonDcbVcdBG5XzZqPyOGajct5sVB7HbFTOm43K45iNynmzUXGcG21UzpuNOmrebFTOm43K45iNynmzUXkcs1E5bzYqj2M2KufNRtVx0EblvNmonDcblfNmo+rRoo3KebNReRyzUTlvNiqPYzYq581G1XHQRuW82ag6DtqonDcblccxG5XzZqPyOGajct5sVB7HbFTOm42q46CNynmzUXUctFE5bzYqj2M2KufNRuVxzEblvNmoPI7ZqJw3G1XHQRuV82aj6jhoo3LebFQex2xUzpuNyuOYjcp5s1F5HLNROW82qo6DNirnzUZdNW82KufNRt01bzYq581G5XHMRuW82ag8jtmonDcbVcdBG5XzZqPqOGijct5sVB7HbFTOm43K45iNynmzUXkcs1E5bzaqjoM2KufNRuW82aicNxtVjxZtVM6bjcrjmI3KebNReRyzUTl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NRtVx0EblvNmoOg7aqJw3G5XHMRuV82aj8jhmo3LebFQex2xUzpuNquOgjcp5s1F1HLRROW82Ko9jNirnzUblccxG5bzZqDyO2aicNxtVx0EblfNmo+6aNxuV82ajrpo3G5XzZqPyOGajct5sVB7HbFTOm42q46CNynmzUXUctFE5bzYqj2M2KufNRuVxzEblvNmoPI7ZqJw3G1XHQRuV82aj6jhoo3LebFQex2xUzpuNyuOYjcp5s1F5HLNROW82qo6DNirnzUbVcdBG5bzZqDyO2aicNxuVxzEblfNmo/I4ZqNy3mxUHQdtVM6bjcp5s1E5bzaqHi3aqJw3G5XHMRuV82aj8jhmo3LebFQcZ6GNynmzUXfNm43KebNReRyzUTlvNiqPYzYq581G5XHMRuW82ag6DtqonDcblfNmo3LebFQ9WrRROW82Ko9jNirnzUblccxG5bzZqDoO2qicNxtVx0EblfNmo/I4ZqNy3mxUHsdsVM6bjcrjmI3KebNRdRy0UTlvNqqOgzYq581G5XHMRuW82ag8jtmonDcblccxG5XzZqPqOGijct5sVB0HbVTOm43K45iNynmzUXkcs1E5bzYqj2M2KufNRtVx0EblvNmot+bNRuW82ain5s1G5bzZqDyO2aicNxuVxzEblfNmo+o4aKNy3mxUHQdtVM6bjcrjmI3KebNReRyzUTlvNiqPYzYq581G1XHQRuW82ag6DtqonDcblccxG5XzZqPyOGajct5sVB7HbFTOm42q46CNynmzUXUctFE5bzYqj2M2KufNRuVxzEblvNmoPI7ZqJw3G1XHQRuV82ajct5sVM6bjapHizYq581G5XHMRuW82ag8jtmonDcbFcc50EblvNmot+bNRuW82ag8jtmonDcblccxG5XzZqPyOGajct5sVB0HbVTOm43KebNROW82qh4t2qicNxuVxzEblfNmo/I4ZqNy3mxUHQdtVM6bjarjoI3KebNReRyzUTlvNiqPYzYq581G5XHMRuW82ag6DtqonDcbVcdBG5XzZqPyOGajct5sVB7HbFTOm43K45iNynmzUXUctFE5bzaqjoM2KufNRuVxzEblvNmoPI7ZqJw3G5XHMRuV82aj6jhoo3KebNT+UfNko3p+UX6r+YPGyXmyUX0cslE9f1M+j/PQODlPNiqPYzaq5zfK13FGNmrN82S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",
  );

  const [settings, setSettings] = useSettings<Settings>({
    generationMode: "CONSTANT_COMBINATORS",
    signalLimit: 1,
    negateConstantCombinatorSignals: false,
    trashUnrequested: false,
    requestFromBuffers: false,
    logisticChestName: "requester-chest",
    logisticChestQuality: "normal",
    considerInventorySize: true,
  });

  const [outputBp, setOutputBp] = createSignal("");

  createEffect(() => {
    setOutputBp(convert(inputBp(), settings, appData.data));
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
          <div class="col-span-3">
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
          <NumberInput
            label={"Maximum items per entity"}
            value={settings.signalLimit}
            setValue={(v) => setSettings("signalLimit", v)}
            min={0}
            step={1}
          />
          <CheckboxInput
            label="Consider inventory size"
            value={settings.considerInventorySize}
            setValue={(v) => {
              setSettings("considerInventorySize", v);
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
            entries={appData.data.logistic_containers.map((c) => ({
              label: appData.locales["logistic_containers." + c.name] || c.name,
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
        <TextAreaInput label="Output Blueprint String" value={outputBp()} />
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
