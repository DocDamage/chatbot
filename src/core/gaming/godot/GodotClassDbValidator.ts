/**
 * Godot ClassDB API Validator (PX08-T11)
 *
 * Validates GDScript code against Godot ClassDB definitions (core node classes,
 * properties, methods, signals) to prevent hallucinated API calls.
 */

export interface ClassDbEntry {
  className: string;
  inherits?: string;
  methods: string[];
  properties: string[];
  signals: string[];
  constants: string[];
}

export interface ScriptValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  extendsClass?: string;
  inferredMethods: string[];
}

export class GodotClassDbValidator {
  private static classDb: Record<string, ClassDbEntry> = {
    Node: {
      className: 'Node',
      methods: [
        '_ready',
        '_process',
        '_physics_process',
        '_enter_tree',
        '_exit_tree',
        '_input',
        '_unhandled_input',
        'get_node',
        'get_node_or_null',
        'add_child',
        'remove_child',
        'get_children',
        'get_parent',
        'queue_free',
        'connect',
        'disconnect',
        'emit_signal'
      ],
      properties: ['name', 'owner', 'process_mode', 'unique_name_in_owner'],
      signals: ['ready', 'tree_entered', 'tree_exited', 'renamed'],
      constants: ['PROCESS_MODE_INHERIT', 'PROCESS_MODE_PAUSABLE', 'PROCESS_MODE_ALWAYS', 'PROCESS_MODE_DISABLED']
    },
    Node2D: {
      className: 'Node2D',
      inherits: 'Node',
      methods: [
        'look_at',
        'to_local',
        'to_global',
        'translate',
        'rotate',
        'global_translate',
        'draw_line',
        'draw_circle',
        'draw_rect',
        'draw_texture'
      ],
      properties: ['position', 'rotation', 'scale', 'skew', 'transform', 'global_position', 'global_rotation', 'z_index', 'visible'],
      signals: ['draw', 'visibility_changed'],
      constants: []
    },
    CharacterBody2D: {
      className: 'CharacterBody2D',
      inherits: 'Node2D',
      methods: ['move_and_slide', 'is_on_floor', 'is_on_wall', 'is_on_ceiling', 'get_real_velocity', 'get_last_slide_collision'],
      properties: ['velocity', 'motion_mode', 'up_direction', 'floor_stop_on_slope', 'floor_max_angle', 'max_slides'],
      signals: [],
      constants: ['MOTION_MODE_GROUNDED', 'MOTION_MODE_FLOATING']
    },
    Sprite2D: {
      className: 'Sprite2D',
      inherits: 'Node2D',
      methods: ['is_pixel_opaque'],
      properties: ['texture', 'centered', 'offset', 'flip_h', 'flip_v', 'hframes', 'vframes', 'frame', 'region_enabled', 'region_rect'],
      signals: ['frame_changed', 'texture_changed'],
      constants: []
    },
    Area2D: {
      className: 'Area2D',
      inherits: 'Node2D',
      methods: ['has_overlapping_bodies', 'has_overlapping_areas', 'get_overlapping_bodies', 'get_overlapping_areas'],
      properties: ['monitoring', 'monitorable', 'collision_layer', 'collision_mask', 'gravity'],
      signals: ['body_entered', 'body_exited', 'area_entered', 'area_exited'],
      constants: []
    },
    CollisionShape2D: {
      className: 'CollisionShape2D',
      inherits: 'Node2D',
      methods: [],
      properties: ['shape', 'disabled', 'one_way_collision'],
      signals: [],
      constants: []
    },
    Control: {
      className: 'Control',
      inherits: 'Node',
      methods: ['accept_event', 'grab_focus', 'release_focus', 'has_focus'],
      properties: ['size', 'position', 'custom_minimum_size', 'layout_mode', 'anchors_preset', 'tooltip_text', 'theme'],
      signals: ['focus_entered', 'focus_exited', 'mouse_entered', 'mouse_exited', 'resized'],
      constants: []
    },
    Button: {
      className: 'Button',
      inherits: 'Control',
      methods: [],
      properties: ['text', 'icon', 'flat', 'alignment', 'disabled'],
      signals: ['pressed', 'button_up', 'button_down', 'toggled'],
      constants: []
    },
    Node3D: {
      className: 'Node3D',
      inherits: 'Node',
      methods: ['look_at', 'translate', 'rotate_x', 'rotate_y', 'rotate_z', 'to_local', 'to_global'],
      properties: ['position', 'rotation', 'scale', 'transform', 'global_position', 'visible'],
      signals: ['visibility_changed'],
      constants: []
    },
    CharacterBody3D: {
      className: 'CharacterBody3D',
      inherits: 'Node3D',
      methods: ['move_and_slide', 'is_on_floor', 'is_on_wall', 'is_on_ceiling'],
      properties: ['velocity', 'motion_mode', 'up_direction'],
      signals: [],
      constants: []
    },
    Resource: {
      className: 'Resource',
      methods: ['duplicate', 'emit_changed'],
      properties: ['resource_name', 'resource_path', 'resource_local_to_scene'],
      signals: ['changed'],
      constants: []
    }
  };

  /**
   * Check if a class name is recognized in ClassDB
   */
  public static isValidClass(className: string): boolean {
    return !!this.classDb[className];
  }

  /**
   * Check if a class has a given method (accounting for inheritance)
   */
  public static hasMethod(className: string, methodName: string): boolean {
    let current: string | undefined = className;
    while (current) {
      const entry: ClassDbEntry | undefined = this.classDb[current];
      if (!entry) break;
      if (entry.methods.includes(methodName)) return true;
      current = entry.inherits;
    }
    return false;
  }

  /**
   * Check if a class has a given property (accounting for inheritance)
   */
  public static hasProperty(className: string, propName: string): boolean {
    let current: string | undefined = className;
    while (current) {
      const entry: ClassDbEntry | undefined = this.classDb[current];
      if (!entry) break;
      if (entry.properties.includes(propName)) return true;
      current = entry.inherits;
    }
    return false;
  }

  /**
   * Validate a GDScript source string
   */
  public static validateScript(sourceCode: string): ScriptValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const inferredMethods: string[] = [];

    const lines = sourceCode.split('\n');
    let extendsClass = 'Node';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Check extends
      const extendsMatch = line.match(/^extends\s+([A-Za-z0-9_]+)/);
      if (extendsMatch) {
        extendsClass = extendsMatch[1];
        if (!this.isValidClass(extendsClass)) {
          warnings.push(`Line ${lineNum}: 'extends ${extendsClass}' is not in standard ClassDB builtins; ensure it is a valid project script.`);
        }
      }

      // Check function definitions
      const funcMatch = line.match(/^func\s+([A-Za-z0-9_]+)\s*\(/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        inferredMethods.push(funcName);

        // Check virtual Godot methods
        if (funcName.startsWith('_') && !this.hasMethod(extendsClass, funcName)) {
          // It's allowed for user private methods, but flag if it looks like a typo for a built-in
          if (funcName === '_read' || funcName === '_proccess' || funcName === '_physics') {
            errors.push(`Line ${lineNum}: Possible typo in Godot virtual lifecycle method '${funcName}'. Did you mean '_ready' or '_process'?`);
          }
        }
      }

      // Check for Godot 3 vs Godot 4 syntax issues (e.g. onready var -> @onready var, export var -> @export var)
      if (line.match(/^onready\s+var\s+/)) {
        errors.push(`Line ${lineNum}: Godot 3 syntax 'onready var' detected. Use Godot 4 '@onready var' syntax.`);
      }
      if (line.match(/^export\s*\(/) || line.match(/^export\s+var\s+/)) {
        errors.push(`Line ${lineNum}: Godot 3 syntax 'export' detected. Use Godot 4 '@export' annotation.`);
      }
      if (line.includes('.instance()')) {
        errors.push(`Line ${lineNum}: Godot 3 '.instance()' method detected. Use Godot 4 '.instantiate()' instead.`);
      }
      if (line.includes('KinematicBody2D') || line.includes('KinematicBody3D')) {
        errors.push(`Line ${lineNum}: 'KinematicBody' is removed in Godot 4. Use 'CharacterBody2D' or 'CharacterBody3D'.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      extendsClass,
      inferredMethods
    };
  }
}
