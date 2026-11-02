extends SceneTree

func _initialize() -> void:
	call_deferred("_run_probe")

func _run_probe() -> void:
	var scene_path := str(ProjectSettings.get_setting("application/run/main_scene", ""))
	if scene_path != "":
		var packed := load(scene_path) as PackedScene
		if packed:
			root.add_child(packed.instantiate())
	for _frame in range(60):
		await process_frame
	print("CHATBOT_PROFILE_JSON:" + JSON.stringify({
		"fps": Performance.get_monitor(Performance.TIME_FPS),
		"frameTimeMs": Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
		"drawCalls": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"nodeCount": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
		"memoryMb": Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0,
		"vramMb": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0,
		"physicsTickRate": Engine.physics_ticks_per_second
	}))
	quit()
