struct Uniforms { color: vec4<f32>, };
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@fragment fn main() -> @location(0) vec4<f32> { return uniforms.color; }
