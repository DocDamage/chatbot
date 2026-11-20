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
	if scene_root == null:
		push_error("Godot observation probe could not instantiate the requested scene.")
		quit(2)
		return
	for _frame in range(3):
		await process_frame

	var assertions_payload = JSON.parse_string(OS.get_environment("CHATBOT_GODOT_ASSERTIONS"))
	var results: Array = []
	if assertions_payload is Array:
		for index in range(assertions_payload.size()):
			var assertion = assertions_payload[index]
			var result = assertion.duplicate(true)
			result["assertionId"] = index
			var target := str(assertion.get("target", ""))
			var node := scene_root.get_node_or_null(target) if scene_root else null
			match str(assertion.get("type", "")):
				"node_exists":
					result["actual"] = node != null
					result["passed"] = (node != null) == assertion.get("expected")
				"property_equals":
					var property_name := str(assertion.get("property", ""))
					var actual = node.get(property_name) if node and property_name != "" else null
					result["actual"] = actual
					result["passed"] = node != null and property_name in node and actual == assertion.get("expected")
				"screen_text":
					var actual_text := str(node.get("text")) if node and "text" in node else ""
					result["actual"] = actual_text
					result["passed"] = node != null and "text" in node and actual_text.contains(str(assertion.get("expected", "")))
				_:
					result["actual"] = "unsupported assertion type"
					result["passed"] = false
			results.append(result)
	var evidence = JSON.parse_string(OS.get_environment("CHATBOT_GODOT_EVIDENCE"))
	print("CHATBOT_RUNTIME_JSON:" + JSON.stringify({"mode": "scenario", "assertions": results, "scene": scene_path, "evidence": evidence}))
	quit(0 if not results.is_empty() and results.all(func(item): return item.get("passed", false)) else 2)
