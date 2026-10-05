"""
Configuration models — pydantic v2 typed config for dabook.toml.

Precedence: CLI args > env vars > dabook.toml > profile defaults > hardcoded defaults.

Options that are modelled but have no implementation yet are *rejected* at validation
time with a "not yet implemented" message. They must never be accepted and ignored.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ALLOWED_DATASET_MODES = ("raw", "pretrain", "sft", "rag", "code")
ALLOWED_FORMATS = ("jsonl", "parquet", "hf")

DEFAULT_SFT_SYSTEM_PROMPT = (
    "You are a knowledgeable technical assistant. Answer accurately and in detail, "
    "using code examples where they help."
)


def _not_implemented(option: str, value: object, planned: str, hint: str) -> ValueError:
    return ValueError(f"{option}={value!r} is not yet implemented ({planned}). {hint}")


class StrictModel(BaseModel):
    """Config sections reject unknown keys: a typo must fail loudly, not be ignored."""

    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class WorkersConfig(StrictModel):
    cpu: int = Field(default=4, ge=1, description="CPU worker count")
    gpu: int = Field(default=1, ge=0)
    io: int = Field(default=2, ge=1)
    llm: int = Field(default=0, ge=0)
    book_concurrency: int = Field(default=2, ge=1)
    autotune: bool = False


class LimitsConfig(StrictModel):
    ram_ceiling_pct: float = Field(default=85.0, ge=10, le=99)
    vram_ceiling_pct: float = Field(default=90.0, ge=10, le=99)
    min_free_gb: float = Field(default=5.0, ge=0.5)
    shard_pages: int = Field(default=20, ge=1, le=500)
    max_attempts: int = Field(default=3, ge=1, le=10)
    backoff_s: float = Field(default=5.0, ge=1.0)
    lease_s: float = Field(default=90.0, ge=30.0)
    heartbeat_s: float = Field(default=15.0, ge=5.0)


class ExtractConfig(StrictModel):
    backend: Literal["auto", "pdfium_pdfminer", "docling", "marker", "mineru", "olmocr"] = "auto"
    ocr_engine: Literal["auto", "rapidocr", "tesseract"] = "auto"
    ocr_dpi: int = Field(default=300, ge=72, le=600)
    layout_model: str = "default"
    render_dpi_assets: int = Field(default=170, ge=72, le=400)
    # Only the pdfium route exists. Scanned documents finish as ``needs_input`` (see S01)
    # instead of being routed to an OCR engine, so there is nothing to route yet.
    routing: dict[str, str] = Field(default_factory=dict)

    @field_validator("backend")
    @classmethod
    def _backend_implemented(cls, v: str) -> str:
        if v not in ("auto", "pdfium_pdfminer"):
            raise _not_implemented(
                "extract.backend", v, "planned: Phase 5", "Use 'auto' or 'pdfium_pdfminer'."
            )
        return v

    @field_validator("ocr_engine")
    @classmethod
    def _ocr_engine_implemented(cls, v: str) -> str:
        if v != "auto":
            raise _not_implemented("extract.ocr_engine", v, "planned: Phase 5", "Use 'auto'.")
        return v

    @field_validator("routing")
    @classmethod
    def _routing_implemented(cls, v: dict[str, str]) -> dict[str, str]:
        for kind, route in v.items():
            if route not in ("pdfium", "needs_input"):
                raise _not_implemented(
                    f"extract.routing.{kind}",
                    route,
                    "planned: Phase 5",
                    "Only the 'pdfium' and 'needs_input' routes exist.",
                )
        return v


class StructureConfig(StrictModel):
    toc_mode: Literal["auto", "outline", "toc_page", "typography", "off"] = "auto"
    detect_regions: bool = False

    @field_validator("toc_mode")
    @classmethod
    def _toc_mode_implemented(cls, v: str) -> str:
        if v in ("toc_page", "typography"):
            raise _not_implemented(
                "structure.toc_mode", v, "planned: Phase 5", "Use 'auto', 'outline' or 'off'."
            )
        return v

    @field_validator("detect_regions")
    @classmethod
    def _detect_regions_implemented(cls, v: bool) -> bool:
        if v:
            raise _not_implemented("structure.detect_regions", v, "planned: Phase 5", "Leave it off.")
        return v


class ContinuityConfig(StrictModel):
    merge_threshold: float = Field(default=0.85, ge=0, le=1)
    uncertain_threshold: float = Field(default=0.5, ge=0, le=1)


class CleanConfig(StrictModel):
    dehyphenate: bool = True
    fix_spaced_letters: bool = True
    ocr_repair: Literal["off", "flag", "apply"] = "off"
    unicode_normal: Literal["NFC", "NFKC", "NFD", "NFKD"] = "NFC"
    quotes_policy: Literal["keep", "normalize"] = "keep"

    @field_validator("ocr_repair")
    @classmethod
    def _ocr_repair_implemented(cls, v: str) -> str:
        if v != "off":
            raise _not_implemented("clean.ocr_repair", v, "planned: Phase 5", "Use 'off'.")
        return v

    @field_validator("quotes_policy")
    @classmethod
    def _quotes_policy_implemented(cls, v: str) -> str:
        if v != "keep":
            raise _not_implemented("clean.quotes_policy", v, "planned: Phase 5", "Use 'keep'.")
        return v


class QualityConfig(StrictModel):
    verified: float = Field(default=0.95, ge=0, le=1)
    good: float = Field(default=0.85, ge=0, le=1)
    review: float = Field(default=0.70, ge=0, le=1)
    # When set, a book scoring below ``review`` finishes as ``review`` instead of ``done``.
    review_gate: bool = False


class SplitConfig(StrictModel):
    by: Literal["chapter", "section", "book"] = "chapter"
    ratios: list[float] = Field(default=[0.9, 0.05, 0.05])
    seed: int = 42

    @field_validator("ratios")
    @classmethod
    def ratios_sum_to_one(cls, v: list[float]) -> list[float]:
        if abs(sum(v) - 1.0) > 0.001:
            raise ValueError("split ratios must sum to 1.0")
        return v


class DedupConfig(StrictModel):
    """Exact (normalized-text hash) and near-duplicate (MinHash, ``jaccard``) removal."""

    exact: bool = True
    near: bool = True
    jaccard: float = Field(default=0.8, ge=0.5, le=1)


class DatasetConfig(StrictModel):
    modes: list[str] = Field(default=["raw", "rag"])
    formats: list[str] = Field(default=["jsonl"])
    text_field: Literal["raw", "norm", "clean"] = "clean"
    # tiktoken encoding name, used when ``tiktoken`` is installed; otherwise words x 1.33.
    tokenizer: str = "cl100k_base"
    chunk_target_tokens: int = Field(default=400, ge=50, le=8192)
    chunk_max_tokens: int = Field(default=800, ge=100, le=32768)
    sft_system_prompt: str = DEFAULT_SFT_SYSTEM_PROMPT
    # Chapter-level train/val/test splits for the training modes; ``None`` writes no splits.
    split: SplitConfig | None = Field(default_factory=SplitConfig)
    dedup: DedupConfig = Field(default_factory=DedupConfig)
    # The template-based SFT pairs are never exported by default (they are not real Q&A).
    include_heuristic_sft: bool = False

    @field_validator("modes")
    @classmethod
    def _modes_known(cls, v: list[str]) -> list[str]:
        cleaned = [m.strip() for m in v if m.strip()]
        unknown = [m for m in cleaned if m not in ALLOWED_DATASET_MODES]
        if unknown or not cleaned:
            raise ValueError(
                f"dataset.modes {unknown or v!r} invalid; choose from {list(ALLOWED_DATASET_MODES)}"
            )
        return list(dict.fromkeys(cleaned))

    @field_validator("formats")
    @classmethod
    def _formats_available(cls, v: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(f.strip() for f in v if f.strip())) or ["jsonl"]
        for fmt in cleaned:
            if fmt not in ALLOWED_FORMATS:
                raise ValueError(f"dataset.formats {fmt!r} invalid; choose from {list(ALLOWED_FORMATS)}")
        if any(f in ("parquet", "hf") for f in cleaned):
            try:
                import pyarrow  # noqa: F401
            except ImportError:
                raise ValueError(
                    "dataset.formats parquet/hf need pyarrow: install it with `pip install dabook[export]`"
                ) from None
        return cleaned

    @field_validator("chunk_max_tokens")
    @classmethod
    def _max_not_below_target(cls, v: int, info: Any) -> int:
        target = info.data.get("chunk_target_tokens", 0)
        if v < target:
            raise ValueError("dataset.chunk_max_tokens must be >= chunk_target_tokens")
        return v


class LicenseConfig(StrictModel):
    default_status: Literal["unknown", "owned", "permissive", "copyrighted", "public_domain"] = (
        "unknown"
    )
    allow_distribution: bool = False

    @field_validator("allow_distribution")
    @classmethod
    def _distribution_implemented(cls, v: bool) -> bool:
        if v:
            raise _not_implemented(
                "license.allow_distribution", v, "planned: later", "Leave it off."
            )
        return v


class AssistConfig(StrictModel):
    """LLM-assisted SFT generation (stage ``s13_assist_sft``).

    ``provider`` is ``none`` (disabled), ``ollama:<model>`` (local, free) or ``openai:<model>`` (any
    OpenAI-compatible endpoint, paid: set the two ``price_per_1k_*`` values so ``max_cost_usd`` can
    be enforced). ``fake:*`` providers exist only for tests and need DABOOK_ENABLE_FAKE_PROVIDER=1.
    """

    provider: str = "none"
    base_url: str | None = None  # endpoint override (Ollama default http://127.0.0.1:11434)
    api_key_env: str = "DABOOK_ASSIST_API_KEY"  # name of the env var holding the key (never the key)
    max_cost_usd: float = Field(default=5.0, ge=0)
    price_per_1k_prompt_usd: float = Field(default=0.0, ge=0)
    price_per_1k_completion_usd: float = Field(default=0.0, ge=0)
    max_pairs_per_section: int = Field(default=3, ge=1, le=10)
    min_section_words: int = Field(default=60, ge=10)
    max_section_words: int = Field(default=900, ge=100)
    grounding_threshold: float = Field(default=0.6, ge=0.3, le=1)
    temperature: float = Field(default=0.2, ge=0, le=1)
    max_tokens: int = Field(default=1024, ge=128, le=8192)
    timeout_s: float = Field(default=120.0, ge=5)

    @field_validator("provider")
    @classmethod
    def _provider_known(cls, v: str) -> str:
        kind, _, model = v.partition(":")
        if kind == "none" and not model:
            return "none"
        if kind not in ("ollama", "openai", "fake") or not model:
            raise ValueError(
                f"assist.provider {v!r} invalid: use 'none', 'ollama:<model>', or 'openai:<model>'"
            )
        return v

    @model_validator(mode="after")
    def _paid_providers_need_prices(self) -> AssistConfig:
        if self.provider.startswith("openai:") and not (
            self.price_per_1k_prompt_usd or self.price_per_1k_completion_usd
        ):
            raise ValueError(
                "assist.provider openai:* is a paid provider: set assist.price_per_1k_prompt_usd and "
                "assist.price_per_1k_completion_usd so assist.max_cost_usd can be enforced"
            )
        return self

    @property
    def enabled(self) -> bool:
        return self.provider != "none"


class ServerConfig(StrictModel):
    host: str = "127.0.0.1"
    port: int = Field(default=8765, ge=1024, le=65535)
    open_browser: bool = True
    # Extra browser origins allowed to call the dashboard API. The dashboard's own origin and
    # the Chatbot UI dev origin (port 3000) are always allowed.
    cors_origins: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Root config
# ---------------------------------------------------------------------------


class DabookConfig(StrictModel):
    name: str = "my-books"
    workspace: Path = Path("./dabook_workspace")
    profile: Literal["fast", "balanced", "accurate", "lowram"] = "balanced"

    workers: WorkersConfig = Field(default_factory=WorkersConfig)
    limits: LimitsConfig = Field(default_factory=LimitsConfig)
    extract: ExtractConfig = Field(default_factory=ExtractConfig)
    structure: StructureConfig = Field(default_factory=StructureConfig)
    continuity: ContinuityConfig = Field(default_factory=ContinuityConfig)
    clean: CleanConfig = Field(default_factory=CleanConfig)
    quality: QualityConfig = Field(default_factory=QualityConfig)
    dataset: DatasetConfig = Field(default_factory=DatasetConfig)
    license: LicenseConfig = Field(default_factory=LicenseConfig)
    assist: AssistConfig = Field(default_factory=AssistConfig)
    server: ServerConfig = Field(default_factory=ServerConfig)

    def resolved_workspace(self, cwd: Path | None = None) -> Path:
        """Return workspace as an absolute path."""
        base = cwd or Path.cwd()
        ws = Path(self.workspace)
        if not ws.is_absolute():
            ws = base / ws
        return ws.resolve()

    def to_params_dict(self) -> dict:
        """Flat dict of per-book parameters.

        The planner hashes the output-affecting subset into each stage key and writes the whole
        dict to ``books/<sha12>/params.json`` so stages read the same values they were keyed by.
        """
        return {
            "backend": self.extract.backend,
            "ocr_engine": self.extract.ocr_engine,
            "ocr_dpi": self.extract.ocr_dpi,
            "layout_model": self.extract.layout_model,
            "render_dpi_assets": self.extract.render_dpi_assets,
            "toc_mode": self.structure.toc_mode,
            "detect_regions": self.structure.detect_regions,
            "merge_threshold": self.continuity.merge_threshold,
            "uncertain_threshold": self.continuity.uncertain_threshold,
            "dehyphenate": self.clean.dehyphenate,
            "fix_spaced_letters": self.clean.fix_spaced_letters,
            "ocr_repair": self.clean.ocr_repair,
            "unicode_normal": self.clean.unicode_normal,
            "quality_verified": self.quality.verified,
            "quality_good": self.quality.good,
            "quality_review": self.quality.review,
            "modes": sorted(self.dataset.modes),
            "formats": sorted(self.dataset.formats),
            "text_field": self.dataset.text_field,
            "tokenizer": self.dataset.tokenizer,
            "chunk_target_tokens": self.dataset.chunk_target_tokens,
            "chunk_max_tokens": self.dataset.chunk_max_tokens,
            "sft_system_prompt": self.dataset.sft_system_prompt,
            "split_by": self.dataset.split.by if self.dataset.split else None,
            "split_ratios": self.dataset.split.ratios if self.dataset.split else None,
            "dedup_exact": self.dataset.dedup.exact,
            "dedup_near": self.dataset.dedup.near,
            "max_attempts": self.limits.max_attempts,
            "assist_provider": self.assist.provider,
            "assist_base_url": self.assist.base_url,
            "assist_max_cost_usd": self.assist.max_cost_usd,
            "assist_max_pairs": self.assist.max_pairs_per_section,
            "assist_min_words": self.assist.min_section_words,
            "assist_max_words": self.assist.max_section_words,
            "assist_grounding": self.assist.grounding_threshold,
            "assist_temperature": self.assist.temperature,
            "assist_max_tokens": self.assist.max_tokens,
            "assist_timeout_s": self.assist.timeout_s,
            "assist_prices": [
                self.assist.price_per_1k_prompt_usd,
                self.assist.price_per_1k_completion_usd,
            ],
            "assist_api_key_env": self.assist.api_key_env,
            "dedup_jaccard": self.dataset.dedup.jaccard,
            "split_seed": self.dataset.split.seed if self.dataset.split else None,
            "include_heuristic_sft": self.dataset.include_heuristic_sft,
            # Read when a book is finalised; not part of any stage artifact.
            "review_gate": self.quality.review_gate,
            "license_default": self.license.default_status,
        }


# ---------------------------------------------------------------------------
# Profile presets
# ---------------------------------------------------------------------------

PROFILES: dict[str, dict] = {
    "fast": {
        "workers": {"cpu": 8, "gpu": 1},
        "limits": {"shard_pages": 30},
        "extract": {"backend": "auto", "ocr_dpi": 200},
    },
    "balanced": {},  # defaults
    "accurate": {
        "limits": {"shard_pages": 10},
        # A docling backend is planned (Phase 5); until then accuracy comes from smaller shards.
        "extract": {"backend": "auto", "ocr_dpi": 400},
        "continuity": {"merge_threshold": 0.80},
    },
    "lowram": {
        "workers": {"cpu": 2, "gpu": 0, "io": 1, "book_concurrency": 1},
        "limits": {"ram_ceiling_pct": 75, "shard_pages": 10},
    },
}
