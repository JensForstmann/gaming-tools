import {
  decodePlan,
  encodePlan,
} from "@jensforstmann/factorio-blueprint-tools";
import { Title } from "@solidjs/meta";
import { createEffect, createSignal } from "solid-js";
import { TextAreaInput } from "~/components/inputs";

const Page = () => {
  const [inputBp, setInputBp] = createSignal("");
  const [json, setJson] = createSignal("");
  const [outputBp, setOutputBp] = createSignal("");

  createEffect(() => {});

  return (
    <div class="w-full max-w-4xl m-auto mb-48">
      <Title>Blueprint Decoder & Encoder | Factorio | Gaming Tools</Title>
      <div class="prose">
        <h2>Blueprint Decoder & Encoder</h2>
        <p>
          Simply decode blueprint strings to JSON and encode JSON back to
          Factorio blueprint strings.
        </p>
      </div>
      <div class="my-8">
        <TextAreaInput
          label="Input Blueprint String"
          value={inputBp()}
          setValue={(v) => {
            try {
              setJson(JSON.stringify(decodePlan(v), null, 4));
              setInputBp(v);
            } catch (err) {
              setJson("invalid blueprint string");
            }
          }}
        />
        <TextAreaInput
          label="Decoded (JSON)"
          value={json()}
          setValue={(v) => {
            setJson(v);
            try {
              setOutputBp(encodePlan(JSON.parse(v)));
            } catch (err) {
              setOutputBp("invalid JSON");
            }
          }}
          class="h-96"
        />
        <TextAreaInput label="Output Blueprint String" value={outputBp()} />
      </div>
    </div>
  );
};

export default Page;
