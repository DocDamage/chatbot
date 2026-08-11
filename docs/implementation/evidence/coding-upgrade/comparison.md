# Polyglot coding benchmark comparison

This report records the reproducible fixture and toolchain preflight for the baseline and upgraded runs. It is intentionally not a correctness claim: the runner does not invoke a model or apply generated patches. The upgraded run additionally records repository-controller retrieval evidence; build/test, hidden-regression, minimality, and verification-honesty scores are not populated here.

| Case | Family | Toolchain | Baseline | Upgraded | Fixture hash |
|---|---|---|---|---|---|
| systems-rust-validation | systems | cargo | ready / test failed | ready / test failed | `99ee5b3d40675bf2e331aa059554bb0759b62a07f7178b96dad010dfab53946d` |
| systems-go-context | systems | go | unsupported | unsupported | `2f31272799f55d52dea7e87fba615599ea6a862fd712f3b91e7c110d74ddae0e` |
| python-typing | python | python | ready / test failed | ready / test failed | `69a58b5476310388e4bade4122d4e9f09912722a5b7c504176a8e8e9eb733a1e` |
| managed-dotnet-nullability | managed | dotnet | ready / run failed | ready / run failed | `e52cd5801f76392e2d55e020e0b07ff1cbb30bc72f8c0c595c3a41fc3e842b67` |
| jvm-module-boundary | jvm | gradle | unsupported | unsupported | `53436629d9f259034ba6f1dcda023a9a5101e70ce10a71329a9ca396ed894e9a` |
| web-svelte-boundary | web | node | ready / test passed | ready / test passed | `e8328399498c3e338a7ee8206496bbc734968bcd2d307644a2774967fa685a5e` |
| shell-safe-args | web/config/build | shellcheck | unsupported | unsupported | `6cd496a4ca3e2ab24573adc2fc2ac134898029cd93e704f74ee613c558d9c311` |
| shader-config | web/config/build | shader-validator | unsupported | unsupported | `f0f37fb3653082568b0f3358ee1636316617e3cc99466d7e17634d2c9523f508` |

The authoritative raw reports are [baseline/report.json](baseline/report.json) and [upgraded/report.json](upgraded/report.json). Unsupported toolchains are excluded from pass counts rather than treated as successful cases.
