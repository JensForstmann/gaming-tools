import { A } from "@solidjs/router";

const FactorioBade = () => <span class="badge badge-neutral">Factorio</span>;

export default function Changelog() {
  return (
    <main class="mx-auto prose max-w-4xl">
      <h1 class="text-6xl text-primary font-thin uppercase">Changelog</h1>
      <p>
        Only major updates are listed here. Take a look at the{" "}
        <A href="https://github.com/JensForstmann/gaming-tools/commits">
          Git commit history
        </A>{" "}
        to see all changes.
      </p>

      <h3>2024 November</h3>
      <ul>
        <li>
          <FactorioBade /> Add Support for Factorio 2.0
        </li>
        <li>
          <FactorioBade /> Make Everything: Add support for quality items &
          recipes
        </li>
        <li>
          <FactorioBade /> Make Everything: Add setting to allow different
          crafting machines based on crafting category
        </li>
        <li>Add this changelog page :-P</li>
      </ul>
    </main>
  );
}
