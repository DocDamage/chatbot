local M = {}
function M.normalize(record)
  if type(record) ~= 'table' or type(record.name) ~= 'string' then return nil end
  return { name = string.lower(record.name) }
end
return M

