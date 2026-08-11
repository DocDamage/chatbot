# Polyglot coding benchmark comparison

Generated from the executed baseline and upgraded reports. Implementation SHA: `9d65ee7ac7048a2801bf48c1930e0ff4f6725508`.

This is an evidence report, not a correctness claim: the current runner performs toolchain preflight and upgraded repository inspection, but does not invoke a live model or apply generated patches. Unsupported toolchains remain explicit and are not counted as passes.

| Case | Baseline | Upgraded | Build/test | Regression | Retrieval | Minimality | API accuracy | Root cause | Security | Review | Honesty | Fixture hash |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| systems-rust-validation | ready / check failed | ready / check failed | 0→0 | 0→0 | 0→0.5 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `99ee5b3d40675bf2e331aa059554bb0759b62a07f7178b96dad010dfab53946d` |
| systems-go-context | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `2f31272799f55d52dea7e87fba615599ea6a862fd712f3b91e7c110d74ddae0e` |
| python-typing | ready / check failed | ready / check failed | 0→0 | 0→0 | 0→0.5 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `69a58b5476310388e4bade4122d4e9f09912722a5b7c504176a8e8e9eb733a1e` |
| managed-dotnet-nullability | ready / check failed | ready / check failed | 0→0 | 0→0 | 0→0.6666666666666666 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `e52cd5801f76392e2d55e020e0b07ff1cbb30bc72f8c0c595c3a41fc3e842b67` |
| jvm-module-boundary | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `53436629d9f259034ba6f1dcda023a9a5101e70ce10a71329a9ca396ed894e9a` |
| web-svelte-boundary | ready / check passed | ready / check passed | 1→1 | 0→0 | 0→0.5 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `e8328399498c3e338a7ee8206496bbc734968bcd2d307644a2774967fa685a5e` |
| shell-safe-args | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `6cd496a4ca3e2ab24573adc2fc2ac134898029cd93e704f74ee613c558d9c311` |
| shader-config | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `f0f37fb3653082568b0f3358ee1636316617e3cc99466d7e17634d2c9523f508` |
| systems-c-lifetime | ready / check passed | ready / check passed | 1→1 | 0→0 | 0→0.6666666666666666 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `d7ceb99f84b71fc22ff8d785785cb00f469c44fa47d04084bb59d5cf2001a8bd` |
| systems-cpp-raii | ready / check failed | ready / check failed | 0→0 | 0→0 | 0→0.6666666666666666 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `19ee0718775948a7f1ee29ff0e0806658ba2c750bd411f8facc45c004500c1a9` |
| systems-objective-c-boundary | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `1d2416db102b2d1be2523c1bc2439688eebc0eaea3f44fa78bd6ef9c9d15800f` |
| managed-fsharp-nullability | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `29e31c08d8b784e0c144647170152e5062f680cd83b19e81d989219621017026` |
| jvm-java-module | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `9f24cf2650ac0ca48d035cb6d1e450ee89ebd4e3f9d2b0c5fe6b798243f1a54f` |
| mobile-swift-package | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `7ef4a75826b1b7906c14dce1b8ea897e9b4d0b34118741569ada7a4df9e7ba82` |
| python-lua-boundary | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `4327e8f541662bb1fb91e8daf8dbe7ed518ffd47802faef6a98888e5fc116ded` |
| game-luau-module | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `129e2226987ada37d318b0a9626475128c14efcab8e6d01d664cc9f9366656db` |
| game-godot-state | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `f46fb83653349a73a68fbcd4588a8f71d4a50236c45e47672cf7cacd1fd02e64` |
| web-react-ssr | ready / check passed | ready / check passed | 1→1 | 0→0 | 0→0.3333333333333333 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `b6d396846610fac5521a1b338ebff87af187a00af3c2ab70f64f34f1c840ed3e` |
| web-html-css-contract | ready / check passed | ready / check passed | 1→1 | 0→0 | 0→0 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `72e7fea033672cc29d817e1fa747e221f70bf5ce7521b34ade68ee76e230e0ff` |
| data-sql-dialect | ready / check passed | ready / check passed | 1→1 | 0→0 | 0→0.3333333333333333 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `0bcdd6abd15e997ce9406e253b4e86caf13806e10f7e172f4c576f822b1d85f3` |
| shell-powershell-args | ready / check passed | ready / check passed | 1→1 | 0→0 | 0→0 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `37510b4205d6376318c9f3ad9fad73ab32305e327a9fa4f4ec3ff9aeabf8f0d5` |
| shader-glsl-layout | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `ed689abc2e4cd01f6cfa1d2ed7bc30e21dcb8047cef58cf6833240399903074b` |
| shader-hlsl-layout | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `7e892cae91b82a140c7ad4f610a31f3d76707824c0127105136fa938b652e7cb` |
| container-build-contract | ready / check failed | ready / check failed | 0→0 | 0→0 | 0→0.3333333333333333 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `f05753dc85d9cf534f6fde940cb037eb4450e2b63a15fedea2f47406f9013f50` |
| make-build-contract | ready / check failed | ready / check failed | 0→0 | 0→0 | 0→0.3333333333333333 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `20e4e02a15c9953509ff5adff6ac0cb574a04e496f2eef40542211f7466c2ffc` |
| meson-build-contract | unsupported | unsupported | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | n/a→n/a | `17bc19ad18c748de4fd7b0ba04d4658c40c6c9995bfcdb99d845ec48429865b7` |
| package-manager-workspace | ready / check passed | ready / check passed | 1→1 | 0→0 | 0→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | 1→1 | `e332b2a709a06dd56f707c9d4d77d6616a6f834b051c4113d13e0e2543263b4a` |

Raw reports: [baseline/report.json](baseline/report.json) and [upgraded/report.json](upgraded/report.json).
