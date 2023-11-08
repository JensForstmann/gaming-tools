import { createEffect, createSignal } from "solid-js";
import {
  addEntity,
  addEntityConnection,
  Blueprint,
  BlueprintBook,
  decodePlan,
  encodePlan,
  Entity,
  isBlueprint,
  isBlueprintBook,
  Plan,
  Tile,
} from "@jensforstmann/factorio-blueprint-tools";
import { entityItemMap } from "./item-entity-map";
import { Title } from "solid-start";

const convertEntityToItem = (entity: string) => {
  return {
    item: entityItemMap[entity]?.item ?? entity,
    count: entityItemMap[entity]?.count ?? 1,
  };
};

const chunkArray = <T,>(myArray: T[], chunk_size: number): T[][] => {
  const results: T[][] = [];
  while (myArray.length) {
    results.push(myArray.splice(0, chunk_size));
  }
  return results;
};

const convert = (
  inputBp: string,
  signalsPerCC: number,
  includeRequester: boolean,
  requestFromBuffer: boolean,
): string => {
  try {
    const items = new Map<string, number>();

    const processPlan = (bp: Plan) => {
      if (isBlueprintBook(bp)) {
        processBook(bp);
      } else if (isBlueprint(bp)) {
        processBp(bp);
      }
    };
    const processBook = (book: BlueprintBook) => {
      book.blueprint_book.blueprints.forEach((bp) => processPlan(bp));
    };
    const processBp = (bp: Blueprint) => {
      bp.blueprint.entities?.forEach((entity) => {
        addByEntityName(entity.name);
        for (let name in entity.items) {
          // modules
          addToItems(name, entity.items[name]);
        }
      });
      bp.blueprint.tiles?.forEach((tile) => addByEntityName(tile.name));
    };
    const addByEntityName = (name: string) => {
      const { item, count } = convertEntityToItem(name);
      addToItems(item, count);
    };
    const addToItems = (name: string, count: number) => {
      items.set(name, (items.get(name) ?? 0) + count);
    };

    processPlan(decodePlan(inputBp));

    const blueprint: Blueprint = {
      blueprint: {
        entities: [],
        icons: [
          {
            signal: {
              type: "item",
              name: "constant-combinator",
            },
            index: 1,
          },
        ],
        item: "blueprint",
        version: 68722819072,
      },
    };

    chunkArray([...items.entries()], signalsPerCC).forEach((chunk, index) => {
      const constantCombinator = addEntity(blueprint, {
        name: "constant-combinator",
        position: {
          x: index,
          y: 0,
        },
        control_behavior: {
          filters: chunk.map((item, index) => {
            const [name, count] = item;
            return {
              signal: {
                type: "item",
                name: name,
              },
              count: count,
              index: index + 1,
            };
          }),
        },
      });

      if (includeRequester) {
        const requesterChest = addEntity(blueprint, {
          name: "logistic-chest-requester",
          position: {
            x: index,
            y: 1,
          },
          control_behavior: {
            circuit_mode_of_operation: 1,
          },
          request_from_buffers: requestFromBuffer,
        });

        addEntityConnection(constantCombinator, requesterChest, "green");
      }
    });

    return encodePlan(blueprint);
  } catch (err) {
    console.warn(err);
    return "";
  }
};

export const description =
  "Convert a factorio blueprint string to constant combinators holding the signals of items needed to build the blueprint.";

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
        <p>{description}</p>
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
