import { createEffect, createSignal } from "solid-js";
import { decode, encode, } from "@jensforstmann/factorio-blueprint-tools";
import { isBlueprint, isBlueprintBook, Plan } from "@jensforstmann/factorio-blueprint-tools/dist/types/plan";
import { Blueprint } from "@jensforstmann/factorio-blueprint-tools/dist/types/blueprint";
import { BlueprintBook } from "@jensforstmann/factorio-blueprint-tools/dist/types/blueprintBook";
import { Tile } from "@jensforstmann/factorio-blueprint-tools/dist/types/tile";
import { Entity } from "@jensforstmann/factorio-blueprint-tools/dist/types/entity";
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

const convert = (inputBp: string, signalsPerCC: number, includeRequester: boolean, requestFromBuffer: boolean): string => {
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
            bp.blueprint.entities.forEach(addEntityOrTile);
            bp.blueprint.tiles?.forEach(addEntityOrTile);
        };
        const addEntityOrTile = (x: Tile | Entity) => {
            const { item, count } = convertEntityToItem(x.name);
            items.set(item, (items.get(item) ?? 0) + count);
        };

        processPlan(decode(inputBp));

        const out: Blueprint = {
            blueprint: {
                entities: chunkArray([...items.entries()], signalsPerCC).map((chunk, index) => {
                    const ccId = index + 1;
                    const reqId = items.size + index + 1;

                    const cc: Entity = {
                        entity_number: ccId,
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
                                        name: name
                                    },
                                    count: count,
                                    index: index + 1
                                }
                            })
                        },
                        connections: includeRequester ? {
                            1: {
                                green: [
                                    {
                                        entity_id: reqId
                                    }
                                ]
                            }
                        } : undefined,
                    };

                    const req: Entity = {
                        entity_number: reqId,
                        name: "logistic-chest-requester",
                        position: {
                            x: index,
                            y: 1
                        },
                        control_behavior: {
                            circuit_mode_of_operation: 1
                        },
                        connections: {
                            1: {
                                green: [
                                    {
                                        entity_id: ccId
                                    }
                                ]
                            }
                        },
                        request_from_buffers: requestFromBuffer,
                    };

                    if (includeRequester) {
                        return [cc, req];
                    } else {
                        return [cc];
                    }
                }).flat(),
                icons: [{
                    signal: {
                        type: "item",
                        name: "constant-combinator"
                    },
                    index: 1
                }],
                item: "blueprint",
                version: 68722819072,
            }
        };

        return encode(out);

    } catch (err) {
        console.warn(err);
        return "";
    }
};

const Page = () => {
    const [inputBp, setInputBp] = createSignal("");
    const [signalsPerCC, setSignalsPerCC] = createSignal(1);
    const [includeRequester, setIncludeRequester] = createSignal(true);
    const [requestFromBuffer, setRequestFromBuffer] = createSignal(true);
    const [outputBp, setOutputBp] = createSignal("");

    createEffect(() => {
        setOutputBp(convert(inputBp(), signalsPerCC(), includeRequester(), requestFromBuffer()));
    });

    return (
        <div class="w-full max-w-[36rem] m-auto">
            <Title>Blueprint to Constant Combinator | Factorio | Gaming Tools</Title>
            <div class="prose dui-prose">
                <h2>Blueprint to Constant Combinator</h2>
                <p>Lorem ipsum dolor sit, amet consectetur adipisicing elit. Doloremque quod quasi libero dolorem exercitationem, accusantium hic laborum ad repellat ipsa dolores mollitia expedita? Totam, voluptates. Sint cum illo dolores tempora.</p>
            </div>
            <div class="my-8">
                <div class="dui-form-control">
                    <label class="dui-label">
                        <span class="dui-label-text">Input Blueprint String</span>
                    </label>
                    <textarea
                        class="dui-textarea dui-textarea-bordered h-24"
                        placeholder="Paste Blueprint String here"
                        value={inputBp()}
                        onInput={(e) => setInputBp(e.currentTarget.value)}
                    ></textarea>
                </div>
                <div class="dui-form-control">
                    <label class="dui-label">
                        <span class="dui-label-text">Maximum Signals per Constant Combinator</span>
                    </label>
                    <input
                        type="number"
                        value={signalsPerCC()}
                        onInput={(e) => setSignalsPerCC(parseInt(e.currentTarget.value))}
                        min={1}
                        step={1}
                        class="dui-input dui-input-bordered"
                    />
                </div>
                <div class="dui-form-control">
                    <label class="dui-label cursor-pointer">
                        <span class="dui-label-text">Include Requester Chests</span>
                        <input
                            type="checkbox"
                            checked={includeRequester()}
                            onInput={(e) => setIncludeRequester(e.currentTarget.checked)}
                            class="dui-checkbox"
                        />
                    </label>
                </div>
                <div class="dui-form-control">
                    <label class={"dui-label" + (includeRequester() ? " cursor-pointer" : "")}>
                        <span class={"dui-label-text" + (!includeRequester() ? " text-base-300" : "")}>Request from Buffer Chests</span>
                        <input
                            type="checkbox"
                            disabled={!includeRequester()}
                            checked={requestFromBuffer()}
                            onInput={(e) => setRequestFromBuffer(e.currentTarget.checked)}
                            class="dui-checkbox"
                        />
                    </label>
                </div>
                <div class="dui-form-control">
                    <label class="dui-label">
                        <span class="dui-label-text">Output Blueprint String</span>
                    </label>
                    <textarea
                        class="dui-textarea dui-textarea-bordered h-24"
                        value={outputBp()}
                    ></textarea>
                </div>
                <div class="dui-btn my-4 dui-btn-primary w-full" onMouseDown={() => navigator.clipboard.writeText(outputBp())}>
                    Copy
                </div>
            </div>
        </div>
    );
}

export default Page;
