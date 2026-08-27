export const UNITY_INSTRUMENTATION_BRIDGE = String.raw`using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Profiling;

public static class ChatBotHubInstrumentationBridge {
  [Serializable] private sealed class Request { public string mode; public string scenePath; public int durationMs; public Assertion[] assertions; }
  [Serializable] private sealed class Assertion { public string type; public string target; public string property; public string expectedJson; }
  [Serializable] private sealed class AssertionResult { public string actualJson; public bool passed; }
  [Serializable] private sealed class ProfileResult { public string timestamp; public float fps; public float frameTimeMs; public int drawCalls; public int nodeCount; public float memoryMb; public float vramMb; public float physicsTickRate; }
  [Serializable] private sealed class Result { public string mode; public string scenarioName; public long durationMs; public AssertionResult[] assertions; public ProfileResult profile; public string error; }

  private static Request request;
  private static string resultPath;
  private static Stopwatch stopwatch;
  private static readonly List<float> frameTimes = new List<float>();
  private static bool originalEnterPlayModeOptionsEnabled;
  private static EnterPlayModeOptions originalEnterPlayModeOptions;

  public static void Run() {
    try {
      var requestPath = Environment.GetEnvironmentVariable("CHATBOT_ENGINE_REQUEST");
      resultPath = Environment.GetEnvironmentVariable("CHATBOT_ENGINE_RESULT");
      if (String.IsNullOrWhiteSpace(requestPath) || String.IsNullOrWhiteSpace(resultPath)) throw new InvalidOperationException("Instrumentation request/result paths are required.");
      request = JsonUtility.FromJson<Request>(File.ReadAllText(requestPath));
      if (!String.IsNullOrWhiteSpace(request.scenePath)) EditorSceneManager.OpenScene(request.scenePath, OpenSceneMode.Single);
      originalEnterPlayModeOptionsEnabled = EditorSettings.enterPlayModeOptionsEnabled;
      originalEnterPlayModeOptions = EditorSettings.enterPlayModeOptions;
      EditorSettings.enterPlayModeOptionsEnabled = true;
      EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload | EnterPlayModeOptions.DisableSceneReload;
      stopwatch = Stopwatch.StartNew();
      frameTimes.Clear();
      EditorApplication.update += Tick;
      EditorApplication.EnterPlaymode();
    } catch (Exception error) {
      Finish(new Result { mode = "error", error = error.ToString() }, 3);
    }
  }

  private static void Tick() {
    if (!EditorApplication.isPlaying) return;
    if (Time.unscaledDeltaTime > 0) frameTimes.Add(Time.unscaledDeltaTime * 1000f);
    var targetDuration = Math.Max(250, request.durationMs);
    if (stopwatch.ElapsedMilliseconds < targetDuration || frameTimes.Count < 2) return;
    try {
      if (request.mode == "profile") {
        var mean = frameTimes.Average();
        Finish(new Result {
          mode = "profile",
          scenarioName = String.IsNullOrWhiteSpace(request.scenePath) ? "active scene" : request.scenePath,
          durationMs = stopwatch.ElapsedMilliseconds,
          profile = new ProfileResult {
            timestamp = DateTime.UtcNow.ToString("o"), fps = mean > 0 ? 1000f / mean : 0f, frameTimeMs = mean,
            drawCalls = UnityStats.drawCalls,
            nodeCount = UnityEngine.Object.FindObjectsByType<GameObject>(FindObjectsInactive.Include, FindObjectsSortMode.None).Length,
            memoryMb = Profiler.GetTotalAllocatedMemoryLong() / 1048576f,
            vramMb = Profiler.GetAllocatedMemoryForGraphicsDriver() / 1048576f,
            physicsTickRate = Time.fixedDeltaTime > 0 ? 1f / Time.fixedDeltaTime : 0f
          }
        }, 0);
        return;
      }

      var requested = request.assertions ?? new Assertion[0];
      var evaluated = requested.Select(Evaluate).ToArray();
      Finish(new Result {
        mode = "scenario", scenarioName = String.IsNullOrWhiteSpace(request.scenePath) ? "active scene" : request.scenePath,
        durationMs = stopwatch.ElapsedMilliseconds, assertions = evaluated,
        error = evaluated.All(item => item.passed) ? null : "One or more project-side assertions failed."
      }, evaluated.All(item => item.passed) ? 0 : 2);
    } catch (Exception error) {
      Finish(new Result { mode = "error", error = error.ToString() }, 3);
    }
  }

  private static AssertionResult Evaluate(Assertion assertion) {
    var target = UnityEngine.Object.FindObjectsByType<GameObject>(FindObjectsInactive.Include, FindObjectsSortMode.None)
      .FirstOrDefault(item => item.name == assertion.target || HierarchyPath(item.transform) == assertion.target);
    if (assertion.type == "node_exists") return Value(target != null, assertion.expectedJson);
    if (assertion.type == "fps_above") {
      var mean = frameTimes.Count > 0 ? frameTimes.Average() : 0f;
      var fps = mean > 0 ? 1000f / mean : 0f;
      double expected;
      return new AssertionResult { actualJson = fps.ToString(System.Globalization.CultureInfo.InvariantCulture), passed = Double.TryParse(assertion.expectedJson, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out expected) && fps > expected };
    }
    if (target == null) return new AssertionResult { actualJson = "null", passed = false };
    object actual;
    if (assertion.type == "screen_text") actual = ReadMember(target, String.IsNullOrWhiteSpace(assertion.property) ? "text" : assertion.property);
    else if (assertion.type == "property_equals") actual = ReadMember(target, assertion.property);
    else return new AssertionResult { actualJson = Quote("Unsupported assertion type: " + assertion.type), passed = false };
    return Value(actual, assertion.expectedJson);
  }

  private static object ReadMember(GameObject target, string memberPath) {
    var pieces = (memberPath ?? "").Split(new[] { '.' }, 2);
    var candidates = target.GetComponents<Component>().Where(component => component != null);
    if (pieces.Length == 2) candidates = candidates.Where(component => component.GetType().Name == pieces[0] || component.GetType().FullName == pieces[0]);
    var member = pieces.Length == 2 ? pieces[1] : pieces[0];
    foreach (var component in candidates) {
      var type = component.GetType();
      var property = type.GetProperty(member, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
      if (property != null) return property.GetValue(component, null);
      var field = type.GetField(member, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
      if (field != null) return field.GetValue(component);
    }
    return null;
  }

  private static AssertionResult Value(object actual, string expectedJson) {
    var actualJson = actual == null ? "null" : actual is bool ? ((bool)actual ? "true" : "false") : actual is string ? Quote((string)actual) : Convert.ToString(actual, System.Globalization.CultureInfo.InvariantCulture);
    return new AssertionResult { actualJson = actualJson, passed = String.Equals(actualJson, expectedJson, StringComparison.Ordinal) };
  }

  private static string Quote(string value) { return "\"" + (value ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n") + "\""; }
  private static string HierarchyPath(Transform value) { return value.parent == null ? value.name : HierarchyPath(value.parent) + "/" + value.name; }

  private static void Finish(Result result, int exitCode) {
    try {
      EditorApplication.update -= Tick;
      if (EditorApplication.isPlaying) EditorApplication.ExitPlaymode();
      EditorSettings.enterPlayModeOptionsEnabled = originalEnterPlayModeOptionsEnabled;
      EditorSettings.enterPlayModeOptions = originalEnterPlayModeOptions;
      if (!String.IsNullOrWhiteSpace(resultPath)) File.WriteAllText(resultPath, JsonUtility.ToJson(result, true));
    } finally { EditorApplication.Exit(exitCode); }
  }
}
`;

export const UNREAL_INSTRUMENTATION_BRIDGE = String.raw`import ctypes
import datetime
import json
import os
import subprocess
import time
import traceback
import unreal

request_path = os.environ.get("CHATBOT_ENGINE_REQUEST")
result_path = os.environ.get("CHATBOT_ENGINE_RESULT")

def json_value(value):
    try:
        return value if value is None or isinstance(value, (bool, int, float, str, list, dict)) else str(value)
    except Exception:
        return str(value)

def actors():
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    return list(subsystem.get_all_level_actors())

def actor_name(actor):
    try:
        return actor.get_actor_label()
    except Exception:
        return actor.get_name()

def find_actor(target):
    return next((actor for actor in actors() if actor_name(actor) == target or actor.get_name() == target), None)

def evaluate(assertion, fps):
    kind = assertion.get("type")
    target_name = assertion.get("target", "")
    target = find_actor(target_name)
    expected = assertion.get("expected")
    if kind == "node_exists":
        actual = len(actors()) > 0 if target_name == "*" else target is not None
        return {"actual": actual, "passed": actual == expected}
    if kind == "fps_above":
        return {"actual": fps, "passed": isinstance(expected, (int, float)) and fps > expected}
    if target is None:
        return {"actual": None, "passed": False}
    if kind in ("property_equals", "screen_text"):
        member = assertion.get("property") or ("text" if kind == "screen_text" else "")
        try:
            actual = json_value(target.get_editor_property(member))
        except Exception:
            actual = None
        return {"actual": actual, "passed": actual == expected}
    return {"actual": "Unsupported assertion type: " + str(kind), "passed": False}

def working_set_mb():
    try:
        class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
            _fields_ = [("cb", ctypes.c_ulong), ("PageFaultCount", ctypes.c_ulong), ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]
        counters = PROCESS_MEMORY_COUNTERS()
        counters.cb = ctypes.sizeof(counters)
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        if not ctypes.windll.psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb):
            raise RuntimeError("GetProcessMemoryInfo failed")
        return counters.WorkingSetSize / 1048576.0
    except Exception:
        try:
            value = subprocess.check_output(["powershell.exe", "-NoProfile", "-Command", "(Get-Process -Id %d).WorkingSet64" % os.getpid()], text=True)
            return float(value.strip()) / 1048576.0
        except Exception:
            return 0.0

def process_uptime_seconds():
    try:
        creation = ctypes.c_ulonglong()
        exit_time = ctypes.c_ulonglong()
        kernel = ctypes.c_ulonglong()
        user = ctypes.c_ulonglong()
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        if not ctypes.windll.kernel32.GetProcessTimes(handle, ctypes.byref(creation), ctypes.byref(exit_time), ctypes.byref(kernel), ctypes.byref(user)):
            return 0.0
        unix_creation = creation.value / 10000000.0 - 11644473600.0
        return max(0.0, time.time() - unix_creation)
    except Exception:
        return 0.0

try:
    if not request_path or not result_path:
        raise RuntimeError("Instrumentation request/result paths are required.")
    with open(request_path, "r", encoding="utf-8") as handle:
        request = json.load(handle)
    scene_path = request.get("scenePath")
    if scene_path:
        unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(scene_path)
    began = time.perf_counter()
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    start_frame = int(unreal.SystemLibrary.get_frame_count())
    start_game_time = float(unreal.SystemLibrary.get_game_time_in_seconds(world))
    target_seconds = max(0.25, request.get("durationMs", 1000) / 1000.0)
    while time.perf_counter() - began < target_seconds:
        time.sleep(0.01)
    frame_count = max(0, int(unreal.SystemLibrary.get_frame_count()) - start_frame)
    game_seconds = max(0.0, float(unreal.SystemLibrary.get_game_time_in_seconds(world)) - start_game_time)
    frame_ms = (game_seconds * 1000.0 / frame_count) if frame_count > 0 else 0.0
    fps = (frame_count / game_seconds) if game_seconds > 0 else 0.0
    if fps <= 0:
        uptime = process_uptime_seconds()
        lifetime_frames = int(unreal.SystemLibrary.get_frame_count())
        fps = (lifetime_frames / uptime) if uptime > 0 else 0.0
        frame_ms = (1000.0 / fps) if fps > 0 else 0.0
    if request.get("mode") == "profile":
        output = {"mode": "profile", "scenarioName": scene_path or "active level", "durationMs": round((time.perf_counter() - began) * 1000), "profile": {"timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(), "fps": fps, "frameTimeMs": frame_ms, "nodeCount": len(actors()), "memoryMb": working_set_mb()}}
    else:
        evaluated = [evaluate(assertion, fps) for assertion in request.get("assertions", [])]
        output = {"mode": "scenario", "scenarioName": scene_path or "active level", "durationMs": round((time.perf_counter() - began) * 1000), "assertions": evaluated, "error": None if all(item["passed"] for item in evaluated) else "One or more project-side assertions failed."}
except Exception as error:
    output = {"mode": "error", "error": str(error), "traceback": traceback.format_exc()}

with open(result_path, "w", encoding="utf-8") as handle:
    json.dump(output, handle, indent=2)
if output.get("mode") == "error":
    raise RuntimeError(output["error"])
`;
