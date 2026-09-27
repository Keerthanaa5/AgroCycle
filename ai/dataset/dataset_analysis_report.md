# Comprehensive Dataset Inspection & Quality Audit Report

**Dataset Inspected**: `ai/dataset/raw/indian_agri_advisory_raw.csv`  
**Target Project**: AgroCycle AI Assistant (English, Tamil, Hindi, Tanglish / Indic Code-Mixed)  
**Date of Inspection**: September 27, 2026  
**Auditor**: Antigravity AI  
**Scope**: Non-destructive dataset inspection, multilingual linguistic auditing, agricultural safety verification, and integration planning.

---

## Executive Summary

A comprehensive, non-destructive audit of `ai/dataset/raw/indian_agri_advisory_raw.csv` (16.16 MB, 718 rows, 16 columns) was performed. 

### Key Findings:
1. **Multilingual Scenario Architecture**: The dataset contains **167 unique agricultural scenarios** (`id`), of which 161 are instantiated across multiple Indian languages. Repeated IDs represent parallel translations/renderings of the same underlying scenario with 100% identical metadata.
2. **True Linguistic Breakdown**: The dataset spans **14 Indian linguistic varieties** across 8 script families:
   - English (65 Q / 64 A), Tamil (66), Hindi (39), Marathi (36), Malayalam (68), Punjabi (67), Odia (67), Gujarati (61), Kannada (61), Telugu (60), Urdu (53), Bengali (45), Assamese (18), and Kashmiri (12 Q / 13 A).
3. **Synthetic / Machine-Translated Nature**: Questions and answers follow strict structured templates ("*1. Situation Assessment*", "*2. Immediate Action*", etc.) and stylized bracketed prefixes (`[crop | region | season | severity]`). They represent curated benchmark / extension templates rather than spontaneous conversational farmer queries.
4. **Critical Data Anomalies & Hallucinations**:
   - **100% Kharif Skew**: All 718 records have `season = 'kharif'`, improperly labeling strict Rabi crops (e.g., 78 Wheat rows, 21 Gram rows, 11 Potato rows) as Kharif.
   - **Agricultural Hallucinations**: MSP queries and procurement recommendations exist for plantation crops like **Tea** (`in-agri-0019`), which are not covered under the Central Government MSP regime.
   - **High-Hazard Agrochemicals**: Mentions of restricted pesticides such as **Chlorpyrifos** without integrated pest management (IPM) or personal protective equipment (PPE) warnings.
   - **Reasoning Trace**: Column `reasoning_trace` is 100% empty (718 nulls).
   - **Translation Mismatches**: Exactly 1 question duplicate exists (`in-agri-0003`, row 441) where the question was retained in English while its answer was translated into Urdu.

---

## 1. Basic Dataset Information

| Metric | Value | Technical Details / Notes |
| :--- | :--- | :--- |
| **Total Rows** | **718** | Complete tabular records |
| **Total Columns** | **16** | Schema definition detailed below |
| **File Size (Bytes)** | **16,946,762 bytes** | Exactly 16.16 MB on disk |
| **Completely Empty Columns** | **1** | `reasoning_trace` (0 non-null values) |
| **Completely Empty Rows** | **0** | No all-null rows found |

### Schema & Column Data Types

| # | Column Name | Pandas Dtype | Inferred Content Type | Missing Count | Missing % |
| :-: | :--- | :--- | :--- | :-: | :-: |
| 1 | `enhanced_prompt` | `object (str)` | Structured LLM prompt template | 0 | 0.0% |
| 2 | `enhanced_completion` | `object (str)` | Structured markdown response | 0 | 0.0% |
| 3 | `reasoning_trace` | `float64` | Completely null / empty | 718 | 100.0% |
| 4 | `answer` | `object (str)` | Standard extension advisory | 0 | 0.0% |
| 5 | `category` | `object (str)` | Advisory domain (12 categories) | 0 | 0.0% |
| 6 | `crop_primary` | `object (str)` | Primary crop name (17 crops) | 0 | 0.0% |
| 7 | `farming_practice` | `object (str)` | Method (conventional/organic/etc.) | 0 | 0.0% |
| 8 | `growth_stage` | `object (str)` | Phenological stage (4 stages) | 0 | 0.0% |
| 9 | `id` | `object (str)` | Scenario identifier (`in-agri-XXXX`) | 0 | 0.0% |
| 10 | `irrigation_type` | `object (str)` | Water source (4 types) | 0 | 0.0% |
| 11 | `question` | `object (str)` | Farmer query with bracket header | 0 | 0.0% |
| 12 | `region` | `object (str)` | ICAR Agro-climatic zone (14 zones) | 0 | 0.0% |
| 13 | `season` | `object (str)` | Agricultural season (100% `kharif`) | 0 | 0.0% |
| 14 | `severity` | `object (str)` | Urgency level (4 levels) | 0 | 0.0% |
| 15 | `soil_type` | `object (str)` | Soil classification (9 types) | 0 | 0.0% |
| 16 | `source_type` | `object (str)` | Origin label (100% `agricultural_extension`) | 0 | 0.0% |

---

## 2. Unique IDs and Duplicates

### Frequency Statistics
- **Total Unique IDs**: `167`
- **Repeated ID Rows**: `551` (Rows beyond the initial unique scenario)
- **Exact Duplicate Rows**: `0`
- **Duplicate Answers**: `0`
- **Duplicate Questions**: `1` (Row 226 and Row 441 share identical English question for `in-agri-0003`)

### Frequency Distribution of IDs

```
Frequency (Occurrences per ID):
1 occurrence  : 6 scenarios  (Single-language records)
2 occurrences : 19 scenarios
3 occurrences : 32 scenarios
4 occurrences : 38 scenarios
5 occurrences : 34 scenarios
6 occurrences : 21 scenarios
7 occurrences : 9 scenarios
8 occurrences : 5 scenarios
9 occurrences : 3 scenarios
Total Scenarios: 167 (spanning 718 rows)
```

### Investigation of Repeated IDs

Repeated IDs do **not** represent redundant duplicate data. Instead, they represent **multilingual parallel renderings of the same underlying agricultural scenario**.
- Metadata consistency across repeated IDs: **100.0% consistent** (0 inconsistencies across `category`, `crop_primary`, `farming_practice`, `growth_stage`, `irrigation_type`, `region`, `season`, `severity`, `soil_type`, `source_type`).

#### Concrete Multilingual Examples for the Same ID:

##### Example 1: Scenario `in-agri-0063` (Wheat | Financial Support / MSP | Trans-Gangetic Plains)
- **English Version (Row 333)**:
  - *Question*: `[wheat | Trans-Gangetic Plains | kharif | urgent]\nThe market price for wheat is below the Minimum Support Price (MSP). Where can I sell at MSP and how does the procurement process work?`
  - *Answer*: `**1. Situation Assessment:** You are a wheat farmer in the Trans-Gangetic Plains...`
- **Hindi Version (Row 4)**:
  - *Question*: `[गेहूं | ट्रांस-गंगेटिक मैदान | खरीफ | अत्यावश्यक]\nगेहूं का बाजार भाव न्यूनतम समर्थन मूल्य (MSP) से कम है। मैं MSP पर कहाँ बेच सकता हूँ और क्रय प्रक्रिया कैसे काम करती है?`
  - *Answer*: `**1. स्थिति मूल्यांकन:** आप ट्रांस-गंगेटिक मैदानों में एक गेहूं किसान हैं...`
- **Tamil Version (Row 67)**:
  - *Question*: `[கோதுமை | டிரான்ஸ்-கங்கை சமவெளி | காரீப் | அவசரம்]\nகோதுமையின் சந்தை விலை குறைந்தபட்ச ஆதரவு விலையை (MSP) விடக் குறைவாக உள்ளது. நான் எங்கு MSP-ல் விற்கலாம் மற்றும் கொள்முதல் செயல்முறை எவ்வாறு செயல்படுகிறது?`
  - *Answer*: `**1. சூழ்நிலை மதிப்பீடு:** நீங்கள் டிரான்ஸ்-கங்கை சமவெளிப் பகுதியில் கோதுமை விவசாயம் செய்கிறீர்கள்...`
- **Punjabi Version (Row 116)**:
  - *Question*: `[ਕਣਕ | ਟਰਾਂਸ-ਗੰਗਾ ਦੇ ਮੈਦਾਨ | ਖਰੀਫ | ਜ਼ਰੂਰੀ]\nਕਣਕ ਦਾ ਬਾਜ਼ਾਰੀ ਭਾਅ ਘੱਟੋ-ਘੱਟ ਸਮਰਥਨ ਮੁੱਲ (MSP) ਤੋਂ ਘੱਟ ਹੈ...`
- **Odia Version (Row 695)**:
  - *Question*: `[ଗହମ | ଟ୍ରାନ୍ସ-ଗାଙ୍ଗେଟିକ୍ ସମତଳ ଭୂମି | ଖରିଫ | ଜରୁରୀ]\nଗହମର ବଜାର ଦର ସର୍ବନିମ୍ନ ସହାୟକ ମୂଲ୍ୟ (MSP) ଠାରୁ କମ୍ ରହିଛି...`

---

## 3. Language Analysis

A character-level Unicode block analysis combined with linguistic morphology verification was performed across all 718 rows.

### Linguistic Distribution (Question & Answer)

| Language | Primary Script | Question Count | Question % | Answer Count | Answer % |
| :--- | :--- | :-: | :-: | :-: | :-: |
| **Malayalam** | Malayalam (`0D00-0D7F`) | 68 | 9.47% | 68 | 9.47% |
| **Punjabi** | Gurmukhi (`0A00-0A7F`) | 67 | 9.33% | 67 | 9.33% |
| **Odia** | Odia (`0B00-0B7F`) | 67 | 9.33% | 67 | 9.33% |
| **Tamil** | Tamil (`0B80-0BFF`) | 66 | 9.19% | 66 | 9.19% |
| **English** | Latin (`0041-007A`) | 65 | 9.05% | 64 | 8.91% |
| **Gujarati** | Gujarati (`0A80-0AFF`) | 61 | 8.50% | 61 | 8.50% |
| **Kannada** | Kannada (`0C80-0CFF`) | 61 | 8.50% | 61 | 8.50% |
| **Telugu** | Telugu (`0C00-0C7F`) | 60 | 8.36% | 60 | 8.36% |
| **Urdu** | Perso-Arabic (`0600-06FF`) | 53 | 7.38% | 53 | 7.38% |
| **Bengali** | Bengali (`0980-09FF`) | 45 | 6.27% | 45 | 6.27% |
| **Hindi** | Devanagari (`0900-097F`) | 39 | 5.43% | 39 | 5.43% |
| **Marathi** | Devanagari (`0900-097F`) | 36 | 5.01% | 36 | 5.01% |
| **Assamese** | Bengali/Assamese (`ৰ`, `ৱ`) | 18 | 2.51% | 18 | 2.51% |
| **Kashmiri** | Perso-Arabic (`0600-06FF`) | 12 | 1.67% | 13 | 1.81% |
| **Total** | | **718** | **100.0%** | **718** | **100.0%** |

### Code-Mixing & Script Analysis

1. **Question Code-Mixing (38.02% / 273 rows)**:
   - Non-English questions frequently retain English bracket headers (e.g. `[bajra | Western Dry Region | kharif | medium]`) or English acronyms (`MSP`, `KCC`, `PM-KISAN`).
   - *Colloquial Latin Code-Mixing (Tanglish / Hinglish)*: **Absent**. Questions are not written phonetically in Latin script (e.g., "*pachi marunthu enna podanum*").
2. **Answer Code-Mixing (100.0% / 662 non-English rows)**:
   - Every non-English answer embeds Latin technical entities, including chemical names (*Carbendazim*, *Mancozeb*, *Chlorpyrifos*), variety tags (*MCU-5*, *CO-86032*), institutions (*FCI*, *KVK*, *NABARD*), and scheme acronyms (*PMFBY*, *e-NAM*).

---

## 4. English / Tamil / Hindi Specific Analysis

AgroCycle's primary target languages were analyzed for diversity and fidelity:

| Metric | English | Tamil | Hindi (Strict) | Devanagari Total (HI+MR) |
| :--- | :-: | :-: | :-: | :-: |
| **Total Records** | 65 (Q) / 64 (A) | 66 | 39 | 75 |
| **Unique Scenarios (IDs)** | 65 | 66 | 39 | 65 |
| **Crops Represented** | 17 / 17 | 17 / 17 | 15 / 17 | 17 / 17 |
| **Categories Represented** | 12 / 12 | 12 / 12 | 12 / 12 | 12 / 12 |
| **Agro-climatic Regions** | 14 / 14 | 14 / 14 | 14 / 14 | 14 / 14 |
| **Seasons Represented** | 1 (100% `kharif`) | 1 (100% `kharif`) | 1 (100% `kharif`) | 1 (100% `kharif`) |
| **Growth Stages** | 4 / 4 | 4 / 4 | 4 / 4 | 4 / 4 |

### Linguistic Nature: Natural vs Translated vs Synthetic
- **Classification**: **Machine-Translated / Synthetic LLM Generation (Category C & D)**.
- **Evidence from Data**:
  1. *Rigid Template Skeletons*: Every answer follows identical markdown structure ("1. Situation Assessment / 1. **சூழல் மதிப்பீடு** / **1. स्थिति मूल्यांकन**", "2. Immediate Action / 2. **உடனடி நடவடிக்கை** / **2. तत्काल कार्रवाई**").
  2. *Literal Region Translations*: Official agro-climatic zone titles are translated verbatim (e.g., "டிரான்ஸ்-கங்கை சமவெளி", "मध्य गंगा मैदान", "पश्चिम कोरडा प्रदेश").
  3. *Bracket Prefixes*: All queries start with metadata tags `[crop | region | season | severity]`.

---

## 5. Multilingual Scenario Mapping

### Overlap & Pair Statistics
- **Total Scenarios**: `167`
- **Multilingual Scenarios (>1 language)**: `161` (96.4%)
- **Single Language Scenarios**: `6` (3.6%)
- **English + Tamil Pairs**: `26`
- **English + Hindi Pairs**: `28` (or `38` if including Marathi)
- **Tamil + Hindi Pairs**: `25` (or `37` if including Marathi)
- **English + Tamil + Hindi Triples**: `9` (or `14` if including Marathi)

### Sample Multilingual Scenarios Matrix

| ID | Languages Available | Primary Crop | Category | Region |
| :--- | :--- | :--- | :--- | :--- |
| `in-agri-0001` | Gujarati, Kashmiri | Rice | `pest_control` | Western Himalayan |
| `in-agri-0002` | English, Kannada, Malayalam, Odia, Punjabi, Telugu | Rice | `crop_disease` | Western Himalayan |
| `in-agri-0003` | English, Malayalam, Marathi, Odia, Tamil, Telugu, Urdu | Rice | `fertilizer` | Western Himalayan |
| `in-agri-0006` | Assamese, English, Malayalam, Punjabi, Telugu | Maize | `soil_health` | Western Himalayan |
| `in-agri-0007` | English, Marathi, Tamil, Urdu | Maize | `variety_selection` | Western Himalayan |
| `in-agri-0009` | Gujarati, Hindi, Tamil, Urdu | Wheat | `harvest_timing` | Western Himalayan |
| `in-agri-0010` | Bengali, Gujarati, Marathi, Odia, Punjabi | Wheat | `government_schemes` | Western Himalayan |
| `in-agri-0019` | English, Marathi, Tamil, Urdu | Tea | `financial_support` | Eastern Himalayan |
| `in-agri-0032` | English, Malayalam, Odia, Punjabi, Telugu | Jute | `weather_advisory` | Lower Gangetic Plains |
| `in-agri-0063` | English, Hindi, Odia, Punjabi, Tamil | Wheat | `financial_support` | Trans-Gangetic Plains |

### Translation Incompleteness / Anomalies Identified:
1. **Scenario `in-agri-0003` (Row 441)**: Question is in English (`[rice | Western Himalayan | kharif | medium] My rice leaves are pale green...`), but Answer is in Urdu (`**1. صورتحال کا جائزہ:**...`).
2. **Scenario `in-agri-0159` (Row 589)**: Question has an English header with Odia body (`[bajra | Western Dry Region | kharif | low] Western Dry Region ପାଇଁ କେଉଁ bajra ଜ...`).

---

## 6. Column-by-Column Quality Analysis

| Column Name | Representation & Purpose | Utility for AgroCycle | Recommended Action | Normalization / Quality Issues |
| :--- | :--- | :--- | :--- | :--- |
| `enhanced_prompt` | Persona-wrapped prompt with injected metadata tags | Low for core fine-tuning; usable for prompt engineering | **Remove from SFT / Retain in Raw** | Contains synthetic boilerplate ("*Act as an Agricultural Extension Expert...*") |
| `enhanced_completion` | Markdown formatted completion with inline code tags | Medium-Low | **Exclude from Training** | Injects inline metadata tags (``crop_primary=rice``) and repetitive distress helpline numbers |
| `reasoning_trace` | Placeholder for Chain-of-Thought reasoning | None (100% null) | **Drop Column** | 718 null values (0 bytes useful data) |
| `answer` | Core domain advisory response | **High (Primary Target)** | **Retain (with Safety Filtering)** | Well structured, but requires verification of chemical dosages and outdated MSP figures |
| `category` | Advisory domain classifier | **High** | **Retain** | Clean (12 categories, no nulls) |
| `crop_primary` | Crop name | **High** | **Retain** | Clean (17 crops, lowercase) |
| `farming_practice` | Farming practice type | **Medium** | **Retain** | Clean (`conventional`, `organic`, etc.) |
| `growth_stage` | Phenological stage of crop | **High** | **Retain** | Clean (`pre_sowing`, `vegetative`, `flowering`, `harvest`) |
| `id` | Scenario cluster ID | **Critical (Deduplication / Group Splitting)** | **Retain as `scenario_id`** | Essential to prevent cross-lingual data leakage |
| `irrigation_type` | Irrigation method | **Medium** | **Retain** | Clean (`rainfed`, `tubewell`, `canal`, `borewell`) |
| `question` | Farmer input query | **High (Primary Input)** | **Retain (Strip Bracket Headers)** | Strip synthetic prefix `[crop | region | ...]` for natural conversational training |
| `region` | ICAR Agro-climatic zone | **High** | **Retain** | Standardized 14 planning commission zones |
| `season` | Cropping season | **Low / Problematic** | **Re-annotate / Correct** | 100% `kharif` (falsely marks Rabi crops like wheat/gram as kharif) |
| `severity` | Urgency classification | **Medium** | **Retain** | Clean (`low`, `medium`, `high`, `urgent`) |
| `soil_type` | Soil category | **Medium-High** | **Retain** | Clean (9 soil types) |
| `source_type` | Provenance label | **Low** | **Retain for Metadata** | Constant value (`agricultural_extension`) |

---

## 7. Enhanced Prompt / Completion Analysis

### Comparison & Derivation
- `enhanced_prompt` is derived synthetically by wrapping the raw `question` with system-level instruction templates:
  - *Example (English)*: `Act as an Agricultural Extension Expert for the Western Himalayan region. Analyze the following scenario: A medium-scale farmer is cultivating Rice during the Kharif season on silty loam soil...`
  - *Example (Hindi)*: `# भूमिका: आप एक कृषि विशेषज्ञ और सहायक हैं जो ट्रांस-गंगेटिक मैदानों के किसानों को आपातकालीन स्थितियों में मार्गदर्शन प्रदान करते हैं...`
- `enhanced_completion` restructures `answer` into markdown headers and injects:
  1. Metadata tags directly into prose (e.g. ``crop_primary=wheat``, ``region=trans-gangetic_plains``).
  2. Automatic mental-health / distress hotline disclaimers for urgent queries (e.g., `Kisan Call Centre 1551 (toll-free, 24/7) और iCall 9152987821`).

### Assessment for Model Training
- **Verdict**: **DO NOT USE `enhanced_prompt` or `enhanced_completion` for SFT/Chat training**.
  - *Reason 1*: They cause the model to output artificial syntax tags (``crop_primary=...``) during normal farmer conversations.
  - *Reason 2*: The persona prefix leads to repetitive meta-commentary rather than direct, empathetic agricultural guidance.

---

## 8. Reasoning Trace Analysis

- **Total Rows**: `718`
- **Non-Empty Count**: `0` (100.0% Missing / NaN)
- **Verdict**: Confirmed completely empty. Must be dropped during preprocessing or populated using a dedicated CoT pipeline.

---

## 9. Agricultural Coverage

### 1. Crops (17 Crops)

| Crop | Frequency | Percentage | Crop | Frequency | Percentage |
| :--- | :-: | :-: | :--- | :-: | :-: |
| **Rice** | 194 | 27.02% | **Bajra** | 22 | 3.06% |
| **Wheat** | 78 | 10.86% | **Gram (Chickpea)** | 21 | 2.92% |
| **Groundnut** | 67 | 9.33% | **Soybean** | 19 | 2.65% |
| **Sugarcane** | 65 | 9.05% | **Tea** | 18 | 2.51% |
| **Cotton** | 63 | 8.77% | **Arecanut** | 15 | 2.09% |
| **Jowar (Sorghum)** | 36 | 5.01% | **Jute** | 14 | 1.95% |
| **Ragi (Finger Millet)** | 30 | 4.18% | **Moth Bean** | 12 | 1.67% |
| **Maize** | 28 | 3.90% | **Potato** | 11 | 1.53% |
| **Coconut** | 25 | 3.48% | | | |

### 2. Categories (12 Advisory Categories)

| Category | Count | % | Category | Count | % |
| :--- | :-: | :-: | :--- | :-: | :-: |
| **Financial Support** | 72 | 10.03% | **Market Price** | 57 | 7.94% |
| **Fertilizer Management** | 72 | 10.03% | **Variety Selection** | 56 | 7.80% |
| **Irrigation Advisory** | 66 | 9.19% | **Crop Disease** | 56 | 7.80% |
| **Crop Management** | 64 | 8.91% | **Soil Health** | 54 | 7.52% |
| **Government Schemes** | 61 | 8.50% | **Pest Control** | 53 | 7.38% |
| **Harvest Timing** | 58 | 8.08% | **Weather Advisory** | 49 | 6.82% |

### 3. Agro-Climatic Regions (14 Zones)

| Region | Count | % | Region | Count | % |
| :--- | :-: | :-: | :--- | :-: | :-: |
| **West Coast Plains & Ghats** | 62 | 8.64% | **Western Plateau & Hills** | 50 | 6.96% |
| **Western Dry Region** | 55 | 7.66% | **Western Himalayan** | 50 | 6.96% |
| **East Coast Plains & Hills** | 54 | 7.52% | **Upper Gangetic Plains** | 49 | 6.82% |
| **Central Plateau & Hills** | 54 | 7.52% | **Middle Gangetic Plains** | 48 | 6.69% |
| **Gujarat Plains & Hills** | 52 | 7.24% | **Southern Plateau & Hills** | 48 | 6.69% |
| **Eastern Himalayan** | 52 | 7.24% | **Eastern Plateau & Hills** | 47 | 6.55% |
| **Trans-Gangetic Plains** | 51 | 7.10% | **Lower Gangetic Plains** | 46 | 6.41% |

### 4. Soil Types, Irrigation, Growth Stages, Seasons & Severity

| Feature | Distribution |
| :--- | :--- |
| **Soil Type (9)** | Black Cotton (156), Alluvial (153), Laterite (114), Sandy (55), Silty Loam (50), Sandy Loam (49), Red Loamy (48), Red Laterite (47), Clay Alluvial (46) |
| **Irrigation (4)** | Rainfed (320), Tubewell (200), Canal (150), Borewell (48) |
| **Growth Stage (4)** | Pre-sowing (243), Vegetative (239), Harvest (187), Flowering (49) |
| **Season (1)** | **Kharif (718, 100%)** *(Note: Critical skew — 0 Rabi or Zaid records)* |
| **Severity (4)** | Medium (305), High (224), Low (117), Urgent (72) |

---

## 10. Agricultural Safety / Quality Audit

The dataset recommendations were classified into 5 safety tiers:

### 1. SAFE / LOW-RISK
- **Definition**: General agronomic cultural practices, organic compost preparation, basic soil sampling methods, standard harvest moisture checks.
- **Example (Row 11)**: Jowar grain storage drying instructions recommending cleaning, sun drying to <10-12% moisture, and using hermetic bags.

### 2. NEEDS SOURCE VERIFICATION
- **Definition**: Specific chemical dosages, generic fertilizer NPK ratios without soil test report (STR) calibration.
- **Example (Row 19)**: Maize leaf blight recommendation to spray Mancozeb @ 2 g/L. While standard, it lacks water volume per acre guidelines and pre-harvest intervals (PHI).

### 3. POTENTIALLY UNSAFE
- **Definition**: High-hazard / restricted agrochemicals, hazardous tank mixes, or ungrounded pesticide applications without safety gear / pollinator warnings.
- **Example (Rows 71, 247, 300)**: Recommends **Chlorpyrifos** for caterpillar infestation in paddy. Chlorpyrifos is heavily restricted/phased out in multiple states and toxic to aquatic ecosystems; IPM alternatives (e.g. *Bacillus thuringiensis*, neem formulations, pheromone traps) should be prioritized.

### 4. OUTDATED / TIME-SENSITIVE
- **Definition**: Hardcoded market rates, specific historical MSP figures, and changing loan subvention interest percentages.
- **Example (Row 4)**: States Wheat MSP as ₹2,150/quintal (reflects 2023-24 season; MSP is revised annually by CACP).

### 5. UNKNOWN / HALLUCINATORY
- **Definition**: Agriculturally contradictory or non-existent policy claims.
- **Example 1 (Row 23 / ID `in-agri-0019`)**: Tea farmer asking where to sell tea at MSP, and the advisory explaining FCI procurement procedures for Tea. **Tea has NO MSP regime** in India (it is a commercial plantation crop governed by the Tea Board under the Commerce Ministry).
- **Example 2 (All Wheat / Gram rows)**: Labeled as `kharif` crops in northern India, which contradicts national cropping calendars (Wheat is sown Nov-Dec as Rabi).

---

## 11. Source Quality Analysis

- **Declared `source_type`**: 100% `agricultural_extension`.
- **Citations & Grounding**: **0 citations provided**. No references to ICAR package of practices, State Agricultural University (SAU) manuals, KVK bulletins, or Central Insecticides Board & Registration Committee (CIBRC) guidelines.
- **RAG Readiness**: **Low as raw context documents**. The dataset cannot serve as an authoritative RAG knowledge base without attaching verified extension references and CIBRC chemical labels.

---

## 12. Temporal & Outdated Information Audit

The following time-sensitive entities were identified across the 718 records:

1. **Minimum Support Prices (MSP)**:
   - Wheat MSP: `₹2,150` / quintal (Historical 2023-24 rate).
   - Groundnut MSP: `₹5,090` / quintal.
   - Jowar MSP: `₹2,970 - ₹3,180` / quintal.
2. **Government Scheme Specifics**:
   - **PM-KISAN**: Mentions ₹6,000/year in 3 installments of ₹2,000.
   - **PMFBY Premium**: Mentions 2% for Kharif crops, 1.5% for Rabi, 5% for commercial/horticultural.
   - **KCC (Kisan Credit Card)**: Mentions ₹1.6 lakh collateral-free limit and 4% effective interest rate (with 3% prompt repayment subvention).
3. **Emergency Helplines**:
   - Kisan Call Centre: `1551` / `1800-180-1551`.
   - Psycho-social Support Helpline: `iCall 9152987821`.

---

## 13. Training Data Suitability Scores (1–5)

| Task | Score (1–5) | Technical Justification |
| :--- | :-: | :--- |
| **A. Supervised Fine-Tuning (SFT)** | **3.5 / 5** | Well-structured domain answers with good Indic terminology, but requires cleaning bracketed question headers, removing empty CoT fields, and filtering seasonal/MSP hallucinations. |
| **B. Instruction Tuning** | **3.0 / 5** | High consistency, but low prompt diversity. All prompts follow rigid template styles rather than conversational farmer dialogues. |
| **C. Retrieval-Augmented Generation (RAG)** | **2.0 / 5** | Lacks source URLs, document chunks, SAU citations, and CIBRC chemical verification. |
| **D. Evaluation Benchmark** | **3.5 / 5** | Good standardized benchmark for multi-domain agricultural QA across 14 agro-climatic zones. |
| **E. Multilingual Evaluation** | **4.5 / 5** | Excellent parallel multi-script dataset across 14 Indic language varieties for evaluating cross-lingual semantic consistency. |
| **F. Intent / Entity Extraction** | **4.5 / 5** | Rich, perfectly aligned categorical metadata (`crop_primary`, `category`, `growth_stage`, `soil_type`, `region`, `severity`) ideal for training NLU slot-filling models. |

---

## 14. Recommended AgroCycle Schema

A normalized, clean schema is proposed for future dataset processing:

```json
{
  "scenario_id": "string (e.g. in-agri-0063)",
  "language": "string (e.g. ta, hi, en, mr, te, kn, ml, bn, gu, pa, or, ur, ks, as)",
  "script": "string (e.g. Tamil, Devanagari, Latin, Gurmukhi, etc.)",
  "question": "string (Cleaned natural question without bracket prefixes)",
  "answer": "string (Structured, verified agricultural advisory)",
  "crop": "string (Normalized lowercase crop name)",
  "category": "string (Advisory category)",
  "growth_stage": "string (pre_sowing | vegetative | flowering | harvest)",
  "farming_practice": "string (conventional | organic | integrated)",
  "irrigation_type": "string (rainfed | tubewell | canal | borewell)",
  "soil_type": "string (Normalized soil classification)",
  "region": "string (Standard ICAR agro-climatic zone)",
  "season": "string (Corrected: kharif | rabi | zaid | perennial)",
  "severity": "string (low | medium | high | urgent)",
  "safety_tier": "string (low_risk | needs_verification | restricted_chemical)",
  "source_dataset": "string (indian_agri_advisory_v5)",
  "license": "string (Dataset specific license tag)"
}
```

### Schema Rationale:
- `scenario_id`: Preserves multilingual alignment and enables leakage-free splitting.
- `language` & `script`: Explicitly tracks language code and script, distinguishing Hindi from Marathi and Urdu from Kashmiri.
- `question`: Normalized by stripping synthetic bracket tags `[crop | region | ...]`.
- `safety_tier`: Flags records containing high-hazard chemicals or time-sensitive financial rates.

---

## 15. Recommended Dataset Split Strategy

### Group-Aware Stratified Scenario Splitting
To prevent **cross-lingual data leakage**, records must be split by `scenario_id` rather than random row sampling. If scenario `in-agri-0063` is in the Test split, all language versions (English, Hindi, Tamil, Punjabi, Odia) must strictly remain in the Test split.

```
Total Unique Scenarios: 167
├── Training Set   (70% ~ 117 Scenarios | ~502 Multilingual Rows)
├── Validation Set (15% ~ 25 Scenarios  | ~108 Multilingual Rows)
└── Test Set       (15% ~ 25 Scenarios  | ~108 Multilingual Rows)
```

- **Stratification Criteria**: Stratified on `category` and `crop_primary` to ensure uniform representation across all 12 categories in train, validation, and test splits.

---

## 16. Ajrasakha Integration Plan

When access to the **Ajrasakha Agriculture QA Dataset** is approved, the following integration pipeline will be executed:

```
[indian_agri_advisory_raw.csv]          [Ajrasakha Agriculture QA]
             │                                      │
             ▼                                      ▼
   Schema Normalization                    Schema Normalization
   (Strip bracket headers)                 (Map Q/A & metadata)
             │                                      │
             └──────────────────┬───────────────────┘
                                ▼
                     Deduplication & Clustering
                 (Semantic Embedding Cosine Sim)
                                ▼
                     Safety & CIBRC Chemical Filter
                 (Flag Chlorpyrifos / Outdated MSP)
                                ▼
                     Unified AgroCycle Dataset
               (Group Split by Clustered Scenario ID)
```

1. **Field Reconciliation**:
   - Map Ajrasakha question/answer fields into `question` and `answer`.
   - Infer missing metadata (`crop`, `growth_stage`, `category`) using fine-tuned NLU classifier trained on this dataset's clean metadata labels.
2. **Deduplication**: Run sentence-transformer cross-lingual embeddings to prevent duplicating overlapping QA scenarios between Ajrasakha and this dataset.
3. **Conflict Resolution**: Where chemical advice differs, defer to CIBRC/ICAR verified package of practices.

---

## 17. Final Recommendations

### A. KEEP
- Core advisory QA pairs (`question`, `answer`).
- Standardized metadata columns (`id` as `scenario_id`, `crop_primary`, `category`, `growth_stage`, `farming_practice`, `irrigation_type`, `region`, `soil_type`, `severity`).
- Multilingual mappings across all 14 Indian linguistic varieties.

### B. REVIEW
- Chemical recommendations (specifically rows recommending **Chlorpyrifos**, **Carbendazim**, **Mancozeb**) for dosage precision and PHI safety.
- All monetary figures and MSP claims (e.g. ₹2,150 for wheat).
- The 12 Kashmiri and 18 Assamese samples for script-rendering consistency.

### C. REMOVE
- `reasoning_trace` (100% empty, 0 utility).
- Synthetic prompt boilerplates (`enhanced_prompt` and `enhanced_completion`) from core training targets.
- The invalid Tea MSP scenario (`in-agri-0019`) or re-annotate it as general market price advisory without FCI/MSP claims.

### D. DO NOT TOUCH YET
- Do not modify or overwrite `ai/dataset/raw/indian_agri_advisory_raw.csv`.
- Do not finalize train/val/test splits or generate fine-tuning tokenized datasets until Ajrasakha is received and co-stratified.

### E. NEXT STEP
1. Review this dataset analysis report.
2. Prepare the non-destructive preprocessing pipeline script in `ai/src/preprocessing/` (ready to execute once Ajrasakha is received).
3. Verify CIBRC banned chemical list rules to integrate into the automated safety filter.

---
*Report generated and saved to `ai/dataset/dataset_analysis_report.md`.*
