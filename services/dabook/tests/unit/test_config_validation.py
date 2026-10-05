"""1.8: advertised-but-unimplemented options must fail validation, never be ignored."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from dabook.config.loader import load_config
from dabook.config.models import PROFILES, DabookConfig


@pytest.mark.parametrize(
    ("overrides", "needle"),
    [
        ({"extract": {"backend": "docling"}}, "extract.backend"),
        ({"extract": {"backend": "marker"}}, "not yet implemented"),
        ({"extract": {"ocr_engine": "tesseract"}}, "extract.ocr_engine"),
        ({"extract": {"routing": {"scanned": "ocr"}}}, "extract.routing.scanned"),
        ({"license": {"allow_distribution": True}}, "license.allow_distribution"),
        ({"structure": {"toc_mode": "typography"}}, "structure.toc_mode"),
        ({"structure": {"detect_regions": True}}, "structure.detect_regions"),
        ({"clean": {"ocr_repair": "apply"}}, "clean.ocr_repair"),
        ({"clean": {"quotes_policy": "normalize"}}, "clean.quotes_policy"),
    ],
)
def test_unimplemented_options_are_rejected_with_a_clear_message(overrides, needle) -> None:
    with pytest.raises(ValidationError) as err:
        DabookConfig.model_validate(overrides)
    assert needle in str(err.value)
    assert "not yet implemented" in str(err.value)


def test_unknown_dataset_mode_is_rejected() -> None:
    with pytest.raises(ValidationError, match="dataset.modes"):
        DabookConfig.model_validate({"dataset": {"modes": ["rag", "instruct"]}})


def test_chunk_max_below_target_is_rejected() -> None:
    with pytest.raises(ValidationError, match="chunk_max_tokens"):
        DabookConfig.model_validate(
            {"dataset": {"chunk_target_tokens": 600, "chunk_max_tokens": 500}}
        )


def test_defaults_and_implemented_values_validate() -> None:
    cfg = DabookConfig()
    assert cfg.dataset.modes == ["raw", "rag"]
    assert cfg.extract.backend == "auto"
    assert DabookConfig.model_validate({"extract": {"backend": "pdfium_pdfminer"}})
    assert DabookConfig.model_validate({"structure": {"toc_mode": "off"}})


@pytest.mark.parametrize("profile", sorted(PROFILES))
def test_every_real_profile_loads(profile: str) -> None:
    """D3: the profiles the UI offers (including accurate and lowram) must all be usable."""
    assert load_config(overrides={"profile": profile}).profile == profile


def test_modes_are_deduplicated_and_trimmed() -> None:
    cfg = DabookConfig.model_validate({"dataset": {"modes": [" rag ", "raw", "rag"]}})
    assert cfg.dataset.modes == ["rag", "raw"]


def test_params_dict_carries_the_sft_prompt_and_review_gate() -> None:
    cfg = DabookConfig.model_validate(
        {"dataset": {"sft_system_prompt": "Be terse."}, "quality": {"review_gate": True}}
    )
    params = cfg.to_params_dict()
    assert params["sft_system_prompt"] == "Be terse."
    assert params["review_gate"] is True


# --------------------------------------------------------------------------- Phase 4 options
@pytest.mark.parametrize(
    "overrides",
    [
        {"dataset": {"formats": ["jsonl", "parquet"]}},
        {"dataset": {"formats": ["hf"]}},
        {"dataset": {"dedup": {"exact": True, "near": True, "jaccard": 0.9}}},
        {"dataset": {"split": {"by": "section", "ratios": [0.8, 0.1, 0.1], "seed": 7}}},
        {"assist": {"provider": "ollama:qwen3:8b"}},
        {"assist": {"provider": "openai:gpt-x", "base_url": "https://api.example/v1",
                    "price_per_1k_prompt_usd": 0.001, "price_per_1k_completion_usd": 0.002}},
    ],
)
def test_phase_4_options_are_accepted(overrides) -> None:
    assert DabookConfig.model_validate(overrides)


def test_dedup_and_splits_are_on_by_default() -> None:
    cfg = DabookConfig()
    assert cfg.dataset.dedup.exact and cfg.dataset.dedup.near and cfg.dataset.dedup.jaccard == 0.8
    assert cfg.dataset.split is not None and cfg.dataset.split.by == "chapter"
    assert cfg.assist.provider == "none" and cfg.dataset.include_heuristic_sft is False


@pytest.mark.parametrize(
    ("overrides", "needle"),
    [
        ({"dataset": {"formats": ["orc"]}}, "dataset.formats"),
        ({"assist": {"provider": "gpt-4"}}, "assist.provider"),
        ({"assist": {"provider": "ollama:"}}, "assist.provider"),
        ({"assist": {"provider": "openai:gpt-x"}}, "price_per_1k"),  # budget must be enforceable
        ({"assist": {"grounding_threshold": 0.1}}, "grounding_threshold"),
        ({"dataset": {"split": {"ratios": [0.5, 0.5, 0.5]}}}, "sum to 1.0"),
        ({"dataset": {"dedup": {"jaccard": 0.2}}}, "jaccard"),
    ],
)
def test_phase_4_options_validate_their_values(overrides, needle) -> None:
    with pytest.raises(ValidationError) as err:
        DabookConfig.model_validate(overrides)
    assert needle in str(err.value)


@pytest.mark.parametrize(
    "overrides",
    [
        {"asist": {"provider": "none"}},  # typo in a section name
        {"assist": {"provder": "none"}},  # typo in a key
        {"dataset": {"dedup": {"fuzzy": True}}},
        {"workers": {"cpus": 4}},
    ],
)
def test_unknown_config_keys_fail_instead_of_being_ignored(overrides) -> None:
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        DabookConfig.model_validate(overrides)


def test_the_provider_is_part_of_the_params_that_key_the_assist_stage() -> None:
    a = DabookConfig.model_validate({"assist": {"provider": "ollama:a"}}).to_params_dict()
    b = DabookConfig.model_validate({"assist": {"provider": "ollama:b"}}).to_params_dict()
    assert a["assist_provider"] != b["assist_provider"]
    assert DabookConfig().to_params_dict()["split_seed"] == 42
