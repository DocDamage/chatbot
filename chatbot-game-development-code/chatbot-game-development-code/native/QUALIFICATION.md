# Godot scenario probe qualification

**Status: the native tests below have NOT been executed in this environment.** No native Godot installation, import, compilation, scene execution or engine qualification is claimed. The TypeScript reference tests do not validate this GDScript or an installed engine.

## Profile and execution contract

`godot_scenario_probe.gd` is written for the **Godot 4.7 profile**. It rejects other major/minor versions at runtime. Every invocation must also provide `expectedEngineVersion` and `expectedEngineHash`, copied from the enrolled executable's `Engine.get_version_info().string` and `.hash`. These values must match exactly. The version string contains the patch/status/build fields; it is not necessarily identical to the CLI's `--version` display. The host additionally verifies the actual executable's SHA-256, OS/architecture, project snapshot, probe hash and approved tool invocation. Matching this input gate is eligibility for qualification, not proof that qualification has passed.

Run only in an enrolled isolated project snapshot. The host validates and serializes the scenario as strict JSON, supplies its path in `CHATBOT_SCENARIO_INPUT`, starts the pinned executable with an argument array, captures stdout/stderr, enforces a deadline and owns/terminates its process tree. Godot's JSON parser is permissive about some nonstandard syntax; this probe does not replace the host's strict JSON boundary.

The input requires these fields:

| Field | Contract |
|---|---|
| `schemaVersion` | JSON number exactly `1`. Godot may represent the parsed number as an integer or float. A string, boolean, fractional value or missing value is rejected. |
| `runId`, `attemptId`, `scenarioId` | Nonempty strings matching the host's invocation record. |
| `expectedEngineVersion`, `expectedEngineHash` | Exact enrolled `Engine.get_version_info()` string and engine commit; no wildcard or guessed version. |
| `scene` | A confined `res://` PackedScene path in the enrolled project snapshot. Host realpath/symlink checks remain necessary. |
| `steps` | A nonempty bounded array of supported operations. Observations have unique nonempty IDs. |

Supported operations are `press_action`, `release_action`, `wait_physics_frames`, `observe_node`, and `observe_property`. Action names must already exist in the project's InputMap. Observation targets are relative to the **current scene**, with `.` selecting its root. Property observations support null, booleans, strings, integers within ±9,007,199,254,740,991, finite floats, and finite Vector2/Vector3 values encoded as arrays. Dictionaries, arbitrary arrays, resources, objects and nonfinite values are rejected. Signed floating zero is normalized to positive zero. Output uses full floating-point precision; the host selects an appropriate numeric/tolerance comparator for each original acceptance requirement.

The probe prints one `CHATBOT_GAME_SCENARIO_V1:` report containing observations, identities, actual engine information, completion/error status and completed physics waits. `completed: true` means the observation procedure completed. It does **not** mean assertions passed. The host rejects malformed/missing/duplicate reports, wrong identities, nonzero exits, fatal diagnostics and stale artifacts, then compares observations with its unchanged acceptance plan.

## Native tests required before enabling the profile

Use minimal legal fixture scenes and scripts. Keep the fixture code, scenario input, probe and executable hashes, exact engine information, command arguments, process result, raw logs, parsed observations and host verdict for each case. The tests below are qualification specifications, **not recorded passing results**.

| Area | Native fixture/scenario | Required result |
|---|---|---|
| Parse/import | Import an isolated fixture project and parse this probe with the exact enrolled Godot 4.7 build. | No parser/type errors; every required API resolves on the pinned build. A matching version gate alone does not satisfy this test. |
| Exact tick count | A node increments a public integer in `_physics_process`. Observe baseline, wait 1, observe; repeat for 2, 7 and 60 waits and for adjacent wait operations. | Each observed counter delta equals the requested number of completed physics ticks. Run with different renderer frame caps and multiple physics steps per render frame. This catches an early `physics_frame` wakeup and timer scheduling errors. |
| Held input over one tick | A node increments a second counter only when `Input.is_action_pressed("probe_action")` in `_physics_process`. Press, wait exactly 1, release, observe; then wait another tick and observe again. | The pressed counter increases by exactly one before release and does not increase during the following released tick. Repeat for longer holds. |
| Polling and event callbacks | A fixture records polled action state, `_input` press/release counts and `_unhandled_input` press/release counts. Send one press and one release with a physics wait between. | Polling sees the held action; `_input` receives the virtual press/release; `_unhandled_input` receives them when no earlier handler consumes the event. |
| Handled-event behavior | A second fixture consumes the test action in `_input` using the viewport's handled-event mechanism. | `_input` receives the event and `_unhandled_input` does not. The test must not demand that an already-handled event propagate further. This preserves normal dispatch semantics. |
| Input cleanup | End a successful scenario while an action remains held; separately provoke an invalid observation after a press. | Cleanup dispatches a matching release, no duplicate result report is printed, and the process exits with the correct completion/error status. The host checks fatal cleanup diagnostics too. |
| Initial current scene | The fixture exposes whether `get_tree().current_scene` is its root after initialization. | The observation confirms the normal current-scene relationship. Loading uses `change_scene_to_packed` and waits for `scene_changed`; it does not merely attach a detached instance to the root. |
| Scene replacement | An input event switches from scene A to B. Their roots expose different public markers. Allow the transition to complete, then observe `.` and a node existing only in B. | Observations come from B, with no reference to the freed A. A scene change may leave `current_scene` null until the end-of-frame replacement completes. The probe refreshes on `scene_changed` and before observations. |
| Current-scene reload | A fixture triggers `reload_current_scene()` in response to a test action; an autoload tracks its generation. After the reload completes, observe the new generation marker. | Reload succeeds, the new scene instance is observed, and the probe remains alive because it is the SceneTree script. It must not access the freed old instance. |
| Transition still pending | Trigger a scene change and immediately observe, without allowing it to finish. | An unavailable current scene yields `SCENE_TRANSITION_PENDING_OR_MISSING`, not observations of the outgoing scene or silently inserted simulation ticks. For successful transition tests, specify sufficient frame waits and validate the generation marker. |
| Numeric schema | Feed schema versions `1` and `1.0`; then `"1"`, `true`, `1.9`, `0`, null and a missing value. | Only the numeric values equal to one reach scene execution. All others produce `UNSUPPORTED_SCENARIO_SCHEMA`. |
| Exact integer transport | Expose ±9,007,199,254,740,991 and ordinary small integer properties; parse the emitted report with the actual Node host. | Values survive exactly. Exposing ±9,007,199,254,740,992, ±9,007,199,254,740,993 and extreme signed 64-bit integers yields `UNSUPPORTED_OBSERVATION_VALUE`, never rounded acceptance. |
| Floating/vector transport | Observe representative finite floats and Vector2/Vector3 values, including signed zero and values near the host tolerance boundary. | Full-precision JSON round-trips the supported floating values; zero is canonicalized; the host's tolerance boundary behaves as specified. Test NaN/infinity and unsupported property types separately and require rejection. |
| Profile mismatch | Invoke with a mismatched exact version string or commit; also parse/run on another major/minor only in a controlled compatibility test. | Mismatches fail. Do not report compatibility with another engine profile merely because the probe happened to parse there. Missing identity fields fail before scene loading. |
| Budgets/failures | Use invalid actions, duplicate observation IDs, missing properties, a missing scene, excess steps, excess frame counts and a process that never completes initialization. | Invalid inputs fail with a report when possible; the host treats absent reports and process timeouts as incomplete/failure and terminates its owned process tree. |

`wait_physics_frames` counts post-physics timer completions. It does not assert that paused gameplay nodes ran or that a scene existed throughout the wait. The fixture's own state observations establish those facts. Runtime scene transitions can complete at end-of-frame; the probe refreshes its scene reference but does not insert invisible waits to make a scenario pass.

Event injection uses virtual `InputEventAction` events. This qualifies action dispatch and polling, not physical keyboard scan codes, mouse coordinates, touch devices, hardware controllers or rendered UI interaction. Those require separate native capabilities and tests. Rendering-dependent behavior also requires separate visual evidence.

## Version-specific primary references

The implementation choices were checked against the Godot **4.7** documentation:

- [SceneTree](https://docs.godotengine.org/en/4.7/classes/class_scenetree.html): `change_scene_to_packed`, `scene_changed`, temporary null `current_scene`, and timers processed after node callbacks.
- [Input](https://docs.godotengine.org/en/4.7/classes/class_input.html) and [InputEventAction](https://docs.godotengine.org/en/4.7/classes/class_inputeventaction.html): dispatched virtual action events and their relationship to polling/event handlers.
- [Engine](https://docs.godotengine.org/en/4.7/classes/class_engine.html): exact version/build/commit information.
- [JSON](https://docs.godotengine.org/en/4.7/classes/class_json.html): numeric representation, parser limitations and `full_precision` output.

Documentation review supports the design; it does not replace the native qualification matrix above.
