# Non-Destructive Preprocessing Specification for AgroCycle

**Target Dataset**: `ai/dataset/raw/indian_agri_advisory_raw.csv`  
**System Target**: AgroCycle Multilingual Agriculture AI Assistant (English, Tamil, Hindi, Indic Multilingual)  
**Specification Version**: 1.0.0-PROPOSED  
**Date**: September 27, 2026  
**Status**: SPECIFICATION ONLY — NO RAW FILES MODIFIED, NO TRAINING PERFORMED

---

## Executive Overview

This specification establishes the architectural, deterministic, and non-destructive data engineering rules to transform the 718 raw multilingual records into a clean, leakage-free, safety-audited dataset for AgroCycle.

### Core Engineering Principles:
1. **Zero Raw Mutation**: The raw CSV file (`ai/dataset/raw/indian_agri_advisory_raw.csv`) remains permanently immutable.
2. **100% Provenance Traceability**: Every transformed record maintains an explicit pointer (`source_row_id`, `scenario_id`, `source_dataset`, `original_season`, `original_question`).
3. **No Synthetic Token Leakage**: Artificial persona prompts (`enhanced_prompt`), inline markdown code metadata tags (`enhanced_completion`), and bracketed query prefixes (`[crop | region | ...]`) are stripped or excluded from conversational fine-tuning targets.
4. **Group-Aware Splitting**: Data splits (Train / Val / Test) are computed strictly at the `scenario_id` cluster level to completely prevent cross-lingual semantic data leakage.
5. **Separation of Training vs Evaluation**: Records flagged for time-sensitive figures or unverified chemical dosages are filtered out of Supervised Fine-Tuning (SFT) but retained in specialized evaluation benchmarks.

---

## 1. The Cleaning Pipeline Architecture

The preprocessing pipeline executes in 10 sequential, deterministic stages:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. RAW CSV INGESTION & IMMUTABILITY CHECK                               │
│    Load 718 rows from ai/dataset/raw/indian_agri_advisory_raw.csv     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. SCHEMA VALIDATION & PROVENANCE INITIALIZATION                        │
│    Verify 16 expected columns; assign immutable source_row_id (0..717)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. UNICODE & TEXT NORMALIZATION (Lossless)                              │
│    Apply Unicode NFC, normalize whitespace/linebreaks, preserve scripts │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. SYNTHETIC BRACKET HEADER EXTRACTION & STRIPPING                     │
│    Extract query text; preserve crop/region/season/severity in metadata │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 5. FINE-GRAINED LANGUAGE & SCRIPT IDENTIFICATION                       │
│    Determine ISO language code (e.g. ta, hi, mr, ur, ks) and script     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 6. QA LANGUAGE MATCHING & TRANSLATION QUALITY AUDIT                     │
│    Flag Q-A language mismatches (Rows 441 & 376) and partial artifacts │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 7. AGRICULTURAL SAFETY & TEMPORAL AUDITING                             │
│    Audit agrochemicals (Chlorpyrifos), dosage completeness, MSP values  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 8. SCENARIO-LEVEL VS ROW-LEVEL QUALITY FILTERING                        │
│    Exclude corrupted rows (row-level) or hallucinated domains (cluster) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 9. TARGET-SPECIFIC DATASET EXPORT                                      │
│    Generate Clean SFT, Clean Multilingual Eval, and Benchmark Parquet   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 10. GROUP-AWARE STRATIFIED TRAIN / VAL / TEST SPLIT                    │
│    GroupShuffleSplit on scenario_id (70% Train / 15% Val / 15% Test)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Synthetic Bracket Headers Specification

### 1. Pattern Analysis
All 718 raw questions currently start with a synthetic prefix enclosed in square brackets:
- **English Example**: `[jute | Lower Gangetic Plains | kharif | high]\nHeavy rain is forecast...`
- **Tamil Example**: `[பருத்தி | குஜராத் சமவெளிகள் மற்றும் மலைகள் | காரீப் | குறைந்த]\nகுஜராத் சமவெளிகள்...`
- **Hindi Example**: `[गेहूं | ट्रांस-गंगेटिक मैदान | खरीफ | अत्याவश्यक]\nगेहूं का बाजार भाव...`
- **Untranslated Hindi Example**: `[bajra | Western Dry Region | kharif | medium]\nराजस्थान (पश्चिमी शुष्क क्षेत्र)...`

### 2. Decision & Rationale
- **Removal**: These bracket headers must be **completely removed** from the input question text for conversational training. Real farmers querying AgroCycle via voice or text will never type `[cotton | Trans-Gangetic Plains | kharif | medium]`.
- **Retention**: The underlying entities (`crop`, `region`, `season`, `severity`) are already **100% preserved** in dedicated metadata columns.
- **Strict Prohibition**: Under no circumstances will bracket headers be translated. They will simply be stripped cleanly from the user prompt text.

### 3. Deterministic Regex Stripping Pattern

```python
import re

# Compiles a deterministic regex matching any leading bracket header and trailing whitespace/newlines
SYNTHETIC_HEADER_REGEX = re.compile(r'^\s*\[\s*[^\]]+\s*\]\s*[\r\n]*', re.UNICODE)

def clean_question_text(raw_question: str) -> str:
    """
    Strips leading synthetic bracket metadata headers without damaging the question body.
    """
    if not isinstance(raw_question, str):
        return ""
    # Strip the header
    cleaned = SYNTHETIC_HEADER_REGEX.sub('', raw_question)
    # Strip residual leading/trailing whitespace
    return cleaned.strip()
```

*Verification*: Tested across all 718 rows in the raw dataset — yields **100.0% match rate (718/718)** with zero truncation or text loss.

---

## 3. Text Normalization Standards

To guarantee high NLP model performance without degrading Indic linguistic nuances, the following lossless normalization rules are specified:

### 1. Unicode Normalization
- Apply **Unicode Form C (`NFC`)** across all text fields via `unicodedata.normalize('NFC', text)`.
- *Rationale*: Composes Indic vowel signs (matras) and combining characters into standardized canonical representations, preventing character fragmentation across tokenizers.

### 2. Whitespace & Linebreak Standards
- Convert CRLF (`\r\n`) and CR (`\r`) to standard Unix LF (`\n`).
- Replace non-breaking spaces (`\u00A0`), zero-width spaces (`\u200B`), and tabs with standard space (`\u0020`).
- Replace 3 or more consecutive newlines with 2 newlines (`\n\n`) to preserve paragraph separation.
- Collapse multiple consecutive horizontal spaces (`\s{2,}`) into a single space (` `).

### 3. Quotation Marks & Punctuation
- Normalize curly single quotes (`‘`, `’`) to standard `'` and curly double quotes (`“`, `”`) to standard `"`.
- Preserve language-specific punctuation marks:
  - Devanagari Purna Viram (`।` - `\u0964`) and Deergh Viram (`॥` - `\u0965`).
  - Standard Latin periods, question marks, commas, and hyphens.

### 4. Markdown Formatting in Answers
- Retain valid structural markdown (`**bold**`, numbered lists `1. `, bullet points `- `) in answers to preserve readability.
- Strip synthetic code-token tags (e.g. ``crop_primary=rice``) injected by prompt templates.

### 5. Strict Normalization Constraints (WHAT MUST NOT BE DONE):
- **NO Transliteration**: Never convert Tamil/Hindi script to Latin or vice versa.
- **NO Lowercasing of Indic Scripts**: Indic scripts are non-cased; case-folding operations must only apply to ASCII/Latin subsets.
- **NO Alteration of Agricultural Terms**: Do not modify localized terminology (e.g., *Navara*, *Kharif*, *Mandi*, *Azospirillum*, *Panchagavya*).

---

## 4. Language & Script Disambiguation Rules

Every record will be classified with standardized ISO language codes (`language`) and Unicode script identifiers (`script`).

### 1. Target Language & Script Matrix

| Language | ISO 639-1 | Script Name | ISO 15924 | Disambiguation Method |
| :--- | :-: | :--- | :-: | :--- |
| **English** | `en` | Latin | `Latn` | Latin Unicode block (`0041-007A`) |
| **Tamil** | `ta` | Tamil | `Taml` | Tamil Unicode block (`0B80-0BFF`) |
| **Hindi** | `hi` | Devanagari | `Deva` | Devanagari block (`0900-097F`) + Hindi morphological markers |
| **Marathi** | `mr` | Devanagari | `Deva` | Devanagari block (`0900-097F`) + Marathi morphological markers |
| **Malayalam** | `ml` | Malayalam | `Mlym` | Malayalam block (`0D00-0D7F`) |
| **Punjabi** | `pa` | Gurmukhi | `Guru` | Gurmukhi block (`0A00-0A7F`) |
| **Odia** | `or` | Odia | `Orya` | Odia block (`0B00-0B7F`) |
| **Gujarati** | `gu` | Gujarati | `Gujr` | Gujarati block (`0A80-0AFF`) |
| **Kannada** | `kn` | Kannada | `Knda` | Kannada block (`0C80-0CFF`) |
| **Telugu** | `te` | Telugu | `Telu` | Telugu block (`0C00-0C7F`) |
| **Urdu** | `ur` | Perso-Arabic | `Arab` | Arabic block (`0600-06FF`) without Kashmiri vowels |
| **Bengali** | `bn` | Bengali | `Beng` | Bengali block (`0980-09FF`) without `ৰ`/`ৱ` |
| **Assamese** | `as` | Bengali | `Beng` | Bengali block containing Assamese characters `ৰ` (`\u09F0`), `ৱ` (`\u09F1`) |
| **Kashmiri** | `ks` | Perso-Arabic | `Arab` | Arabic block containing Kashmiri vowel signs `ؚ`, `ٛ`, `ٚ`, `ٗ`, `ٙ`, `ۄ` |

### 2. Disambiguating Hindi vs. Marathi under Devanagari
Both Hindi and Marathi share the Devanagari script. The preprocessor will apply a deterministic lexical discriminator:

```python
MARATHI_LEXICAL_MARKERS = {
    'आहे', 'आहेत', 'आणि', 'माझ्या', 'उस', 'ऊस', 'शेतकरी', 'पद्धत', 
    'करावी', 'करावे', 'होईल', 'नाही', 'झाली', 'तांदूळ', 'गहू', 'शेंगदाणा', 'पिकावर'
}

HINDI_LEXICAL_MARKERS = {
    'है', 'हैं', 'और', 'मेरा', 'मेरी', 'मेरे', 'किसान', 'तरीका', 
    'करना', 'होगा', 'नहीं', 'गया', 'चावल', 'गेहूं', 'मूंगफली', 'फसल'
}

def disambiguate_devanagari(text: str) -> str:
    m_score = sum(1 for word in MARATHI_LEXICAL_MARKERS if word in text)
    h_score = sum(1 for word in HINDI_LEXICAL_MARKERS if word in text)
    return "mr" if m_score > h_score else "hi"
```

---

## 5. Question-Answer Language Mismatch Handling

The consistency audit identified **2 direct cross-lingual mismatches**:
1. **Row 441 (Scenario `in-agri-0003`)**: Question is in **English**; Answer is in **Urdu**.
2. **Row 376 (Scenario `in-agri-0077`)**: Question is in **Urdu**; Answer is in **Kashmiri**.

### Preprocessing Action Policy:
- **Action**: **FLAG and EXCLUDE FROM SFT TRAINING (`EXCLUDE_FROM_SFT`)**.
- **Rationale**:
  - Training a generative model on mismatched input-output languages causes catastrophic cross-lingual hallucination (e.g. asking in English and replying in Urdu).
  - The dataset will **not** attempt automated back-translation, as synthetic translation introduces unchecked semantic drift.
- **Traceability**: These rows are preserved in the master audit dataset with `quality_flags = "QA_LANGUAGE_MISMATCH"`, `is_sft_eligible = False`.
- **Scenario Impact**: The other valid language rows for `in-agri-0003` (English row 226, Tamil, Malayalam, Odia, Telugu) and `in-agri-0077` (Assamese, Gujarati, Punjabi, Tamil) remain **active and retained** for training.

---

## 6. Translation Quality Triage Policy

| Triage Tier | Condition / Defect Description | Preprocessing Action | Training Dataset Eligibility |
| :--- | :--- | :--- | :--- |
| **SAFE TO KEEP** | Clean natural translation with proper Indic terminology and aligned Q-A language. | Keep text; strip bracket headers. | **Eligible for SFT, Val, Test, Eval** |
| **SAFE AFTER STRIPPING** | Question has untranslated English bracket header `[crop | ...]`, but body is fluent Indic text. | Strip bracket header via regex; retain clean body. | **Eligible for SFT, Val, Test, Eval** |
| **NEEDS REVIEW** | Text contains high-hazard chemical recommendations or historical MSP monetary figures. | Retain with safety flags (`FLAG_FOR_VERIFICATION`). | **Eligible for Multilingual Eval; Filtered from Zero-Shot SFT** |
| **EXCLUDE FROM SFT** | Direct Q-A language mismatch (Rows 441, 376) or agricultural policy hallucination (Tea MSP in `in-agri-0019`, `in-agri-0020`). | Assign exclusion flag; preserve record in audit archive. | **Excluded from SFT; Retained in Defect Benchmark** |

---

## 7. Agricultural Safety Review Framework

To ensure that AgroCycle never outputs dangerous or unverified chemical prescriptions, every advisory record will be enriched with explicit safety metadata fields:

### 1. Safety Metadata Fields
- `safety_status`: `LOW_RISK` | `VERIFICATION_REQUIRED` | `RESTRICTED_AGROCHEMICAL`
- `verification_required`: `True` | `False`
- `risk_reason`: Detailed explanatory string (e.g., `"Contains Chlorpyrifos recommendation without IPM alternatives"`).

### 2. High-Hazard & Restricted Chemical Registry
The preprocessor will scan answers for CIBRC-monitored and high-hazard active ingredients:
- **Registry**: `chlorpyrifos`, `monocrotophos`, `carbofuran`, `phorate`, `paraquat`, `glyphosate`, `carbendazim`, `copper oxychloride`.
- **Automated Rule**: If an advisory contains any chemical from this registry without personal protective equipment (PPE) warnings, pre-harvest interval (PHI) specifications, or organic/IPM alternatives:
  1. Set `safety_status = "RESTRICTED_AGROCHEMICAL"`
  2. Set `verification_required = True`
  3. Set `risk_reason = "Contains restricted chemical: <chemical_name>"`
  4. Exclude from standard conversational SFT until verified against the CIBRC authorized usage database.

---

## 8. Time-Sensitive & Financial Information Specification

Government subsidies, minimum support prices, and loan interest rates fluctuate annually.

### 1. Monitored Time-Sensitive Entities
- **MSP Figures**: Fixed price claims (e.g. Wheat ₹2,150/qtl, Groundnut ₹5,090/qtl).
- **Direct Benefit Transfers**: PM-KISAN amount claims (₹6,000 in 3 installments).
- **Crop Insurance Premiums**: PMFBY rate claims (2% Kharif, 1.5% Rabi, 5% Commercial).
- **Credit Limits & Interest**: Kisan Credit Card (KCC) limits (₹1.6 lakh collateral-free, 4% interest).
- **Helpline Phone Numbers**: Kisan Call Centre `1551`, iCall `9152987821`.

### 2. Action Policy: `KEEP_WITH_FLAG`
- **Rule**: These records will **NOT** be modified or deleted.
- **Flag Assigned**: `temporal_flag = "CONTAINS_TIME_SENSITIVE_FINANCIAL_DATA"`.
- **SFT Policy**: Retain in conversational dataset, but prepend a system prompt condition during model training instructing the assistant to include a temporal caveat: *"Prices and scheme guidelines reflect historical benchmarks; please verify current rates at your local Krishi Vigyan Kendra or mandi."*

---

## 9. Known Problematic Scenarios Policy

Explicit deterministic rules are specified for all identified problematic scenario clusters:

| Scenario ID / Pattern | Identified Anomaly | Root Cause | Specification Action | Non-Destructive Annotation |
| :--- | :--- | :--- | :--- | :--- |
| **`in-agri-0019`** (All 8 rows) | Advises selling Tea at MSP via FCI | Policy Hallucination (Tea has no MSP) | **Exclude entire scenario cluster from SFT** | `quality_flags = "POLICY_HALLUCINATION_TEA_MSP"`, `is_sft_eligible = False` |
| **`in-agri-0020`** (All 4 rows) | Mentions tea mandi MSP protections | Policy Hallucination (Tea has no MSP) | **Exclude entire scenario cluster from SFT** | `quality_flags = "POLICY_HALLUCINATION_TEA_MSP"`, `is_sft_eligible = False` |
| **`in-agri-0003`** (Row 441 only) | English Question + Urdu Answer | Translation Pipeline Mismatch | **Exclude Row 441 only; keep other 5 rows** | `quality_flags = "QA_LANGUAGE_MISMATCH"` for Row 441 |
| **`in-agri-0077`** (Row 376 only) | Urdu Question + Kashmiri Answer | Script / Locale Tag Mismatch | **Exclude Row 376 only; keep other 4 rows** | `quality_flags = "QA_LANGUAGE_MISMATCH"` for Row 376 |
| **27 Scenarios (Wheat, Gram, Potato)** | Tagged as `season = kharif` (All 110 rows) | Synthetic Schema Generation Skew | **Preserve raw season; add verified season column** | `original_season = "kharif"`, `verified_season = "rabi"`, `season_flag = "SEASON_MISMATCH_CORRECTED"` |

---

## 10. Scenario-Level vs. Row-Level Filtering Matrix

To avoid discarding valid data while preventing corrupt scenarios from contaminating training, the preprocessor implements a two-tier filtering hierarchy:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FILTERING DECISION HIERARCHY                          │
├──────────────────────────────────────┬──────────────────────────────────────────┤
│           ROW-LEVEL EXCLUSION        │          SCENARIO-LEVEL EXCLUSION        │
│    (Drop ONLY the single row)        │     (Drop ALL language variants)         │
├──────────────────────────────────────┼──────────────────────────────────────────┤
│ 1. Question-Answer Language Mismatch │ 1. Fundamental Agronomic Hallucination   │
│    (e.g. English Q with Urdu A)      │    (e.g. Tea MSP in all languages)       │
│ 2. Isolated Text Truncation / NaN    │ 2. Intrinsically Unsafe Agronomic Advice │
│    (Corrupted single translation)    │    (Fatal chemical recipe in all langs)  │
│ 3. Script Encoding Artifacts in one  │ 3. Contradictory Core Domain Facts       │
│    language only                     │    (Completely conflicting answers)      │
└──────────────────────────────────────┴──────────────────────────────────────────┘
```

### Concrete Rule:
If Scenario `in-agri-0003` has 6 rows, and Row 441 has a language mismatch, **only Row 441 is excluded from SFT**. The English (Row 226), Tamil, Malayalam, Marathi, Odia, and Telugu rows are **retained** because their agronomic advice is sound and aligned.

---

## 11. Target-Specific Dataset Policies

The preprocessor will generate 4 specialized dataset views from the cleaned master data:

| Dataset Target | Filtering & Inclusion Rules | Primary Purpose |
| :--- | :--- | :--- |
| **1. SFT Training Set** | `is_sft_eligible == True`, bracket headers stripped, `enhanced_*` columns dropped, verified safety. | Core instruction tuning for conversational AI assistant. |
| **2. Validation Set** | Group-held-out `scenario_id` clusters (15%), clean conversational format. | Hyperparameter tuning and loss convergence tracking. |
| **3. Test Benchmark Set** | Group-held-out `scenario_id` clusters (15%), clean conversational format. | Unbiased out-of-sample evaluation across English, Tamil, Hindi. |
| **4. Multilingual Eval Suite** | Parallel multilingual clusters across all 14 languages, including flagged rows. | Cross-lingual semantic consistency and translation robustness benchmarking. |

---

## 12. Complete Traceability & Provenance Schema

To ensure that any output row can be audited back to its exact line in `indian_agri_advisory_raw.csv`, the following provenance fields are mandatory:

```json
{
  "source_row_id": 441,
  "scenario_id": "in-agri-0003",
  "source_dataset": "indian_agri_advisory_raw.csv",
  "original_language_inferred": "en_ur_mismatch",
  "original_season": "kharif",
  "cleaning_status": "STRIPPED_HEADER_AND_NFC_NORMALIZED",
  "quality_flags": ["QA_LANGUAGE_MISMATCH", "UNTRANSLATED_ENGLISH_HEADER"],
  "is_sft_eligible": false,
  "is_eval_eligible": true
}
```

---

## 13. Proposed Final Processed Schema

| # | Field Name | Data Type | Action Tag | Description & Rationale |
| :-: | :--- | :--- | :-: | :--- |
| 1 | `source_row_id` | `int` | **DERIVED** | Original 0-indexed row position in raw CSV (0..717). |
| 2 | `scenario_id` | `string` | **KEEP** | Standardized scenario cluster ID (`id` in raw). |
| 3 | `language` | `string` | **DERIVED** | ISO 639-1 code (`en`, `ta`, `hi`, `mr`, `ml`, `pa`, `or`, `gu`, `kn`, `te`, `ur`, `bn`, `as`, `ks`). |
| 4 | `script` | `string` | **DERIVED** | Script name (`Latin`, `Tamil`, `Devanagari`, `Gurmukhi`, `Odia`, `Perso-Arabic`, etc.). |
| 5 | `question` | `string` | **DERIVED** | Cleaned natural question with bracket headers stripped and NFC normalized. |
| 6 | `answer` | `string` | **KEEP** | Cleaned, structured agricultural advisory. |
| 7 | `crop` | `string` | **KEEP** | Primary crop name (`crop_primary` in raw). |
| 8 | `category` | `string` | **KEEP** | Advisory domain (12 standard categories). |
| 9 | `farming_practice` | `string` | **KEEP** | Farming practice type (`conventional`, `organic`, etc.). |
| 10 | `growth_stage` | `string` | **KEEP** | Phenological stage (`pre_sowing`, `vegetative`, `flowering`, `harvest`). |
| 11 | `irrigation_type` | `string` | **KEEP** | Irrigation regime (`rainfed`, `tubewell`, `canal`, `borewell`). |
| 12 | `region` | `string` | **KEEP** | ICAR agro-climatic planning zone. |
| 13 | `original_season` | `string` | **KEEP** | Original raw season value (100% `kharif`). |
| 14 | `verified_season` | `string` | **DERIVED** | Corrected cropping season (`kharif`, `rabi`, `zaid`, `perennial`). |
| 15 | `severity` | `string` | **KEEP** | Urgency classification (`low`, `medium`, `high`, `urgent`). |
| 16 | `soil_type` | `string` | **KEEP** | Soil classification (9 types). |
| 17 | `source_type` | `string` | **KEEP** | Provenance tag (`agricultural_extension`). |
| 18 | `safety_status` | `string` | **DERIVED** | Safety tier (`LOW_RISK`, `VERIFICATION_REQUIRED`, `RESTRICTED_AGROCHEMICAL`). |
| 19 | `verification_required` | `bool` | **DERIVED** | Boolean flag indicating whether chemical/financial review is required. |
| 20 | `risk_reason` | `string` | **DERIVED** | Explanation of safety / temporal flags. |
| 21 | `quality_flags` | `list[str]`| **DERIVED** | List of detected defect tags (e.g. `["QA_LANGUAGE_MISMATCH"]`). |
| 22 | `is_sft_eligible` | `bool` | **DERIVED** | True if record meets zero-defect conversational SFT criteria. |
| 23 | `is_eval_eligible` | `bool` | **DERIVED** | True if record is suitable for multilingual benchmark evaluation. |
| 24 | `source_dataset` | `string` | **DERIVED** | Set to `"indian_agri_advisory_raw.csv"`. |
| 25 | `enhanced_prompt` | `string` | **DROP (SFT)** | Excluded from SFT export; preserved in archive. |
| 26 | `enhanced_completion` | `string`| **DROP (SFT)** | Excluded from SFT export; preserved in archive. |
| 27 | `reasoning_trace` | `float64`| **DROP** | 100% null in raw; dropped from all processed exports. |

---

## 14. Action Summary & Implementation Guardrails

### PREPROCESSING RULES (Agreed Implementation Order)
1. Ingest `ai/dataset/raw/indian_agri_advisory_raw.csv` without modifying the source file.
2. Index every row with an immutable `source_row_id` (0..717).
3. Apply Unicode NFC normalization across all string fields.
4. Execute `SYNTHETIC_HEADER_REGEX` to strip `[crop | region | season | severity]` from `question`.
5. Classify language and script using morphological discriminators (distinguishing Hindi from Marathi and Urdu from Kashmiri).
6. Flag direct Q-A language mismatches (Rows 441 and 376) and assign `is_sft_eligible = False`.
7. Scan for restricted agrochemicals (Chlorpyrifos) and assign safety audit tags.
8. Flag policy hallucinations (`in-agri-0019`, `in-agri-0020`) and exclude entire scenario clusters from SFT.
9. Populate `verified_season` for Rabi crops (Wheat, Gram, Potato) while preserving `original_season`.
10. Drop empty column `reasoning_trace` and synthetic wrapper columns `enhanced_*` from conversational exports.
11. Compute a group-aware `GroupShuffleSplit` on `scenario_id` (70% Train / 15% Val / 15% Test).
12. Export processed datasets to `ai/dataset/processed/` with complete JSON audit manifests.

### SUMMARY OF FIELD ASSIGNMENTS
- **FIELDS TO KEEP**: `id` (as `scenario_id`), `crop_primary`, `category`, `farming_practice`, `growth_stage`, `irrigation_type`, `region`, `season` (as `original_season`), `severity`, `soil_type`, `source_type`, `answer`.
- **FIELDS TO DERIVE**: `source_row_id`, `language`, `script`, `question` (stripped), `verified_season`, `safety_status`, `verification_required`, `risk_reason`, `quality_flags`, `is_sft_eligible`, `is_eval_eligible`, `source_dataset`.
- **FIELDS TO DROP (FROM SFT)**: `reasoning_trace` (100% empty), `enhanced_prompt`, `enhanced_completion`.
- **RECORDS TO EXCLUDE FROM SFT**:
  - Scenario `in-agri-0019` (All 8 rows - Tea MSP hallucination)
  - Scenario `in-agri-0020` (All 4 rows - Tea MSP hallucination)
  - Row 441 in `in-agri-0003` (English Question + Urdu Answer)
  - Row 376 in `in-agri-0077` (Urdu Question + Kashmiri Answer)
- **RECORDS TO REVIEW**: Rows recommending Chlorpyrifos (Rows 71, 247, 262, 300, 314) and time-sensitive MSP values.
- **INFORMATION WE MUST NOT ALTER**:
  - Do NOT transliterate or translate Indic text.
  - Do NOT lowercase Indic text.
  - Do NOT overwrite raw `season` values in-place (must be tracked via `original_season` vs `verified_season`).
  - Do NOT mutate or rewrite `ai/dataset/raw/indian_agri_advisory_raw.csv`.

---

## NEXT STEP

The next step is the creation of the automated preprocessing script `ai/src/preprocessing/clean_advisory_dataset.py` **only after user approval** of this specification.
