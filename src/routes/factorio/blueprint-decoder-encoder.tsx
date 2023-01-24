import { decodePlan, encodePlan } from "@jensforstmann/factorio-blueprint-tools";
import { createSignal } from "solid-js";
import { Title } from "solid-start";

const Page = () => {
    const [inputBp, setInputBp] = createSignal("");
    const [json, setJson] = createSignal("");
    const [outputBp, setOutputBp] = createSignal("");

    return (
        <div class="w-full max-w-4xl m-auto mb-48">
            <Title>Blueprint Decoder & Encoder | Factorio | Gaming Tools</Title>
            <div class="prose dui-prose">
                <h2>Blueprint Decoder & Encoder</h2>
                <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Perspiciatis ab et nulla perferendis, dolor fuga quia, vitae adipisci dolorem ut quasi in dolores esse deleniti quam ipsa voluptatem eligendi exercitationem.</p>
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
                        onInput={(e) => {
                            try {
                                setJson(JSON.stringify(decodePlan(e.currentTarget.value), null, 4));
                                setInputBp(e.currentTarget.value);
                            } catch (err) {
                                setJson("invalid blueprint string");
                            }
                        }}
                    ></textarea>
                </div>
            </div>
            <div class="dui-form-control">
                <label class="dui-label">
                    <span class="dui-label-text">Decoded (JSON)</span>
                </label>
                <textarea
                    class="dui-textarea dui-textarea-bordered h-96"
                    value={json()}
                    onInput={(e) => {
                        setJson(e.currentTarget.value);
                        try {
                            setOutputBp(encodePlan(JSON.parse(e.currentTarget.value)))
                        } catch (err) {
                            setOutputBp("invalid JSON");
                        }
                    }}
                ></textarea>
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
        </div>
    );
}

export default Page;
