import { For } from "solid-js";
import { createStore } from "solid-js/store";
import { Title } from "solid-start";
import VanillaRecipes from "./vanillaRecipes.json";

type Recipe = {
    name: string;
    enabled: boolean;
    category: string;
    order: string;
    energy: number;
    group_name: string;
    group_order: string;
    subgroup_name: string;
    subgroup_order: string;
    request_paste_multiplier: number;
    can_be_researched: boolean;
    main_product: null | string;
    main_product_stack_size: null | string;
};

const Page = () => {
    let globalCheckbox: HTMLInputElement | undefined;
    const [recipes, setRecipes] = createStore<Array<Recipe & { selected?: boolean }>>(VanillaRecipes);
    const toggleRecipe = (name: string) => {
        setRecipes((recipe) => recipe.name === name, "selected", (selected) => !selected)
    };
    return (
        <div class="w-full max-w-4xl m-auto mb-48">
            <Title>Make Everything Generator | Factorio | Gaming Tools</Title>
            <div class="prose dui-prose">
                <h2>Make Everything Generator</h2>
                <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Explicabo quas nesciunt laudantium et debitis corporis accusamus quasi repudiandae nobis vero dolorem delectus voluptatum fuga recusandae dolor veritatis expedita, voluptas tempore.</p>
            </div>
            <div class="overflow-x-auto w-full">
                <table class="dui-table w-full">
                    <thead>
                        <tr>
                            <th>
                                <label>
                                    <input type="checkbox" class="dui-checkbox"
                                        ref={globalCheckbox}
                                        onChange={() => {
                                            if (recipes.filter((recipe) => recipe.selected).length === recipes.length) {
                                                setRecipes(() => true, "selected", false);
                                            } else {
                                                setRecipes(() => true, "selected", true);
                                            }
                                            if (globalCheckbox) {
                                                globalCheckbox.indeterminate = false;
                                            }
                                        }}
                                    />
                                </label>
                            </th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Group</th>
                            <th>Subgroup</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={recipes}>
                            {(recipe) =>
                                <tr>
                                    <th>
                                        <label>
                                            <input
                                                type="checkbox"
                                                class="dui-checkbox"
                                                checked={recipe.selected}
                                                onChange={() => {
                                                    toggleRecipe(recipe.name);
                                                    if (globalCheckbox) {
                                                        const selected = recipes.filter(recipe => recipe.selected).length;
                                                        globalCheckbox.indeterminate = selected > 0 && selected !== recipes.length;
                                                        globalCheckbox.checked = selected === recipes.length;
                                                    }
                                                }}
                                            />
                                        </label>
                                    </th>
                                    <td>{recipe.name}</td>
                                    <td>{recipe.category}</td>
                                    <td>{recipe.group_name}</td>
                                    <td>{recipe.subgroup_name}</td>
                                </tr>
                            }
                        </For>
                    </tbody>
                    <tfoot>
                        <tr>
                            <th></th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Group</th>
                            <th>Subgroup</th>
                        </tr>
                    </tfoot>

                </table>
            </div>
        </div>
    );

};

export default Page;
