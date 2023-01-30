import { A, Title } from "solid-start";
import { description as decoderEncoderDescription } from "./blueprint-decoder-encoder";
import { description as bpCcDescription } from "./blueprint-to-constant-combinator";
import { description as makeEverythingDescription } from "./make-everything-generator";

const Page = () => {
  return (
    <div class="w-full max-w-4xl m-auto">
      <Title>Factorio | Gaming Tools</Title>
      <div class="m-12 dui-card w-full bg-base-100 shadow-xl">
        <div class="dui-card-body">
          <h2 class="dui-card-title">"Make Everything" Blueprint Generator</h2>
          <p>{makeEverythingDescription}</p>
          <div class="dui-card-actions justify-end">
            <A
              href="/factorio/make-everything-generator"
              class="dui-btn dui-btn-primary"
            >
              Open
            </A>
          </div>
        </div>
      </div>
      <div class="m-12 dui-card w-full bg-base-100 shadow-xl">
        <div class="dui-card-body">
          <h2 class="dui-card-title">
            Blueprint Entities and Items to Constant Combinator
          </h2>
          <p>{bpCcDescription}</p>
          <div class="dui-card-actions justify-end">
            <A
              href="/factorio/blueprint-to-constant-combinator"
              class="dui-btn dui-btn-primary"
            >
              Open
            </A>
          </div>
        </div>
      </div>
      <div class="m-12 dui-card w-full bg-base-100 shadow-xl">
        <div class="dui-card-body">
          <h2 class="dui-card-title">Blueprint Decoder & Encoder</h2>
          <p>{decoderEncoderDescription}</p>
          <div class="dui-card-actions justify-end">
            <A
              href="/factorio/blueprint-decoder-encoder"
              class="dui-btn dui-btn-primary"
            >
              Open
            </A>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
