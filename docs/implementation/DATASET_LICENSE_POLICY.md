# Dataset License Policy Implementation

## 1. Overview
The Dataset License Policy enforces legal compliance, open access verification, commercial terms compatibility, and source attribution for every document indexed into the Knowledge Platform.

## 2. Permitted Open Licenses
The platform permits ingestion only for datasets governed by explicit permissive or verified open licenses:
- **Permissive Software Licenses**: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC.
- **Open Documentation & Data**: CC-BY-4.0, CC-BY-SA-4.0, CC0-1.0, ODC-By, Open Database License (ODbL).
- **Academic & Preprint**: arXiv non-exclusive distribution license, Open Access scholarly licenses.

## 3. Forbidden Licenses & Content
Ingestion is strictly prohibited for:
- Proprietary, confidential, or unreleased internal corporate data without authorization.
- Non-commercial-only licenses (e.g., CC-BY-NC) in production enterprise deployments.
- Scraping prohibited by robots.txt, Terms of Service, or copyright paywalls.
- Leaked test sets, benchmarks, or sensitive personal data (PII).

## 4. Attribution & Provenance Invariants
For every indexed chunk, the platform persists:
- Source URL / Repository URI.
- License identifier (SPDX format).
- Copyright holder attribution statement.
- Ingestion timestamp and SHA-256 source hash.

Citations emitted in conversational responses link directly to these attribution records.
