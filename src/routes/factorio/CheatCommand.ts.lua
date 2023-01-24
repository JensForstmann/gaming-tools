/c
local EOL = "\n"
local recipes_dump = ""
local can_be_researched = {}
for _, tech in pairs(game.technology_prototypes) do
        for i, effect in ipairs(tech.effects) do
            if effect.type == "unlock-recipe" then
                can_be_researched[effect.recipe] = true
            end
        end
end
for _, recipe in pairs(game.player.force.recipes) do
    local recipe_prototype = recipe.prototype
    local can_be_researched = "false"
    if can_be_researched[recipe_prototype.name] then
        can_be_researched = "true"
    end
    local main_product = "null"
    local main_product_stack_size = "null"
    if recipe_prototype.main_product then
        main_product = "\"" .. recipe_prototype.main_product.name .. "\""
        if game.item_prototypes[recipe_prototype.main_product.name] then
            main_product_stack_size = game.item_prototypes[recipe_prototype.main_product.name].stack_size
        end
    end
    local ingredients = ""
    for _, ing in pairs(recipe_prototype.ingredients) do
        if game.item_prototypes[ing.name] then
            ingredients = ingredients .. "{" .. EOL
                .. "\"name\": \"" .. ing.name .. "\"," .. EOL
                .. "\"amount\": " .. ing.amount .. "," .. EOL
                .. "\"stack_size\": " .. game.item_prototypes[ing.name].stack_size .. EOL
                .. "}," .. EOL
        end
    end
    ingredients = "[" .. EOL .. string.sub(ingredients, 1, string.len(ingredients) - 2) .. EOL .. "]"

    recipes_dump = recipes_dump .. "{" .. EOL
        .. "\"name\": \"" .. recipe_prototype.name .. "\"," .. EOL
        .. "\"enabled\": " .. tostring(recipe.enabled) .. "," .. EOL
        .. "\"category\": \"" .. recipe_prototype.category .. "\"," .. EOL
        .. "\"order\": \"" .. recipe_prototype.order .. "\"," .. EOL
        .. "\"energy\": " .. recipe_prototype.energy .. "," .. EOL
        .. "\"group_name\": \"" .. recipe_prototype.group.name .. "\"," .. EOL
        .. "\"group_order\": \"" .. recipe_prototype.group.order .. "\"," .. EOL
        .. "\"subgroup_name\": \"" .. recipe_prototype.subgroup.name .. "\"," .. EOL
        .. "\"subgroup_order\": \"" .. recipe_prototype.subgroup.order .. "\"," .. EOL
        .. "\"request_paste_multiplier\": " .. recipe_prototype.request_paste_multiplier .. "," .. EOL
        .. "\"can_be_researched\": " .. can_be_researched .. "," .. EOL
        .. "\"main_product\": " .. main_product .. "," .. EOL
        .. "\"main_product_stack_size\": " .. main_product_stack_size .. "," .. EOL
        .. "\"ingredients\": " .. ingredients .. EOL
        .. "}," .. EOL


end
recipes_dump = "[" .. EOL .. string.sub(recipes_dump, 1, string.len(recipes_dump) - 2) .. EOL .. "]"
game.write_file("recipes_dump.json.txt", recipes_dump)
