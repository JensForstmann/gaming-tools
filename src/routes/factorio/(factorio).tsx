import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";

const Page = () => {
  return (
    <div class="w-full max-w-4xl m-auto">
      <Title>Factorio | Gaming Tools</Title>
      <div class="my-12 card w-full shadow-xl">
        <div class="card-body">
          <h2 class="card-title">"Make Everything" Blueprint Generator</h2>
          <p>This tool can be used to build bot based malls/hubs.</p>
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
      <div class="my-12 card w-full shadow-xl">
        <div class="card-body">
          <h2 class="card-title">
            Blueprint Entities and Items to Constant Combinator
          </h2>
          <p>
            Convert a factorio blueprint string to constant combinators holding
            the signals of items needed to build the blueprint.
          </p>
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
      <div class="my-12 card w-full shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Blueprint Decoder & Encoder</h2>
          <p>
            Simply decode blueprint strings to JSON and encode JSON back to
            factorio blueprint strings.
          </p>
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
