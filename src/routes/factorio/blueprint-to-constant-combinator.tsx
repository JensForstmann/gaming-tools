import {
  addEntity,
  Blueprint,
  BlueprintBook,
  COMPARATOR,
  createEmptyBlueprint,
  decodePlan,
  DEFINES,
  encodePlan,
  isBlueprint,
  isBlueprintBook,
  Plan,
} from "@jensforstmann/factorio-blueprint-tools";
import { Title } from "@solidjs/meta";
import { createEffect, createSignal } from "solid-js";
import { itemMapping } from "./item-mapping";

const convertToItem = (entity: string) => {
  return {
    item: itemMapping[entity]?.item ?? entity,
    count: itemMapping[entity]?.count ?? 1,
  };
};

const chunkArray = <T,>(myArray: T[], chunk_size: number): T[][] => {
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

const convert = (
  inputBp: string,
  signalsPerCC: number,
  includeRequester: boolean,
  requestFromBuffer: boolean,
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

    chunkArray(items, signalsPerCC).forEach((chunk, index) => {
      const constantCombinator = addEntity(blueprint, {
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
                filters: chunk.map((item, index) => {
                  return {
                    index: index + 1,
                    name: item.name,
                    quality: item.quality,
                    comparator: COMPARATOR.equal,
                    count: item.count,
                  };
                }),
              },
            ],
          },
        },
      });

      if (includeRequester) {
        const requesterChest = addEntity(blueprint, {
          name: "requester-chest",
          position: {
            x: 0.5 + index,
            y: 1.5,
          },
          control_behavior: {
            circuit_mode_of_operation: 1,
            circuit_condition_enabled: false,
          },
          request_filters: {
            request_from_buffers: requestFromBuffer,
          },
        });

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
      <h3 class="collapse-title m-0">Help / Example</h3>
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

const Page = () => {
  const [inputBp, setInputBp] = createSignal("");
  const [signalsPerCC, setSignalsPerCC] = createSignal(1);
  const [includeRequester, setIncludeRequester] = createSignal(true);
  const [requestFromBuffer, setRequestFromBuffer] = createSignal(true);
  const [outputBp, setOutputBp] = createSignal("");

  createEffect(() => {
    if (inputBp()) {
      setOutputBp(
        convert(
          inputBp(),
          signalsPerCC(),
          includeRequester(),
          requestFromBuffer(),
        ),
      );
    }
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
        <div class="form-control">
          <label class="label">
            <span class="label-text">Input Blueprint String</span>
          </label>
          <textarea
            class="textarea textarea-bordered h-24"
            placeholder="Paste Blueprint String here"
            value={inputBp()}
            onInput={(e) => setInputBp(e.currentTarget.value)}
          ></textarea>
        </div>
        <div class="form-control">
          <label class="label">
            <span class="label-text">
              Maximum Signals per Constant Combinator
            </span>
          </label>
          <input
            type="number"
            value={signalsPerCC()}
            onInput={(e) => setSignalsPerCC(parseInt(e.currentTarget.value))}
            min={1}
            step={1}
            class="input input-bordered"
          />
        </div>
        <div class="form-control">
          <label class="label cursor-pointer">
            <span class="label-text">Include Requester Chests</span>
            <input
              type="checkbox"
              checked={includeRequester()}
              onInput={(e) => setIncludeRequester(e.currentTarget.checked)}
              class="checkbox"
            />
          </label>
        </div>
        <div class="form-control">
          <label class="label cursor-pointer">
            <span class={"label-text"}>Request from Buffer Chests</span>
            <input
              type="checkbox"
              disabled={!includeRequester()}
              checked={requestFromBuffer()}
              onInput={(e) => setRequestFromBuffer(e.currentTarget.checked)}
              class="checkbox"
            />
          </label>
        </div>
        <div class="form-control">
          <label class="label">
            <span class="label-text">Output Blueprint String</span>
          </label>
          <textarea
            class="textarea textarea-bordered h-24"
            value={outputBp()}
          ></textarea>
        </div>
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
