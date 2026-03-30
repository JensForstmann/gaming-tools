import { A } from "@solidjs/router";

const FactorioBadge = () => <span class="badge badge-neutral">Factorio</span>;

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

      <h3>2026 March</h3>
      <ul>
        <li>
          <FactorioBadge /> Make Everything: Allow normal chests to request
          items from construction bots. Helpful when "Logistic system" isn't
          researched, yet.
        </li>
        <li>
          <FactorioBadge /> Add save mechanism for all configured settings: They
          are now saved into the page URL. So just bookmark the page or share
          the specific link with a friend and never worry about reconfigure them
          again.
        </li>
        <li>
          <FactorioBadge /> Blueprint to Constant Combinator: Add settings for
          different generation modes, to set negative amounts and to define a
          specific logistic chest. Also it's now possible to use normal chests
          to request items from construction bots. Last but not least, inventory
          size can be considered to spread a single item request or signal
          across mutliple combinators or chests.
        </li>
      </ul>

      <h3>2024 November</h3>
      <ul>
        <li>
          <FactorioBadge /> Add Support for Factorio 2.0
        </li>
        <li>
          <FactorioBadge /> Make Everything: Add support for quality items &
          recipes
        </li>
        <li>
          <FactorioBadge /> Make Everything: Add setting to allow different
          crafting machines based on crafting category
        </li>
        <li>Add this changelog page :-P</li>
      </ul>
    </main>
  );
}
