# Knowledge Retrieval Policy Implementation

## 1. Overview
The Knowledge Retrieval Policy coordinates query formulation, multi-factor scoring, source authority weighting, and candidate ranking across diverse knowledge packs.

## 2. 5-Factor Retrieval Scoring Formula
Candidate chunks are evaluated using a 5-factor weighted scoring function:

$$\text{FinalScore} = w_1 \cdot S_{\text{vector}} + w_2 \cdot S_{\text{lexical}} + w_3 \cdot A_{\text{source}} + w_4 \cdot R_{\text{freshness}} + w_5 \cdot C_{\text{coverage}}$$

- **Vector Similarity ($S_{\text{vector}}$)**: Cosine similarity between query embedding and chunk vector.
- **Lexical BM25 ($S_{\text{lexical}}$)**: Exact symbol, keyword, and token match relevance score.
- **Source Authority ($A_{\text{source}}$)**: Normalized authority score of the knowledge pack (e.g., 0.95 for official docs, 0.70 for educational web).
- **Freshness Recency ($R_{\text{freshness}}$)**: Exponential decay score based on document publication date and library version compatibility.
- **Coverage ($C_{\text{coverage}}$)**: Proportion of query tokens and essential query entities present in the chunk.

## 3. Explicit No-Retrieval Path
To optimize latency and eliminate hallucinated citations, the `ChatContextPlanner` designates an explicit no-retrieval path for:
- Greetings and conversational pleasantries.
- Pure creative writing and brainstorming prompts.
- Self-contained mathematical or logical derivations where all premises are provided in the prompt.

## 4. Query Routing & Bounds
Queries routed for retrieval enforce strict bounds:
- Top-$K$ retrieval limit: Typically 3 to 7 chunks max.
- Minimum score threshold: 0.65 to filter low-confidence or irrelevant content.
- Deduplication threshold: Chunks with cosine similarity > 0.92 to higher-ranking chunks are suppressed.
