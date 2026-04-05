import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";

const Page = () => {
  return (
    <div class="w-full max-w-4xl m-auto ">
      <Title>Factorio | Gaming Tools</Title>

      <div class="prose">
        <h1 class="text-6xl text-primary font-thin uppercase">Factorio</h1>
      </div>

      <div class="my-12 card w-full shadow-xl">
        <div class="card-body">
          <h2 class="card-title">"Make Everything" Blueprint Generator</h2>
          <p>
            This tool can be used to build bot based malls/hubs. Just pick the
            recipes you want to craft, select your machines, qualities and more
            and you're good to go.
            <br />
            You don't have the logistic system unlocked, yet? Don't worry. Non
            logistic chests are also supported. They will be filled by
            constructions bots instead.
          </p>
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
          <h2 class="card-title">Blueprint to Constant Combinator/Chest/Rocket Silo</h2>
          <p>
            Convert a Factorio blueprint string to constant combinators holding
            the signals of items needed to build the blueprint. It's also
            possible to directly generalte logistic (requester/buffer) chests.
            <br />
            You don't have the logistic system unlocked, yet? Don't worry. Non
            logistic chests are also supported. They will be filled by
            constructions bots instead.
            <br />
            Wan't to travel to another planet? Generate perfectly filled rocket
            silos, too.
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
            Simply decode blueprint strings to JSON and encode (modified) JSON
            back to factorio blueprint strings.
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
