-- Two deduplicated trusted selected snapshot/target pairs; bind all seven values.
WITH allowed(snapshot_id, evidence_target_id) AS (
  VALUES (?, ?), (?, ?)
)
SELECT dc.id, dc.content, dc.metadata,
       s.id AS snapshot_id, s.corpus_id, s.evidence_target_id,
       bm25(document_chunks_fts) AS lexical_distance
FROM document_chunks_fts
JOIN document_chunks dc ON dc.rowid = document_chunks_fts.rowid
JOIN knowledge_snapshot_chunks sc ON sc.chunk_id = dc.id
JOIN knowledge_snapshots s ON s.id = sc.snapshot_id
JOIN allowed a ON a.snapshot_id = s.id
              AND a.evidence_target_id = s.evidence_target_id
WHERE document_chunks_fts MATCH ?
  AND s.corpus_id = ? AND s.state = 'ready'
  AND s.retrieval_approved = 1 AND s.lexical_ready = 1
ORDER BY lexical_distance ASC, dc.id ASC
LIMIT ?;
