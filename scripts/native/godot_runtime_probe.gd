extends SceneTree

func _initialize() -> void:
	call_deferred("_run_probe")

func _run_probe() -> void:
	var requested_scene := OS.get_environment("CHATBOT_GODOT_SCENE")
	var scene_path := requested_scene if requested_scene != "" else str(ProjectSettings.get_setting("application/run/main_scene", ""))
	var scene_root: Node = null
	if scene_path != "":
		var packed := load(scene_path) as PackedScene
		if packed:
			scene_root = packed.instantiate()
			root.add_child(scene_root)
	for _frame in range(3):
		await process_frame

	var assertions_payload = JSON.parse_string(OS.get_environment("CHATBOT_GODOT_ASSERTIONS"))
	var results: Array = []
	if assertions_payload is Array:
		for assertion in assertions_payload:
			var result = assertion.duplicate(true)
			var target := str(assertion.get("target", ""))
			var node := scene_root.get_node_or_null(target) if scene_root else null
			match str(assertion.get("type", "")):
				"node_exists":
					result["actual"] = node != null
					result["passed"] = node != null
				"property_equals":
					var property_name := str(assertion.get("property", ""))
					var actual = node.get(property_name) if node and property_name != "" else null
					result["actual"] = actual
					result["passed"] = actual == assertion.get("expected")
				"screen_text":
					var actual_text := str(node.get("text")) if node and "text" in node else ""
					result["actual"] = actual_text
					result["passed"] = actual_text.contains(str(assertion.get("expected", "")))
				_:
					result["actual"] = "unsupported assertion type"
					result["passed"] = false
			results.append(result)
	print("CHATBOT_RUNTIME_JSON:" + JSON.stringify({"assertions": results, "scene": scene_path}))
	quit(0 if results.all(func(item): return item.get("passed", false)) else 2)
