# SFT Conversation Format & Readiness Analysis for AgroCycle

**Dataset Evaluated**: `ai/dataset/processed/advisory_sft.jsonl` (704 clean records across 165 scenarios)  
**Target Architecture**: AgroCycle Multilingual Agriculture Conversational Assistant  
**Date of Analysis**: September 27, 2026  
**Document Status**: FORMAT SPECIFICATION & SFT READINESS REPORT

---

## Executive Summary

An in-depth structural, linguistic, and conversational readiness analysis was performed on the 704 SFT-eligible records in `ai/dataset/processed/advisory_sft.jsonl`.

### Key Analytical Findings:
1. **Chat Format Compatibility**: The dataset is **100% cleanly convertible** into the industry-standard OpenAI/Anthropic/HuggingFace `messages` conversation schema (`[{"role": "user", ...}, {"role": "assistant", ...}]`).
2. **Zero Persona / Synthetic Tag Contamination**: The `question` field contains pure, stripped natural farmer inquiries. The `answer` field contains complete, structured extension advisories free of system prompt wrappers (`enhanced_prompt`) and inline markdown code tags (``crop_primary=...``).
3. **Conversational Symmetry**: Average user questions are concise (**147 characters / ~24 words**), while assistant responses are comprehensive (**3,212 characters / ~473 words**) following a standard 5-part hierarchical advisory structure.
4. **Zero Cross-Lingual Mismatch**: In 100% of the 704 SFT records, the assistant response language strictly matches the user question language across all 14 Indic language varieties.
5. **Readiness Verdict**: The dataset is **READY for SFT formatting**, with recommended conversational system conditioning for time-sensitive financial figures and chemical safety disclaimers.

---

## 1. Exact Fields Present in Each Record

Inspection of `ai/dataset/processed/advisory_sft.jsonl` confirms the presence of 27 standardized fields per JSONL line:

| Field Name | Type | Value Range / Description | Role in SFT |
| :--- | :--- | :--- | :--- |
| `source_row_id` | `int` | `0` to `717` (Immutable raw CSV row index) | Provenance Tracking |
| `scenario_id` | `str` | `in-agri-0001` to `in-agri-0168` (165 unique scenarios) | Group Splitting & Leakage Prevention |
| `language` | `str` | ISO code (`ta`, `hi`, `en`, `mr`, `ml`, `pa`, `or`, etc.) | Metadata Filter & Routing |
| `script` | `str` | `Tamil`, `Devanagari`, `Latin`, `Malayalam`, etc. | Tokenizer & Rendering Tag |
| `question` | `str` | Natural farmer query (bracket header stripped) | **User Message (`role: user`)** |
| `answer` | `str` | Structured 5-part agricultural advisory | **Assistant Message (`role: assistant`)** |
| `original_question` | `str` | Raw unstripped question with `[...]` prefix | Audit Archival |
| `crop_primary` | `str` | 17 crops (e.g. `rice`, `wheat`, `cotton`, `groundnut`) | Metadata Filtering & Evaluation |
| `category` | `str` | 12 domains (e.g. `fertilizer`, `pest_control`, `irrigation`) | Evaluation Stratification |
| `farming_practice` | `str` | `conventional`, `organic`, `integrated` | Contextual Metadata |
| `growth_stage` | `str` | `pre_sowing`, `vegetative`, `flowering`, `harvest` | Phenological Metadata |
| `irrigation_type` | `str` | `rainfed`, `tubewell`, `canal`, `borewell` | Agronomic Metadata |
| `region` | `str` | 14 ICAR agro-climatic planning zones | Regional Context |
| `original_season` | `str` | 100% `kharif` (from raw CSV) | Raw Traceability |
| `verified_season` | `str` | `rabi`, `kharif`, `perennial` | Verified Agronomic Season |
| `season_verification_status` | `str` | `needs_external_verification`, `aligned_kharif` | Quality Audit |
| `severity` | `str` | `low`, `medium`, `high`, `urgent` | Priority Flag |
| `soil_type` | `str` | 9 soil classifications | Pedological Context |
| `source_type` | `str` | `agricultural_extension` | Provenance Tag |
| `safety_status` | `str` | `LOW_RISK`, `RESTRICTED_AGROCHEMICAL` | Safety Guardrail |
| `verification_required` | `bool` | `True` / `False` | Review Flag |
| `risk_reason` | `str/null`| Explanation of chemical/temporal flags | Audit Logging |
| `quality_flags` | `list` | e.g. `["SYNTHETIC_HEADER_STRIPPED"]` | Diagnostic Tags |
| `is_sft_eligible` | `bool` | `True` for all 704 records in this file | SFT Gate |
| `is_eval_eligible` | `bool` | `True` for all 704 records in this file | Evaluation Gate |
| `split` | `str` | `train` (493), `validation` (106), `test` (105) | Split Assignment |
| `source_dataset` | `str` | `"indian_agri_advisory_raw.csv"` | Data Source Tag |

---

## 2. Conversion to Standard SFT Chat Format

The dataset converts cleanly into the standard two-turn conversational format:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "குஜராத் சமவெளிகள் மற்றும் மலைகள் பகுதிக்கு வறட்சி மற்றும் பூச்சிகளுக்கு எதிர்ப்புத் திறன் கொண்ட பருத்தி ரகம் எது?"
    },
    {
      "role": "assistant",
      "content": "1. **சூழல் மதிப்பீடு:**\nநீங்கள் குஜராத் சமவெளிகள் மற்றும் மலைகள் வேளாண் காலநிலை மண்டலத்தில் அமைந்துள்ளீர்கள்..."
    }
  ],
  "metadata": {
    "source_row_id": 1,
    "scenario_id": "in-agri-0151",
    "language": "ta",
    "script": "Tamil",
    "crop": "cotton",
    "category": "variety_selection",
    "region": "gujarat_plains_and_hills",
    "soil_type": "black_cotton",
    "season": "kharif",
    "severity": "low",
    "safety_status": "LOW_RISK",
    "split": "train"
  }
}
```

---

## 3. Allocation of Record Fields

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FIELD ROLE ALLOCATION                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. USER MESSAGE (role: "user")                                                         │
│    └── question (Cleaned, natural farmer prompt without synthetic bracket headers)     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. ASSISTANT RESPONSE (role: "assistant")                                              │
│    └── answer (Complete, structured 5-part agricultural advisory)                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. METADATA CONTAINER (for tracking, evaluation, and selective training)              │
│    ├── source_row_id, scenario_id, source_dataset                                      │
│    ├── language, script                                                                │
│    ├── crop (from crop_primary), category, region, soil_type                           │
│    ├── farming_practice, growth_stage, irrigation_type, verified_season, severity      │
│    ├── safety_status, verification_required, quality_flags                             │
│    └── split (train, validation, test)                                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Why Metadata Must NOT Be Injected into User Prompts

Injecting metadata (e.g. `User: "Crop: Cotton | Region: Gujarat | Soil: Black Cotton. Which variety should I sow?"`) into the user prompt during SFT is strongly discouraged for the following technical reasons:

1. **Severe Inference Distribution Shift**: In real-world AgroCycle usage, smallholder farmers querying the assistant via mobile voice or chat will ask natural, colloquial questions (e.g., *"என் பருத்தி இலைகள் சுருண்டு காணப்படுகின்றன, என்ன செய்ய வேண்டும்?"*). They will never format their input as key-value metadata pairs.
2. **Context Generalization**: The assistant must learn to extract entities (crop, symptoms, geographic constraints) directly from natural language text rather than relying on pre-parsed developer variables.
3. **Conversational Fluidity**: Natural user prompts produce a robust model that can handle under-specified queries by providing balanced advice or asking targeted follow-ups.

---

## 5. Qualitative Inspection of Sample Records Across Languages

Twenty randomly selected records across English, Tamil, Hindi, Marathi, Telugu, Malayalam, and Punjabi were evaluated:

| Language | Sample ID | User Question Naturalness | Assistant Answer Naturalness | Q-A Language Match | Identified Observations |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **English** | `in-agri-0022` | High (173 chars) | High (3,397 chars, 5 parts) | **100% Match** | Recommends Mancozeb @ 2 g/L for maize leaf blight; well structured. |
| **English** | `in-agri-0149` | High (154 chars) | High (3,186 chars, 5 parts) | **100% Match** | Clear companion cropping advisory for cotton in Gujarat. |
| **English** | `in-agri-0071` | High (149 chars) | High (2,739 chars, 5 parts) | **100% Match** | Variety recommendation for Trans-Gangetic cotton. |
| **Tamil** | `in-agri-0151` | High (134 chars) | High (3,750 chars, Tamil) | **100% Match** | Accurate Tamil agro-climatic terminology (`வேளாண் காலநிலை மண்டலம்`). |
| **Tamil** | `in-agri-0063` | High (183 chars) | High (3,178 chars, Tamil) | **100% Match** | Wheat MSP inquiry; mentions Kisan Call Centre 1551. |
| **Tamil** | `in-agri-0018` | High (148 chars) | High (3,260 chars, Tamil) | **100% Match** | Sikkim organic tea subsidies; refers to Mission Organic Value Chain Development (MOVCDNER). |
| **Hindi** | `in-agri-0063` | High (171 chars) | High (3,227 chars, Hindi) | **100% Match** | Wheat MSP selling guidance via State procurement portals / FCI. |
| **Hindi** | `in-agri-0140` | High (170 chars) | High (3,312 chars, Hindi) | **100% Match** | Weather advisory for Kerala coconut; advises drainage and prophylactic spray. |
| **Hindi** | `in-agri-0085` | High (127 chars) | High (3,045 chars, Hindi) | **100% Match** | Flood-to-drip irrigation transition for Soybean with PMKSY subsidy information. |
| **Marathi** | `in-agri-0130` | High (197 chars) | High (3,618 chars, Marathi)| **100% Match** | Accurate Marathi agricultural vocabulary (`ऊस`, `मरगळली`, `गाळाची जमीन`). |
| **Marathi** | `in-agri-0038` | High (194 chars) | High (3,190 chars, Marathi)| **100% Match** | Paddy leaf yellowing & micronutrient advisory in Marathi. |
| **Telugu** | `in-agri-0119` | High (151 chars) | High (2,968 chars, Telugu) | **100% Match** | Groundnut MSP guidance in Coastal Andhra / Rayalaseema. |
| **Telugu** | `in-agri-0069` | High (128 chars) | High (3,371 chars, Telugu) | **100% Match** | Drip irrigation conversion for cotton under PMKSY. |
| **Malayalam**| `in-agri-0114` | High (112 chars) | High (3,232 chars, Malayalam)| **100% Match** | Ragi intercropping in Southern Plateau; accurate Malayalam prose. |
| **Malayalam**| `in-agri-0043` | High (135 chars) | High (3,248 chars, Malayalam)| **100% Match** | Middle Gangetic Plains wheat variety advisory. |
| **Punjabi** | `in-agri-0160` | High (121 chars) | High (3,000 chars, Gurmukhi)| **100% Match** | Bajra companion cropping with Guar; references NFSM scheme. |
| **Punjabi** | `in-agri-0117` | High (105 chars) | High (3,420 chars, Gurmukhi)| **100% Match** | Groundnut post-harvest drying & moisture management. |

### Observations:
- **No Persona Instructions**: Unlike `enhanced_prompt`, the `answer` text contains zero meta-instructions ("*Act as...*").
- **Language Alignment**: Questions and answers are strictly in the same language and script.
- **Length & Tone**: Answers are thorough and authoritative (~473 words), providing complete end-to-end guidance rather than fragmented snippets.

---

## 6. Length & Distribution Statistics (704 SFT Records)

### Length Metrics

```
========================================================================================
LENGTH & VOLUME STATISTICS (704 SFT Records)
========================================================================================
Question Length (Characters) : Mean = 147.2 | Median = 147.5 | Min =  70 | Max =  253
Question Length (Words)      : Mean =  23.7 | Median =  23.0 | Min =   9 | Max =   43
Answer Length (Characters)   : Mean = 3,212 | Median = 3,190 | Min = 2,366 | Max = 4,495
Answer Length (Words)        : Mean = 473.3 | Median = 457.0 | Min =  292 | Max =  833
========================================================================================
```

### Language Distribution (704 SFT Records)

| Language | Code | Script | Count | Percentage |
| :--- | :---: | :--- | :-: | :-: |
| **Malayalam** | `ml` | Malayalam | 66 | 9.38% |
| **Odia** | `or` | Odia | 66 | 9.38% |
| **Tamil** | `ta` | Tamil | 65 | 9.23% |
| **Punjabi** | `pa` | Gurmukhi | 65 | 9.23% |
| **English** | `en` | Latin | 64 | 9.09% |
| **Gujarati** | `gu` | Gujarati | 61 | 8.66% |
| **Kannada** | `kn` | Kannada | 60 | 8.52% |
| **Telugu** | `te` | Telugu | 59 | 8.38% |
| **Urdu** | `ur` | Perso-Arabic | 50 | 7.10% |
| **Bengali** | `bn` | Bengali | 45 | 6.39% |
| **Hindi** | `hi` | Devanagari | 38 | 5.40% |
| **Marathi** | `mr` | Devanagari | 35 | 4.97% |
| **Assamese** | `as` | Bengali | 18 | 2.56% |
| **Kashmiri** | `ks` | Perso-Arabic | 12 | 1.70% |

### Category & Crop Distribution

- **Top Categories**: Fertilizer (71), Irrigation (65), Financial Support (64), Crop Management (64), Schemes (61), Harvest Timing (58), Variety Selection (56), Disease (56), Soil Health (54), Pest Control (53), Market Price (53), Weather (49).
- **Top Crops**: Rice (193), Wheat (78), Groundnut (66), Sugarcane (65), Cotton (63), Jowar (36), Ragi (30), Maize (28), Coconut (25), Bajra (22), Gram (21), Soybean (19), Arecanut (15), Jute (14), Moth Bean (12), Potato (11), Tea (6).

---

## 7. Response Structure Consistency

All 704 assistant answers adhere strictly to an identical 5-part hierarchical structure:

```markdown
**1. Situation Assessment:** [Regional agro-climatic context, climate, soil, and crop stage analysis]
**2. Immediate Action:** [Urgent curative intervention, immediate cultural/chemical step]
**3. Step-by-Step Recommendation:** [Detailed agronomic protocol, application method, irrigation timing]
**4. Risk Management & Precautions:** [Weather contingencies, pest monitoring, toxicity warnings]
**5. Long-term / Government Schemes:** [Subsidies, PM-KISAN, KCC, soil health restoration, extension contacts]
```

This rigid structural consistency is beneficial for training an assistant that provides comprehensive agronomic guidance.

---

## 8. SFT Conditioning & Training Strategy

### Evaluation of Training Strategies:
- **Strategy A (Direct Answer)**: Delivers clear, immediate guidance.
- **Strategy B (Answer + Cite Sources)**: *Not recommended* for this dataset because raw data contains no URLs, DOIs, or bulletin numbers. Enforcing citations would teach the model to fabricate source references.
- **Strategy C (Answer + Clarifying Questions)**: *Not recommended* for this single-turn dataset. The answers are already exhaustive; injecting artificial questions creates dialogue loops.
- **Strategy D (Answer + Safety Disclaimer)**: *Essential* for agrochemicals, dosages, and temporal prices.

### Recommended Strategy:
**Combination of (A) Direct Domain Advisory + (D) Safety & Temporal Disclaimers (via System Conditioning)**.

During SFT, the model will be trained with a standardized system prompt:
> *"You are AgroCycle, an expert agricultural assistant. Provide clear, empathetic, and actionable agronomic advice. Always advise farmers to wear protective gear during chemical applications and verify current market prices/schemes at their local KVK or mandi."*

---

## 9. Records Requiring Selective Handling in SFT

While the 14 severe policy hallucinations and language mismatches were already excluded during preprocessing, the following records in `advisory_sft.jsonl` require conditional handling:

1. **Chlorpyrifos Prescriptions (5 rows)**:
   - Rows: `71`, `247`, `262`, `300`, `314` (Tagged `safety_status = "RESTRICTED_AGROCHEMICAL"`).
   - *Policy*: Keep in dataset, but ensure the system prompt enforces PPE and IPM caveats.
2. **Time-Sensitive Historical Prices (148 rows)**:
   - Tagged `quality_flags = ["TIME_SENSITIVE_FINANCIAL_DATA"]`.
   - *Policy*: Retain with temporal system conditioning so the model treats numerical prices as historical reference points.

---

## 10. Recommended Final SFT JSONL Schema

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are AgroCycle, a trusted multilingual agricultural AI assistant for Indian farmers. Provide accurate, practical, and safety-conscious agronomic advisory in the user's language."
    },
    {
      "role": "user",
      "content": "<cleaned natural question>"
    },
    {
      "role": "assistant",
      "content": "<structured 5-part agricultural advisory>"
    }
  ],
  "metadata": {
    "source_row_id": 0,
    "scenario_id": "in-agri-0099",
    "language": "gu",
    "script": "Gujarati",
    "crop": "jowar",
    "category": "financial_support",
    "region": "western_plateau_and_hills",
    "soil_type": "black_cotton",
    "farming_practice": "conventional",
    "growth_stage": "harvest",
    "irrigation_type": "rainfed",
    "verified_season": "kharif",
    "severity": "urgent",
    "safety_status": "LOW_RISK",
    "verification_required": true,
    "split": "validation"
  }
}
```

---

## DATASET READY?

# **YES**

The dataset in `ai/dataset/processed/advisory_sft.jsonl` is completely clean, structurally verified, and ready to be exported into SFT conversation JSONL format.

---

## REQUIRED CLEANUP

No further destructive cleanup of `advisory_sft.jsonl` is required. The synthetic bracket headers, persona prompt injections, and 14 invalid hallucination/language-mismatch rows were already removed in the preprocessing stage.

---

## RECOMMENDED MESSAGE FORMAT

Standard 3-message chat payload (`system`, `user`, `assistant`) paired with a lightweight JSON `metadata` container for dataset stratification and loss weighting.

---

## POTENTIAL PROBLEMS

1. **Answer Verbosity**: Answers average ~473 words. While excellent for comprehensive advisory reports, mobile voice interactions may require future multi-turn conversational pruning.
2. **Kharif Season Skew**: All records in the raw dataset originate from Kharif framing. Winter Rabi and summer Zaid dynamics should be supplemented when the Ajrasakha dataset is integrated.
3. **Single-Turn Nature**: The dataset consists exclusively of single-turn QA pairs. Multi-turn interactive dialogues should be co-trained when Ajrasakha becomes available.

---

## NEXT STEP

Wait for access approval for the **Ajrasakha Agriculture QA Dataset**. When approved, we will execute cross-dataset schema reconciliation, multi-turn dialogue conversion, and unified training set generation.

---
*Analysis saved to `ai/dataset/sft_format_analysis.md`.*
