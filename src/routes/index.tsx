import { A } from "@solidjs/router";

export default function Home() {
  return (
    <main class="mx-auto prose max-w-4xl">
      <h1 class="text-6xl text-primary font-thin uppercase">Home</h1>
      <p>
        This multi purpose web app includes various scripts or apps I've
        developed primarily for myself to make my life easier. Currently it's
        only related to <A href="https://factorio.com/">Factorio</A> but maybe
        I'll add some others in the future, too.
      </p>
      <p>
        The code is on{" "}
        <A href="https://github.com/JensForstmann/gaming-tools">GitHub</A>. Feel
        free to report issues and suggestions.
      </p>
    </main>
  );
}
