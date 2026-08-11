extends Node
var active := false
func activate() -> void:
    if active:
        return
    active = true

