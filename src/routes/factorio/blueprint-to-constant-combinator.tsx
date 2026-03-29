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
  TextInput,
} from "~/components/inputs";
import { createStore } from "solid-js/store";
import { useSettings } from "~/components/settings";

const convertToItem = (entity: string) => {
  return {
    item: itemMapping[entity]?.item ?? entity,
    count: itemMapping[entity]?.count ?? 1,
  };
};

const chunkArray = <T,>(myArray: T[], chunk_size: number): T[][] => {
  if (chunk_size < 1) {
    throw new Error(`chunkArray error: chunk size must be greater 0`);
  }
  const results: T[][] = [];
  while (myArray.length) {
    results.push(myArray.splice(0, chunk_size));
  }
  return results;
};

type ItemToBuild = {
  name: string;
  quality?: string;
  count: number;
};

const convert = (inputBp: string, settings: Settings): string => {
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
      if (
        settings.negateConstantCombinatorSignals &&
        settings.generationMode !== "LOGISTIC_CHESTS"
      ) {
        count = -count;
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

    const signalLimit =
      settings.signalLimit < 1 ? 1_000_000 : settings.signalLimit;

    items.sort((a, b) => Math.abs(b.count) - Math.abs(a.count));

    chunkArray(items, signalLimit).forEach((chunk, index) => {
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
                  filters: chunk.map((item, index) => ({
                    index: index + 1,
                    name: item.name,
                    quality: item.quality,
                    comparator: COMPARATOR.equal,
                    count: item.count,
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
          request_filters: {
            request_from_buffers: settings.requestFromBuffers,
            trash_not_requested: settings.trashUnrequested,
            sections:
              settings.generationMode !== "LOGISTIC_CHESTS"
                ? undefined
                : [
                    {
                      index: 1,
                      filters: chunk.map((item, index) => ({
                        index: index + 1,
                        name: item.name,
                        quality: item.quality,
                        comparator: COMPARATOR.equal,
                        count: item.count,
                      })),
                    },
                  ],
          },
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
};

const Page = () => {
  const [inputBp, setInputBp] = createSignal("");

  const [settings, setSettings] = useSettings<Settings>({
    generationMode: "CONSTANT_COMBINATORS",
    signalLimit: 1,
    negateConstantCombinatorSignals: false,
    trashUnrequested: false,
    requestFromBuffers: false,
    logisticChestName: "requester-chest",
  });

  const [outputBp, setOutputBp] = createSignal("");

  createEffect(() => {
    setOutputBp(convert(inputBp(), settings));
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
            label={"Maximum signals per entity"}
            value={settings.signalLimit}
            setValue={(v) => setSettings("signalLimit", v)}
            min={0}
            step={1}
          />
          <div class="col-span-2">
            <CheckboxInput
              label="Negative signals on constant combinators"
              value={settings.negateConstantCombinatorSignals}
              setValue={(v) => {
                setSettings("negateConstantCombinatorSignals", v);
              }}
              disabled={settings.generationMode === "LOGISTIC_CHESTS"}
            />
          </div>
          <TextInput
            label="Logistic chest name"
            value={settings.logisticChestName}
            setValue={(v) => setSettings("logisticChestName", v)}
            disabled={settings.generationMode === "CONSTANT_COMBINATORS"}
          />
          <CheckboxInput
            label="Trasn unrequested"
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
