# Deterministic Lattice Game-Dev Canary Guide (CF-08)

> Status: Operational runbook and verification canary for Milestone CF-08.
> Maturity: `LOCAL_ONLY_EXPERIMENTAL`

## Objective

Validate that AI Chatbot Hub's isometric Lattice game-development engine executes deterministic world simulations, validates entity and grid budgets, produces accessible non-visual ASCII representations, and replays gameplay ticks with bit-exact Mulberry32 PRNG seed consistency.

## Operator Prerequisites

1. **Host Environment**:
   - OS: Windows 11, Linux, or macOS.
   - Node.js: >= 18.0.0.
   - Zero heavyweight native gaming engine requirements (pure TypeScript).

## Verification Canary Steps

1. **Simulation Determinism & Budget Check**:
   Execute the automated simulation determinism suite:
   ```powershell
   npx jest src/core/agents/gaming/GamingPlaybookService.test.ts --runInBand
   ```

2. **Verify PRNG Seed Reproducibility**:
   Confirm that identical PRNG seeds produce bit-exact simulation tick replays across independent execution passes.

3. **Verify Accessible ASCII Visualizations**:
   Confirm that `LatticeVisualizer` generates screen-reader accessible non-visual text maps and structured SVG previews.
