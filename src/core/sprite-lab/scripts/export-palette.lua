local outputPath = app.params["outputPath"]
if outputPath == nil or outputPath == "" then
  error("outputPath is required")
end

local sprite = app.activeSprite
if sprite == nil then
  error("No active sprite")
end

local colors = {}
local seen = {}

for _, palette in ipairs(sprite.palettes) do
  for i = 0, #palette - 1 do
    local color = palette:getColor(i)
    local key = string.format("#%02X%02X%02X%02X", color.red, color.green, color.blue, color.alpha)
    if not seen[key] then
      seen[key] = true
      table.insert(colors, key)
    end
  end
end

local file = io.open(outputPath, "w")
file:write("{\n  \"colors\": [\n")
for i, color in ipairs(colors) do
  file:write(string.format("    \"%s\"%s\n", color, i < #colors and "," or ""))
end
file:write("  ]\n}\n")
file:close()
