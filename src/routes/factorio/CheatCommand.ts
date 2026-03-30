export const CheatCommand = `
/c

local data = {
    recipes = {},
    items = {},
    crafting_machines = {},
    inserters = {},
    logistic_containers = {},
    groups = {},
    subgroups = {},
    qualities = {},
    rocket_silos = {},
}

local can_be_researched_map = {}
for _, tech in pairs(prototypes.technology) do
    for _, effect in ipairs(tech.effects) do
        if effect.type == "unlock-recipe" then
            can_be_researched_map[effect.recipe] = true
        end
    end
end

local groups = {}
local subgroups = {}
local locale = {}
local categories = {}
for _, recipe_prototype in pairs(prototypes.recipe) do
    if recipe_prototype.hidden == false and recipe_prototype.main_product and recipe_prototype.main_product.type == "item" and (recipe_prototype.enabled or can_be_researched_map[recipe_prototype.name]) then
        local ingredients = {}
        for _, ingredient in pairs(recipe_prototype.ingredients) do
            if ingredient.type == "item" then
                table.insert(ingredients, {
                    name = ingredient.name,
                    amount = ingredient.amount,
                })
            end
        end
        table.insert(data.recipes, {
            name = recipe_prototype.name,
            category = recipe_prototype.category,
            order = recipe_prototype.order,
            energy = recipe_prototype.energy,
            group_name = recipe_prototype.group.name,
            subgroup_name = recipe_prototype.subgroup.name,
            request_paste_multiplier = recipe_prototype.request_paste_multiplier,
            main_product = recipe_prototype.main_product.name,
            ingredients = ingredients,
        })
        categories[recipe_prototype.category] = true
        groups[recipe_prototype.group.name] = recipe_prototype.group
        subgroups[recipe_prototype.subgroup.name] = recipe_prototype.subgroup
        if recipe_prototype.localised_name then
            locale["recipes." .. recipe_prototype.name] = recipe_prototype.localised_name
        end
    end
end

for _, item_prototype in pairs(prototypes.item) do
    table.insert(data.items, {
      name = item_prototype.name,
      stack_size = item_prototype.stack_size,
      weight = item_prototype.weight
    })
end

local function add_groups(list, key)
    for _, group in pairs(list) do
        table.insert(data[key], {
            name = group.name,
            order = group.order,
        })
        locale[key .. "." .. group.name] = group.localised_name
    end
end
add_groups(groups, "groups")
add_groups(subgroups, "subgroups")

for _, entity_prototype in pairs(prototypes.get_entity_filtered{{filter = "type", type = {"inserter"}}}) do
    table.insert(data.inserters, {
        name = entity_prototype.name,
        tile_width = entity_prototype.tile_width,
        tile_height = entity_prototype.tile_height,
        inserter_pickup_position = entity_prototype.inserter_pickup_position,
        inserter_drop_position = entity_prototype.inserter_drop_position,
    })
    locale["inserters." .. entity_prototype.name] = entity_prototype.localised_name
end

for _, entity_prototype in pairs(prototypes.get_entity_filtered{{filter = "type", type = {"logistic-container", "container"}}}) do
    if not entity_prototype.hidden then
        local inventory_sizes = {}
        for _, quality_prototype in pairs(prototypes.quality) do
            if not quality_prototype.hidden then
                inventory_sizes[quality_prototype.name] = entity_prototype.get_inventory_size(defines.inventory.chest, quality_prototype)
            end
        end
        table.insert(data.logistic_containers, {
            name = entity_prototype.name,
            tile_width = entity_prototype.tile_width,
            tile_height = entity_prototype.tile_height,
            logistic_mode = entity_prototype.logistic_mode,
            inventory_sizes = inventory_sizes,
        })
        locale["logistic_containers." .. entity_prototype.name] = entity_prototype.localised_name
    end
end

for _, entity_prototype in pairs(prototypes.get_entity_filtered{{filter = "type", type = {"rocket-silo"}}}) do
    local inventory_sizes = {}
    for _, quality_prototype in pairs(prototypes.quality) do
        if not quality_prototype.hidden then
            inventory_sizes[quality_prototype.name] = entity_prototype.get_inventory_size(defines.inventory.rocket_silo_rocket, quality_prototype)
        end
    end
    table.insert(data.rocket_silos, {
        name = entity_prototype.name,
        tile_width = entity_prototype.tile_width,
        tile_height = entity_prototype.tile_height,
        lift_weight = prototypes["utility_constants"].rocket_lift_weight,
        inventory_sizes = inventory_sizes,
    })
    locale["rocket_silos." .. entity_prototype.name] = entity_prototype.localised_name
end

for _, entity_prototype in pairs(prototypes.get_entity_filtered{{filter = "type", type = {"assembling-machine", "furnace", "rocket-silo"}}}) do
    local crafting_categories = {}
    for crafting_category, _ in pairs(entity_prototype.crafting_categories or {}) do
        if categories[crafting_category] then
            table.insert(crafting_categories, crafting_category)
        end
    end
    table.insert(data.crafting_machines, {
        name = entity_prototype.name,
        tile_width = entity_prototype.tile_width,
        tile_height = entity_prototype.tile_height,
        crafting_categories = crafting_categories,
        crafting_speed = entity_prototype.get_crafting_speed(),
        is_burner = entity_prototype.burner_prototype ~= nil
    })
    locale["crafting_machines." .. entity_prototype.name] = entity_prototype.localised_name
end

for _, quality_prototype in pairs(prototypes.quality) do
    if not quality_prototype.hidden then
        table.insert(data.qualities, {
            name = quality_prototype.name,
        })
        locale["qualities." .. quality_prototype.name] = quality_prototype.localised_name
    end
end

local filename = "export-data-for-gaming-tools.gtd"
helpers.write_file(filename, helpers.table_to_json(data), false, game.player.index)

helpers.write_file(filename, "\\n\\n", true, game.player.index)
for k, v in pairs(locale) do
    helpers.write_file(filename, {"?", {"", k .. "=", v, "\\n"}, ""}, true, game.player.index)
end

game.player.print("File " .. filename .. " has been generated in you script-output folder")
`;
