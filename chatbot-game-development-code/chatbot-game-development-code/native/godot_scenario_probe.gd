extends SceneTree

# Reference for the Godot 4.7 profile only, not a claim of native qualification.
# Require the enrolled exact version string and engine commit below; the HOST
# must also pin the executable SHA-256. Do not enable other 4.x profiles by range.
# Run only in an isolated, enrolled project snapshot. See QUALIFICATION.md.
# This probe reports observations. The HOST evaluates expected values and success.
# Native execution was not available when the reference kit was prepared.
const MAX_INPUT_BYTES: int = 65536
const MAX_STEPS: int = 256
const MAX_TOTAL_FRAMES: int = 7200
const MAX_JS_SAFE_INTEGER: int = 9007199254740991
const TAG: String = "CHATBOT_GAME_SCENARIO_V1:"

var scenario: Dictionary = {}
var scene_root: Node
var observations: Array[Dictionary] = []
var held_actions: Array[StringName] = []
var waited_frames: int = 0
var finished: bool = false

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var input_path: String = OS.get_environment("CHATBOT_SCENARIO_INPUT")
	var file: FileAccess = FileAccess.open(input_path, FileAccess.READ)
	if file == null or file.get_length() > MAX_INPUT_BYTES:
		_finish(false, "INPUT_UNREADABLE_OR_TOO_LARGE")
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		_finish(false, "INVALID_SCENARIO_JSON")
		return
	scenario = parsed
	# JSON numbers may be represented by Godot as floats. Do not coerce a
	# string, boolean or fractional version to integer 1.
	var schema_version: Variant = scenario.get("schemaVersion")
	if not (schema_version is int or schema_version is float) or schema_version != 1:
		_finish(false, "UNSUPPORTED_SCENARIO_SCHEMA")
		return
	for key: String in ["runId", "attemptId", "scenarioId"]:
		if not scenario.get(key) is String or str(scenario.get(key)).is_empty():
			_finish(false, "MISSING_SCENARIO_IDENTITY")
			return
	var engine_info: Dictionary = Engine.get_version_info()
	if engine_info.get("major") != 4 or engine_info.get("minor") != 7:
		_finish(false, "UNSUPPORTED_ENGINE_PROFILE")
		return
	if not _is_nonempty_string(scenario.get("expectedEngineVersion")) or not _is_nonempty_string(scenario.get("expectedEngineHash")):
		_finish(false, "MISSING_EXACT_ENGINE_IDENTITY")
		return
	if scenario.get("expectedEngineVersion") != engine_info.get("string") or scenario.get("expectedEngineHash") != engine_info.get("hash"):
		_finish(false, "EXACT_ENGINE_IDENTITY_MISMATCH")
		return
	if not _valid_scene_path(scenario.get("scene")):
		_finish(false, "INVALID_SCENE_PATH")
		return
	var scene_path: String = scenario.get("scene")
	var steps: Variant = scenario.get("steps")
	if not steps is Array or steps.is_empty() or steps.size() > MAX_STEPS:
		_finish(false, "INVALID_SCENARIO_STEPS")
		return
	var packed: PackedScene = load(scene_path) as PackedScene
	if packed == null:
		_finish(false, "SCENE_LOAD_FAILED")
		return
	# Godot 4.7: scene_changed is emitted after the replacement scene is added
	# and initialized. Merely adding an instantiated node does not set current_scene.
	scene_changed.connect(_remember_current_scene)
	var change_error: Error = change_scene_to_packed(packed)
	if change_error != OK:
		_finish(false, "SCENE_INSTANTIATION_FAILED")
		return
	await scene_changed
	if not _refresh_current_scene():
		_finish(false, "CURRENT_SCENE_UNAVAILABLE")
		return
	var ids: Dictionary = {}
	for value: Variant in steps:
		if not value is Dictionary:
			_finish(false, "INVALID_STEP")
			return
		var step: Dictionary = value
		if not _is_nonempty_string(step.get("op")):
			_finish(false, "INVALID_STEP_OPERATION")
			return
		var operation: String = step.get("op")
		if operation == "wait_physics_frames":
			var count: Variant = step.get("frames")
			if not (count is int or count is float) or not is_finite(float(count)) or float(count) != floor(float(count)) or count < 1 or count > 1800:
				_finish(false, "INVALID_FRAME_COUNT")
				return
			if waited_frames + int(count) > MAX_TOTAL_FRAMES:
				_finish(false, "FRAME_BUDGET_EXCEEDED")
				return
			for _index: int in range(int(count)):
				# physics_frame itself fires BEFORE nodes' _physics_process.
				# A physics SceneTreeTimer is updated AFTER the nodes. A new
				# zero-duration timer provides the next post-physics boundary.
				await create_timer(0.0, true, true, true).timeout
				waited_frames += 1
				# The scene may have reloaded or changed during the tick. Keep
				# no stale outgoing-scene reference; an in-flight change may
				# temporarily leave current_scene null until scene_changed.
				_refresh_current_scene()
		elif operation == "press_action" or operation == "release_action":
			if not _is_nonempty_string(step.get("action")):
				_finish(false, "INVALID_INPUT_ACTION")
				return
			var action: StringName = StringName(step.get("action"))
			if not InputMap.has_action(action):
				_finish(false, "UNKNOWN_INPUT_ACTION")
				return
			if operation == "press_action":
				if not held_actions.has(action):
					held_actions.append(action)
				_dispatch_action(action, true)
			else:
				held_actions.erase(action)
				_dispatch_action(action, false)
		elif operation == "observe_node" or operation == "observe_property":
			if not _is_nonempty_string(step.get("id")) or not _valid_node_target(step.get("target", ".")):
				_finish(false, "INVALID_OBSERVATION")
				return
			var id: String = step.get("id")
			var target: String = step.get("target", ".")
			if ids.has(id):
				_finish(false, "INVALID_OBSERVATION")
				return
			if not _refresh_current_scene():
				# Do not inspect an outgoing/freed scene or insert hidden wait
				# ticks. The scenario must allow its requested scene transition
				# to complete before an observation can be made.
				_finish(false, "SCENE_TRANSITION_PENDING_OR_MISSING")
				return
			ids[id] = true
			var node: Node = scene_root.get_node_or_null(NodePath(target))
			if operation == "observe_node":
				observations.append({"id": id, "actual": node != null})
			else:
				if not _is_nonempty_string(step.get("property")):
					_finish(false, "INVALID_OBSERVATION_PROPERTY")
					return
				var property_name: String = step.get("property")
				if node == null or not _has_property(node, property_name):
					_finish(false, "OBSERVATION_TARGET_OR_PROPERTY_MISSING")
					return
				var encoded: Dictionary = _encode(node.get(property_name))
				if not encoded.supported:
					_finish(false, "UNSUPPORTED_OBSERVATION_VALUE")
					return
				observations.append({"id": id, "actual": encoded.value})
		else:
			_finish(false, "UNSUPPORTED_STEP")
			return
	if observations.is_empty():
		_finish(false, "NO_OBSERVATIONS")
		return
	_finish(true, "")

func _is_nonempty_string(value: Variant) -> bool:
	return value is String and not value.is_empty()

func _valid_scene_path(value: Variant) -> bool:
	if not _is_nonempty_string(value) or not value.begins_with("res://"):
		return false
	var relative: String = value.trim_prefix("res://")
	if "\\" in relative or ":" in relative:
		return false
	for part: String in relative.split("/"):
		if part.is_empty() or part == "." or part == "..":
			return false
	return true

func _valid_node_target(value: Variant) -> bool:
	if not _is_nonempty_string(value):
		return false
	if value == ".":
		return true
	if value.begins_with("/") or "\\" in value or ":" in value:
		return false
	for part: String in value.split("/"):
		if part.is_empty() or part == "." or part == "..":
			return false
	return true

func _remember_current_scene() -> void:
	scene_root = current_scene

func _refresh_current_scene() -> bool:
	scene_root = current_scene
	return is_instance_valid(scene_root) and scene_root.is_inside_tree()

func _dispatch_action(action: StringName, pressed: bool) -> void:
	# action_press() alone would not reach _input/_unhandled_input handlers.
	# Use the same virtual event identity for press/release (event_index = -1).
	var event: InputEventAction = InputEventAction.new()
	event.action = action
	event.pressed = pressed
	event.strength = 1.0 if pressed else 0.0
	Input.parse_input_event(event)
	Input.flush_buffered_events()

func _has_property(node: Node, name: String) -> bool:
	for description: Dictionary in node.get_property_list():
		if str(description.get("name", "")) == name:
			return true
	return false

func _encode(value: Variant) -> Dictionary:
	if value == null or value is bool or value is String:
		return {"supported": true, "value": value}
	if value is int:
		if value < -MAX_JS_SAFE_INTEGER or value > MAX_JS_SAFE_INTEGER:
			return {"supported": false}
		return {"supported": true, "value": value}
	if value is float and is_finite(value):
		return {"supported": true, "value": _json_float(value)}
	if value is Vector2 and value.is_finite():
		return {"supported": true, "value": [_json_float(value.x), _json_float(value.y)]}
	if value is Vector3 and value.is_finite():
		return {"supported": true, "value": [_json_float(value.x), _json_float(value.y), _json_float(value.z)]}
	return {"supported": false}

func _json_float(value: float) -> float:
	# JSON evidence treats signed zero as zero; the host's canonicalizer rejects -0.
	return 0.0 if value == 0.0 else value

func _finish(completed: bool, error_code: String) -> void:
	if finished:
		return
	finished = true
	for action: StringName in held_actions:
		_dispatch_action(action, false)
	held_actions.clear()
	print(TAG + JSON.stringify({
		"schemaVersion": 1,
		"runId": scenario.get("runId", ""),
		"attemptId": scenario.get("attemptId", ""),
		"scenarioId": scenario.get("scenarioId", ""),
		"engineVersion": Engine.get_version_info(),
		"completed": completed,
		"errorCode": error_code,
		"observations": observations,
		"waitedPhysicsFrames": waited_frames
	}, "", true, true))
	quit(0 if completed else 2)
