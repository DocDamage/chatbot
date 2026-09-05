# Evaluation Policy Implementation

## 1. Overview
The Evaluation Policy establishes rigorous, empirical criteria for regression testing, performance baselines, retrieval quality, and release gating across all releases.

## 2. Evaluation Tiers
The evaluation framework operates on three continuous tiers:
1. **PR Smoke Tier**:
   - Fast running subset (30 seconds) executing against held-out golden seeds and offline synthetic fixtures.
   - Blocks broken merges and obvious routing regressions.
2. **Comprehensive Golden Suite**:
   - 500+ curated scenarios across all 12 operational domains (coding, reasoning, tools, creative, etc.).
   - Evaluates response correctness, grounding accuracy, citation validity, and safety.
3. **Dataset A/B Comparative Suite**:
   - Evaluates candidate knowledge packs against active versions.
   - Prevents regressions in domain recall or answer precision prior to dataset promotion.

## 3. Release Threshold Invariants
A release candidate must meet strict quantitative thresholds:
- Grounding precision $\ge 90\%$.
- Citation validity $\ge 95\%$.
- Zero critical security regression (prompt injection defense $\ge 99\%$).
- Latency $P95 \le 2000\text{ms}$ for balanced chat requests.
- Test pass rate: 100% across unit, integration, and security test suites.

## 4. Execution Commands
```bash
# Run chat evaluation suite
npm run eval:chat

# Run retrieval evaluation suite
npm run eval:retrieval

# Run tool ground truth evaluation suite
npm run eval:tool-truth

# Run dataset A/B benchmarks
npm run eval:datasets
```
