"""Bounded CPU-only causal-LM smoke trainer for the governed DABOOK lifecycle.

This intentionally starts from random weights and is not a useful domain model. Its purpose is
to exercise real optimization, isolated held-out evaluation, artifact integrity, and registration.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import torch
from torch import nn
from torch.nn import functional

VOCAB_SIZE = 259
PAD, BOS, EOS = 256, 257, 258


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(64 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_records(path: Path, limit: int) -> list[dict[str, Any]]:
    if not path.is_file() or path.stat().st_size > 32 * 1024 * 1024:
        raise ValueError(f"Invalid or oversized dataset: {path}")
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            value = json.loads(line)
            messages = value.get("messages")
            if not isinstance(messages, list) or not messages:
                raise ValueError(f"Missing messages at {path}:{line_number}")
            if any(
                message.get("role") not in {"system", "user", "assistant"}
                or not isinstance(message.get("content"), str)
                or not message["content"].strip()
                for message in messages
                if isinstance(message, dict)
            ) or any(not isinstance(message, dict) for message in messages):
                raise ValueError(f"Malformed messages at {path}:{line_number}")
            if not any(message["role"] == "assistant" for message in messages):
                raise ValueError(f"Conversation has no assistant message at {path}:{line_number}")
            if not str(value.get("generator", "")).startswith("assist:"):
                raise ValueError(f"Non-assisted record at {path}:{line_number}")
            records.append(value)
            if len(records) > limit:
                raise ValueError(f"Dataset exceeds the smoke limit of {limit} records")
    if not records:
        raise ValueError(f"Dataset is empty: {path}")
    return records


def conversation_fingerprints(records: list[dict[str, Any]]) -> set[str]:
    fingerprints: set[str] = set()
    for record in records:
        normalized = [
            {
                "role": message.get("role"),
                "content": " ".join(str(message.get("content", "")).split()),
            }
            for message in record["messages"]
        ]
        fingerprint = json.dumps(normalized, separators=(",", ":"), ensure_ascii=False)
        if fingerprint in fingerprints:
            raise ValueError("Duplicate normalized conversation within a dataset split")
        fingerprints.add(fingerprint)
    return fingerprints


def encode(record: dict[str, Any], sequence_length: int) -> torch.Tensor:
    text = "\n".join(
        f"<{message['role']}> {message['content']}" for message in record["messages"]
    )
    encoded = text.encode("utf-8")
    if len(encoded) > sequence_length - 2:
        raise ValueError(
            f"Conversation is {len(encoded)} bytes and would truncate at {sequence_length} tokens"
        )
    tokens = [BOS, *encoded, EOS]
    return torch.tensor(tokens, dtype=torch.long)


class TinyCausalLm(nn.Module):
    def __init__(self, sequence_length: int) -> None:
        super().__init__()
        width = 32
        self.embedding = nn.Embedding(VOCAB_SIZE, width)
        self.position = nn.Embedding(sequence_length, width)
        layer = nn.TransformerEncoderLayer(
            d_model=width, nhead=4, dim_feedforward=64, dropout=0.0, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(layer, num_layers=1)
        self.output = nn.Linear(width, VOCAB_SIZE)

    def forward(self, tokens: torch.Tensor) -> torch.Tensor:
        positions = torch.arange(tokens.shape[1], device=tokens.device).unsqueeze(0)
        hidden = self.embedding(tokens) + self.position(positions)
        causal_mask = torch.triu(
            torch.ones(tokens.shape[1], tokens.shape[1], dtype=torch.bool), diagonal=1
        )
        return self.output(self.transformer(hidden, mask=causal_mask))


def record_loss(model: TinyCausalLm, tokens: torch.Tensor) -> torch.Tensor:
    inputs = tokens[:-1].unsqueeze(0)
    labels = tokens[1:].unsqueeze(0)
    return functional.cross_entropy(model(inputs).transpose(1, 2), labels)


def evaluate(model: TinyCausalLm, samples: list[torch.Tensor]) -> float:
    model.eval()
    with torch.no_grad():
        losses = [record_loss(model, sample).item() for sample in samples]
    value = sum(losses) / len(losses)
    if not math.isfinite(value):
        raise ValueError("Evaluation produced a non-finite loss")
    return value


def atomic_json(path: Path, value: object) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def validate_launch(bundle: Path, plan: Path, attestation_path: Path) -> None:
    manifest_path, config_path = bundle / "manifest.json", plan / "axolotl.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    config = json.loads(config_path.read_text(encoding="utf-8"))
    attestation = json.loads(attestation_path.read_text(encoding="utf-8"))
    governance = manifest.get("governance", {})
    audit = governance.get("audit", {})
    scan = governance.get("embeddedEvaluationScan", {})
    evaluation = governance.get("evaluation", {})
    fixture = (
        governance.get("generatedBy") == "chatbot-training-integration-fixture"
        and manifest.get("schema") == "dabook.explicit-integration-fixture.v1"
        and manifest.get("fixture") is True
        and manifest.get("authority") == "assistant-authored-test-data-only"
        and attestation.get("fixtureOptIn") is True
    )
    exporter = governance.get("generatedBy") == "chatbot-training-exporter"
    if not (exporter or fixture):
        raise ValueError("CPU training requires an exporter bundle or explicit integration fixture")
    if (
        governance.get("contaminated") is not False
        or audit.get("evaluationOverlapsWithTraining") != 0
        or audit.get("evaluationOverlapsWithRag") != 0
        or audit.get("registrationConflicts") != 0
        or scan.get("matches") != 0
        or type(evaluation.get("items")) is not int
        or evaluation["items"] <= 0
    ):
        raise ValueError("CPU training governance gate failed")
    allowed_licenses = {"owned", "permissive", "public_domain"}
    books = manifest.get("books")
    if not books or any(book.get("license_status") not in allowed_licenses for book in books):
        raise ValueError("CPU training license gate failed")
    if config.get("base_model") != "cpu-smoke/random-init":
        raise ValueError("Integration fixture is restricted to the random-init CPU smoke base")
    artifact_hashes = manifest.get("artifactHashes", {})
    for split in ("train", "val", "test"):
        relative = f"sft/{split}.jsonl"
        source = bundle / relative
        if source.exists() and sha256(source) != artifact_hashes.get(relative):
            raise ValueError(f"Governed source integrity failed: {relative}")
    datasets = config.get("datasets")
    validation = config.get("test_datasets")
    if (
        not isinstance(datasets, list)
        or len(datasets) != 1
        or Path(datasets[0].get("path", "")).resolve() != (plan / "train.jsonl").resolve()
        or (
            (plan / "val.jsonl").exists()
            and (
                not isinstance(validation, list)
                or len(validation) != 1
                or Path(validation[0].get("path", "")).resolve()
                != (plan / "val.jsonl").resolve()
            )
        )
        or any(
            Path(item.get("path", "")).resolve() == (plan / "test.jsonl").resolve()
            for item in [*datasets, *(validation or [])]
        )
    ):
        raise ValueError("Prepared training config split wiring failed")
    expected = {
        "schema": "dabook.cpu-smoke-launch.v1",
        "purpose": "lifecycle-smoke-not-domain-model",
        "sourceManifestSha256": sha256(manifest_path),
        "configSha256": sha256(config_path),
        "trainSha256": sha256(plan / "train.jsonl"),
        "heldOutTestSha256": sha256(plan / "test.jsonl"),
    }
    if any(attestation.get(key) != value for key, value in expected.items()):
        raise ValueError("CPU training launch attestation integrity failed")


def evidence(split: str, relative: str, path: Path, records: int) -> dict[str, object]:
    return {"split": split, "relativePath": relative, "sha256": sha256(path), "records": records}


def run(args: argparse.Namespace) -> Path:
    bundle = Path(args.bundle).resolve(strict=True)
    output = Path(args.output).resolve()
    plan = bundle / "training-plan"
    train_file, test_file = plan / "train.jsonl", plan / "test.jsonl"
    validation_file = plan / "val.jsonl"
    config_file, source_manifest = plan / "axolotl.json", bundle / "manifest.json"
    for required in (train_file, test_file, config_file, source_manifest):
        required.resolve(strict=True)
        if required.is_symlink() or bundle not in required.resolve().parents:
            raise ValueError(f"Unsafe required input: {required}")
    if sha256(train_file) == sha256(test_file):
        raise ValueError("Held-out test data must differ from optimizer input")
    attestation_path = Path(args.launch_attestation).resolve(strict=True)
    if output.exists() and any(item.resolve() != attestation_path for item in output.iterdir()):
        raise ValueError("Output directory contains files other than the launch attestation")
    output.mkdir(parents=True, exist_ok=True)
    if attestation_path.parent != output or attestation_path.is_symlink():
        raise ValueError("Launch attestation must be a regular file in the output directory")
    validate_launch(bundle, plan, attestation_path)

    torch.manual_seed(args.seed)
    random.seed(args.seed)
    torch.set_num_threads(args.threads)
    torch.use_deterministic_algorithms(True)
    train_records = load_records(train_file, args.max_records)
    test_records = load_records(test_file, args.max_records)
    validation_records = (
        load_records(validation_file, args.max_records) if validation_file.exists() else None
    )
    train_fingerprints = conversation_fingerprints(train_records)
    test_fingerprints = conversation_fingerprints(test_records)
    if train_fingerprints & test_fingerprints:
        raise ValueError("Held-out test conversations overlap optimizer input")
    if validation_records is not None:
        validation_fingerprints = conversation_fingerprints(validation_records)
        if validation_fingerprints & test_fingerprints:
            raise ValueError("Held-out test conversations overlap validation input")
    train = [encode(item, args.sequence_length) for item in train_records]
    held_out = [encode(item, args.sequence_length) for item in test_records]

    model = TinyCausalLm(args.sequence_length)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)
    initial_held_out_loss = evaluate(model, held_out)
    steps, last_loss = 0, math.nan
    model.train()
    for _epoch in range(args.epochs):
        for sample in train:
            optimizer.zero_grad(set_to_none=True)
            loss = record_loss(model, sample)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            steps += 1
            last_loss = loss.item()
    held_out_loss = evaluate(model, held_out)

    model_path = output / "model.pt"
    model_temporary = output / "model.pt.tmp"
    torch.save(model.state_dict(), model_temporary)
    os.replace(model_temporary, model_path)
    model_config = output / "model-config.json"
    atomic_json(
        model_config,
        {
            "architecture": "tiny-byte-transformer-causal-lm",
            "randomlyInitialized": True,
            "domainModel": False,
            "vocabSize": VOCAB_SIZE,
            "sequenceLength": args.sequence_length,
            "seed": args.seed,
        },
    )

    datasets: dict[str, object] = {
        "optimizer": [
            evidence("train", "training-plan/train.jsonl", train_file, len(train_records))
        ],
        "heldOutTest": evidence(
            "test", "training-plan/test.jsonl", test_file, len(test_records)
        ),
    }
    if validation_records is not None:
        datasets["validation"] = evidence(
            "validation", "training-plan/val.jsonl", validation_file, len(validation_records)
        )
    result = {
        "schema": "dabook.training-result.v1",
        "status": "completed",
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "engine": "cpu-smoke",
        "purpose": "lifecycle-smoke-not-domain-model",
        "baseModel": {
            "name": "cpu-smoke/random-init",
            "kind": "randomly-initialized-untrained",
        },
        "plan": {
            "sourceManifestSha256": sha256(source_manifest),
            "configSha256": sha256(config_file),
        },
        "datasets": datasets,
        "metrics": {
            "initialHeldOutLoss": initial_held_out_loss,
            "finalTrainingLoss": last_loss,
            "heldOutLoss": held_out_loss,
            "heldOutPerplexity": math.exp(held_out_loss),
            "trainingSteps": steps,
        },
        "artifacts": [
            {"relativePath": "model.pt", "sha256": sha256(model_path)},
            {"relativePath": "model-config.json", "sha256": sha256(model_config)},
        ],
    }
    result_path = output / "result-manifest.json"
    atomic_json(result_path, result)
    return result_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle")
    parser.add_argument("output")
    parser.add_argument("--launch-attestation", required=True)
    parser.add_argument("--epochs", type=int, choices=range(1, 9), default=2)
    parser.add_argument("--threads", type=int, choices=range(1, 3), default=2)
    parser.add_argument("--max-records", type=int, choices=range(1, 65), default=32)
    parser.add_argument("--sequence-length", type=int, choices=range(32, 257), default=256)
    parser.add_argument("--learning-rate", type=float, default=0.003)
    parser.add_argument("--seed", type=int, default=20261101)
    args = parser.parse_args()
    if not math.isfinite(args.learning_rate) or not 0 < args.learning_rate <= 0.01:
        parser.error("--learning-rate must be finite and in (0, 0.01]")
    print(run(args))


if __name__ == "__main__":
    main()
