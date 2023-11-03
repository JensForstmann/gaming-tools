import { A, Title } from "solid-start";
import { description as decoderEncoderDescription } from "./blueprint-decoder-encoder";
import { description as bpCcDescription } from "./blueprint-to-constant-combinator";
import { description as makeEverythingDescription } from "./make-everything-generator";

const Page = () => {
  return (
    <div class="w-full max-w-4xl m-auto">
      <Title>Factorio | Gaming Tools</Title>
      <div class="m-12 card w-full shadow-xl">
        <div class="card-body">
          <h2 class="card-title">"Make Everything" Blueprint Generator</h2>
          <p>{makeEverythingDescription}</p>
          <div class="card-actions justify-end">
            <A
              href="/factorio/make-everything-generator"
              class="btn btn-primary"
            >
              Open
            </A>
          </div>
        </div>
      </div>
      <div class="m-12 card w-full shadow-xl">
        <div class="card-body">
          <h2 class="card-title">
            Blueprint Entities and Items to Constant Combinator
          </h2>
          <p>{bpCcDescription}</p>
          <div class="card-actions justify-end">
            <A
              href="/factorio/blueprint-to-constant-combinator"
              class="btn btn-primary"
            >
              Open
            </A>
          </div>
        </div>
      </div>
      <div class="m-12 card w-full shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Blueprint Decoder & Encoder</h2>
          <p>{decoderEncoderDescription}</p>
          <div class="card-actions justify-end">
            <A
              href="/factorio/blueprint-decoder-encoder"
              class="btn btn-primary"
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
