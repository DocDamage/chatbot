local Player = {}
function Player.isAlive(state)
    return type(state) == "table" and state.health > 0
end
return Player

