# ADR-0018: Lattice Game-Development Capability

- Status: Accepted
- Date: 2026-08-24
- Scope: Capability Fusion / CF-08
- Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Decision

CF-08 delivers an optional, safely isolated game-development package for deterministic isometric scenario design, simulation modeling, agent planning, and reproducible replay workflows.

1. **`LatticeWorldSchema` & Scenario Boundary**:
   Defines clean 3D isometric tile grids (`x`, `y`, `z`), typed entities (`player`, `enemy`, `npc`, `item`, `obstacle`), action envelopes, and win-loss conditions. The schema is strictly validated against grid bounds and dimension budgets with a cryptographic SHA-256 digest (`computeLatticeWorldDigest`).
2. **Deterministic Seedable Simulation Engine**:
   `LatticeSimulationEngine` incorporates a seedable Mulberry32 PRNG to guarantee reproducible state transitions, entity wander/patrol paths, combat resolutions, and action queues. Identical scenario seeds and action streams produce identical snapshot digests on every tick.
3. **Decoupled Lightweight Architecture**:
   The capability does not couple the core chatbot to a heavyweight 3D engine or browser WebGL canvas. Simulations execute headlessly in pure TypeScript.
4. **Accessible Visual and Non-Visual Representations**:
   `LatticeVisualizer` generates non-visual 2D ASCII grid representations with legends and markdown entity state tables for screen-reader and terminal use, alongside clean, lightweight 2D isometric SVG previews for visual debugging.
5. **Specialist Playbook Integration**:
   `LatticeGameAdapter` integrates isometric scenario modeling into `GamingPlaybookService` and `GameDevGeniusAgent`, allowing automated playtest verification, encounter balance checks, and dungeon scenario generation.

## Boundaries and Security Invariants

- **Clean License Boundary**: Pure MIT-compatible algorithms and clean-room contracts; no external proprietary dependencies are imported.
- **Resource Containment**: Hard budget caps on max ticks (`maxTicks`), entity counts (`maxEntities`), and grid dimensions (`maxGridDimension`).
- **No Direct Mutation of Workspace**: Simulations operate in memory without mutating the active repository checkout.
