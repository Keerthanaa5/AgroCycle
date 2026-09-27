# Base Model Selection Report for AgroCycle

**System Target**: AgroCycle Multilingual Agriculture AI Assistant  
**Primary Target Languages**: Tamil (`ta`), Hindi (`hi`), English (`en`)  
**Secondary / Future Languages**: Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Urdu, Assamese, Kashmiri  
**Interaction Modalities**: Text Chat, Voice-Transcribed ASR queries, Code-Mixed Queries (Tanglish / Hinglish)  
**Tuning Method**: QLoRA (4-bit / 8-bit Quantized Low-Rank Adaptation)  
**Date of Evaluation**: September 27, 2026  
**Document Status**: TECHNICAL ARCHITECTURAL SPECIFICATION

---

## Executive Summary

To build an accurate, empathetic, and reliable agricultural assistant for Indian smallholder farmers, the underlying base model must satisfy four non-negotiable criteria:
1. **High Tokenizer Efficiency & Linguistic Parity across Indic Scripts**: Low character-to-token fragmentation for Tamil (Dravidian script) and Devanagari (Hindi/Marathi) to prevent high inference latency and degraded semantic comprehension.
2. **Robust Code-Mixing (Tanglish / Hinglish) & ASR Tolerance**: Resilience against phonetically Romanized queries (e.g. *"poochi marunthu enna podanum"* or *"gehun me paani kab dena hai"*) and imperfect speech-to-text transcriptions.
3. **Feasible QLoRA Resource Profile**: Trainable on standard single-GPU hardware (16GB–24GB VRAM like NVIDIA T4, RTX 4090, A10G, or A100) with fast quant-inference (<150ms time-to-first-token).
4. **Permissive Open Licensing**: Fully authorized for research, commercialization, and on-premise rural deployment without proprietary API lock-in.

This report evaluates **8 prominent open-weight models** across Qwen, Sarvam, Gemma, Llama, Aya, and Mistral families.

---

## 1. Candidate Model Profiles

---

### Candidate 1: Qwen2.5-7B-Instruct

- **Exact Model Name**: Qwen2.5-7B-Instruct
- **Hugging Face Model ID**: `Qwen/Qwen2.5-7B-Instruct`
- **Parameter Count**: 7.61 Billion
- **Context Length**: 128,000 tokens (Native 32k / Extended 128k with YaRN)
- **License**: **Apache 2.0** (Fully permissive open source for commercial and research use)
- **Supported Languages**: 29+ languages officially supported; strong pre-training representation across major Indic languages (Hindi, Tamil, Telugu, Bengali, Malayalam, Marathi, Urdu, etc.).
- **Tamil Capability**: **Very High**. The 152,064 vocabulary tokenizer allocates dense subword clusters for Tamil consonants and vowel ligatures, minimizing token split degradation.
- **Hindi Capability**: **Very High**. Strong syntactic parsing and idiomatic agricultural fluency across Devanagari scripts.
- **English Capability**: **Exceptional**. State-of-the-art benchmarks in its parameter tier for reasoning, structured output, and factual recall.
- **Code-Mixing Suitability (Tanglish/Hinglish)**: **High**. High multilingual pre-training volume allows smooth parsing of Romanized Indic inputs and mixed-language agrarian terminology (e.g., *"drip irrigation subsidy eppadi apply panradhu"*).
- **Approximate VRAM Requirements for QLoRA**:
  - Training (4-bit NF4, Batch Size 2, Gradient Accumulation 4, LoRA Rank 16, Context 2048): **~9.5 GB to 11.5 GB VRAM** (Easily runnable on a 16GB T4 / RTX 3080/4090 / A10G).
- **Inference Considerations**: Fits in ~4.8 GB VRAM in 4-bit (AWQ / GPTQ / GGUF Q4_K_M); achieves >45 tokens/sec on consumer GPUs.
- **Strengths**:
  - Apache 2.0 license with zero commercial restrictions.
  - Exceptionally rich 152k vocabulary prevents tokenizer bottleneck in Indic languages.
  - Superior instruction following and strict adherence to structured JSON / markdown outputs.
- **Limitations**:
  - Requires careful system prompt grounding to avoid over-answering in overly formal prose.

---

### Candidate 2: Sarvam-2B (Sarvam AI)

- **Exact Model Name**: Sarvam-2B-v0.5 / Sarvam-2B
- **Hugging Face Model ID**: `sarvamai/sarvam-2b-v0.5`
- **Parameter Count**: 2.0 Billion
- **Context Length**: 8,192 tokens
- **License**: **Apache 2.0**
- **Supported Languages**: Specifically optimized for 10 Indian languages (Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu) + English.
- **Tamil Capability**: **High (Native Optimization)**. Tokenizer custom-built for Indic scripts, producing the lowest character-per-token ratio in the industry for Tamil.
- **Hindi Capability**: **High (Native Optimization)**. Pre-trained on massive synthetic and curated Indian language corpora.
- **English Capability**: **Good / Moderate**. Solid conversational foundation, but lower world-knowledge capacity than 7B+ models.
- **Code-Mixing Suitability (Tanglish/Hinglish)**: **Very High**. Built specifically for Indian conversational dynamics and phonetic transliteration.
- **Approximate VRAM Requirements for QLoRA**:
  - Training (4-bit NF4, Rank 16, Context 2048): **~4.5 GB to 6.0 GB VRAM** (Runnable on low-cost consumer GPUs, RTX 3060, or free-tier T4).
- **Inference Considerations**: Fits in ~1.5 GB VRAM in 4-bit; ultra-fast inference (>100 tokens/sec), capable of on-device mobile/edge execution.
- **Strengths**:
  - Unmatched token efficiency for Indic scripts (2-3x fewer tokens per sentence than Llama).
  - Extremely low deployment and serving costs.
  - Native understanding of Indian cultural and rural context.
- **Limitations**:
  - 2B parameter scale limits complex multi-hop agronomic diagnostic reasoning.
  - Requires fine-tuning on domain data to acquire deep technical crop protection knowledge.

---

### Candidate 3: Gemma-2-9B-It (Google)

- **Exact Model Name**: Gemma-2-9B-It
- **Hugging Face Model ID**: `google/gemma-2-9b-it`
- **Parameter Count**: 9.24 Billion
- **Context Length**: 8,192 tokens (Sliding Window Attention 4096)
- **License**: **Gemma Terms of Use** (Permissive open model license for commercial & research use)
- **Supported Languages**: Multilingual pre-training across English, European, and major Asian/Indic languages.
- **Tamil Capability**: **Moderate-High**. Strong comprehension; generation can occasionally use formal or literal translations.
- **Hindi Capability**: **Very High**. Excellent fluency and accurate technical vocabulary in Devanagari.
- **English Capability**: **Exceptional**. Industry-leading 9B reasoning and instruction accuracy.
- **Code-Mixing Suitability (Tanglish/Hinglish)**: **Moderate-High**. Parses Hinglish fluently; Tanglish performance is slightly less idiomatic than Qwen or Sarvam.
- **Approximate VRAM Requirements for QLoRA**:
  - Training (4-bit NF4, Rank 16, Context 2048): **~11.0 GB to 13.5 GB VRAM**.
- **Inference Considerations**: Fits in ~6.2 GB in 4-bit; requires sliding window attention support in inference engines (vLLM / Ollama).
- **Strengths**:
  - Outstanding factual precision and reasoning density per parameter.
  - Large 256,000 vocabulary size.
  - Very clean alignment with low hallucination rates.
- **Limitations**:
  - Slightly higher VRAM requirements than 7B architectures.
  - Sliding window attention requires explicit module targeting during LoRA adapter attachment.

---

### Candidate 4: Llama-3.1-8B-Instruct (Meta)

- **Exact Model Name**: Meta-Llama-3.1-8B-Instruct
- **Hugging Face Model ID**: `meta-llama/Llama-3.1-8B-Instruct`
- **Parameter Count**: 8.03 Billion
- **Context Length**: 128,000 tokens (RoPE scaled)
- **License**: **Llama 3.1 Community License** (Permissive for commercial use up to 700M MAU)
- **Supported Languages**: Officially supports 8 languages (English, German, French, Italian, Portuguese, Hindi, Spanish, Thai); extensive pre-training on broader multilingual data.
- **Tamil Capability**: **Moderate**. Understands Tamil, but the 128k tokenizer has higher token fragmentation on Dravidian scripts (more subwords per sentence), leading to longer generation times.
- **Hindi Capability**: **Very High**. Officially supported Indic language with strong fluency.
- **English Capability**: **Exceptional**. Benchmark leader for 8B general instruction following.
- **Code-Mixing Suitability (Tanglish/Hinglish)**: **Moderate-High**. Excellent with Hinglish; moderate with southern Indic code-mixing.
- **Approximate VRAM Requirements for QLoRA**:
  - Training (4-bit NF4, Rank 16, Context 2048): **~10.0 GB to 12.0 GB VRAM**.
- **Inference Considerations**: Broadest ecosystem compatibility across llama.cpp, vLLM, TensorRT-LLM, TGI.
- **Strengths**:
  - Massive community support, tooling, and adapter ecosystem.
  - 128k context length natively supported.
- **Limitations**:
  - Higher token cost on Tamil and Malayalam compared to Qwen2.5 and Sarvam.

---

### Candidate 5: Qwen2.5-3B-Instruct

- **Exact Model Name**: Qwen2.5-3B-Instruct
- **Hugging Face Model ID**: `Qwen/Qwen2.5-3B-Instruct`
- **Parameter Count**: 3.09 Billion
- **Context Length**: 32,768 tokens (up to 128k with YaRN)
- **License**: **Apache 2.0**
- **Supported Languages**: Multilingual across 29+ languages including Hindi and Tamil.
- **Tamil Capability**: **High**. Retains the same 152k vocabulary as Qwen2.5-7B, yielding high token compression.
- **Hindi Capability**: **High**. Fast and accurate conversational generation.
- **English Capability**: **Very High**. Outperforms older 7B models across standard instruction benchmarks.
- **Code-Mixing Suitability (Tanglish/Hinglish)**: **High**.
- **Approximate VRAM Requirements for QLoRA**:
  - Training (4-bit NF4, Rank 16, Context 2048): **~5.5 GB to 7.0 GB VRAM** (Easily fine-tuned on budget GPUs).
- **Inference Considerations**: Fits in ~2.2 GB VRAM in 4-bit; ideal for lightweight cloud micro-instances or local edge hubs.
- **Strengths**:
  - Apache 2.0 license.
  - Sweet spot between Sarvam-2B size and 7B reasoning capability.
  - 152k token vocabulary efficiency.
- **Limitations**:
  - Less world knowledge capacity than 7B/9B models for complex, multi-crop disease diagnosis.

---

### Candidate 6: Qwen2.5-14B-Instruct

- **Exact Model Name**: Qwen2.5-14B-Instruct
- **Hugging Face Model ID**: `Qwen/Qwen2.5-14B-Instruct`
- **Parameter Count**: 14.7 Billion
- **Context Length**: 128,000 tokens
- **License**: **Apache 2.0**
- **Supported Languages**: 29+ languages.
- **Tamil Capability**: **Exceptional**. Near-native grammatical nuance and complex agricultural advisory generation.
- **Hindi Capability**: **Exceptional**. Flawless technical and conversational Devanagari generation.
- **English Capability**: **State-of-the-Art** in open weights below 70B.
- **Code-Mixing Suitability (Tanglish/Hinglish)**: **Very High**. Seamless entity extraction from code-mixed inputs.
- **Approximate VRAM Requirements for QLoRA**:
  - Training (4-bit NF4, Rank 16, Context 2048): **~15.0 GB to 18.5 GB VRAM** (Fits comfortably on a 24GB RTX 3090/4090 or single A10G/A100).
- **Inference Considerations**: Fits in ~9.2 GB VRAM in 4-bit (AWQ / GPTQ / Q4_K_M); requires 16GB+ GPU for serving high concurrency.
- **Strengths**:
  - State-of-the-art agronomic reasoning and complex query synthesis.
  - Robust against noisy, poorly transcribed voice inputs.
  - Apache 2.0.
- **Limitations**:
  - Higher compute requirements than 7B models during training and inference.

---

### Candidate 7: Aya-23-8B (Cohere For AI)

- **Exact Model Name**: Aya-23-8B
- **Hugging Face Model ID**: `CohereForAI/aya-23-8B`
- **Parameter Count**: 8.02 Billion
- **Context Length**: 8,192 tokens
- **License**: **CC-BY-NC 4.0** (Non-Commercial Research License)
- **Supported Languages**: 23 languages explicitly covered, including Hindi, Tamil, Telugu, Bengali, Gujarati, Malayalam, Marathi, Punjabi, Urdu.
- **Tamil Capability**: **Very High**. Deeply aligned on human-curated multilingual datasets.
- **Hindi Capability**: **Very High**.
- **English Capability**: **High**.
- **Code-Mixing Suitability**: **Moderate-High**.
- **Approximate VRAM Requirements for QLoRA**: **~10.0 GB to 12.0 GB VRAM**.
- **Strengths**: Specifically engineered for multilingual equity and non-English fluency.
- **Limitations**:
  - **Restrictive License (CC-BY-NC 4.0)**: Precludes direct commercial deployment in a farmer-facing production app without custom commercial licensing from Cohere.

---

### Candidate 8: Mistral-Nemo-Instruct-2407 (Mistral AI & NVIDIA)

- **Exact Model Name**: Mistral-Nemo-Instruct-2407
- **Hugging Face Model ID**: `mistralai/Mistral-Nemo-Instruct-2407`
- **Parameter Count**: 12.2 Billion
- **Context Length**: 128,000 tokens
- **License**: **Apache 2.0**
- **Supported Languages**: Global multilingual model powered by the 128k Tekken tokenizer.
- **Tamil Capability**: **High**. Tekken tokenizer provides solid compression over older Mistral models.
- **Hindi Capability**: **Very High**.
- **English Capability**: **Exceptional**.
- **Code-Mixing Suitability**: **High**.
- **Approximate VRAM Requirements for QLoRA**: **~13.0 GB to 16.0 GB VRAM**.
- **Strengths**: Large 128k context, Apache 2.0 license, strong reasoning.
- **Limitations**: Higher memory footprint than 7B models with slightly less Indic specialized tuning out of the box than Qwen2.5 or Sarvam.

---

## 2. Cross-Model Technical Comparison Matrix

| Model | Parameters | License | Vocab Size | Indic Token Efficiency | Tamil Fluency | Hindi Fluency | Code-Mixing (Tanglish/Hinglish) | QLoRA VRAM (4-bit) | 4-bit Quant Size |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Qwen2.5-7B-Instruct** | 7.6B | **Apache 2.0** | 152,064 | **Very High** | **Very High** | **Very High** | **High** | **~10 GB** | **~4.8 GB** |
| **Sarvam-2B** | 2.0B | **Apache 2.0** | Custom | **Exceptional** | **High** | **High** | **Very High** | **~5 GB** | **~1.5 GB** |
| **Gemma-2-9B-It** | 9.2B | Permissive | 256,000 | **High** | **Moderate-High**| **Very High** | **Moderate-High** | **~12 GB** | **~6.2 GB** |
| **Llama-3.1-8B-Instruct**| 8.0B | Llama 3.1 | 128,256 | **Moderate** | **Moderate** | **Very High** | **Moderate-High** | **~11 GB** | **~5.1 GB** |
| **Qwen2.5-3B-Instruct** | 3.1B | **Apache 2.0** | 152,064 | **Very High** | **High** | **High** | **High** | **~6 GB** | **~2.2 GB** |
| **Qwen2.5-14B-Instruct**| 14.7B | **Apache 2.0** | 152,064 | **Very High** | **Exceptional**| **Exceptional**| **Very High** | **~16 GB** | **~9.2 GB** |
| **Aya-23-8B** | 8.0B | CC-BY-NC | 256,000 | **Very High** | **Very High** | **Very High** | **Moderate-High** | **~11 GB** | **~5.1 GB** |
| **Mistral-Nemo-12B** | 12.2B | **Apache 2.0** | 128,000 | **High** | **High** | **Very High** | **High** | **~14 GB** | **~7.8 GB** |

---

## 3. Tier Classification

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MODEL SELECTION TIERS FOR AGROCYCLE                                   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ A. SMALLEST PRACTICAL MODEL (Edge & Ultra-Low VRAM)                                                   │
│    ├── Primary: sarvamai/sarvam-2b-v0.5 (2.0B parameters | ~5GB QLoRA VRAM | Apache 2.0)               │
│    └── Alternative: Qwen/Qwen2.5-3B-Instruct (3.1B parameters | ~6GB QLoRA VRAM | Apache 2.0)         │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ B. BALANCED MODEL (Optimal Domain Reasoning, Multilingual Fluency & Standard GPU Fit)                 │
│    └── Recommended: Qwen/Qwen2.5-7B-Instruct (7.6B parameters | ~10GB QLoRA VRAM | Apache 2.0)         │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ C. HIGHER-CAPABILITY MODEL (Deep Agronomic Synthesis & Complex Diagnostic Reasoning)                   │
│    ├── Primary: Qwen/Qwen2.5-14B-Instruct (14.7B parameters | ~16GB QLoRA VRAM | Apache 2.0)          │
│    └── Alternative: google/gemma-2-9b-it (9.2B parameters | ~12GB QLoRA VRAM | Permissive)            │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technical Recommendation for AgroCycle

### **Primary Recommendation: Category B — `Qwen/Qwen2.5-7B-Instruct`**

### Detailed Justification:

1. **Alignment with 704-Record Initial SFT Dataset**:
   - At 7.6B parameters, Qwen2.5 possesses strong baseline world knowledge regarding plant pathology, botany, and soil chemistry.
   - Fine-tuning with QLoRA on our 704 curated, 5-part structured advisory records will rapidly adapt the model to the exact AgroCycle response format without catastrophic forgetting.
2. **Readiness for Future Ajrasakha Dataset Integration**:
   - When the Ajrasakha Agriculture QA dataset is added, the 7B architecture scales gracefully to thousands of multi-turn conversational turns and diverse regional dialects.
3. **Linguistic Parity across Tamil, Hindi, and English**:
   - The 152k tokenizer prevents character splitting in Tamil matras and conjuncts.
   - Handles Tamil, Hindi, English, and Romanized Tanglish/Hinglish without token degradation.
4. **Hardware & QLoRA Feasibility**:
   - Requires only **~10.5 GB VRAM** during 4-bit QLoRA training (rank=16, alpha=32).
   - Easily trainable on a single affordable GPU (e.g. NVIDIA T4 16GB, RTX 3090/4090 24GB, or A10G).
5. **Production Serving**:
   - 4-bit AWQ/GGUF quantization runs in <5 GB VRAM, enabling cost-effective deployment on a single low-tier cloud GPU instance serving concurrent farmer queries.
6. **Commercial License**:
   - **Apache 2.0** grants complete freedom for commercial application and deployment across Indian agricultural ecosystems.

---

## 5. Base Model Adaptation Strategy: Direct vs. Instruct vs. QLoRA

### Evaluation of Approaches:

| Approach | Description | Evaluation for AgroCycle |
| :--- | :--- | :--- |
| **1. Use Base Model Directly** | Prompting a raw base completion model (e.g. `Qwen2.5-7B` raw) without instruction alignment. | **REJECTED**: Raw base models lack conversational chat template understanding, produce repetitive sentence completions, and do not adhere to user-assistant role formatting. |
| **2. Use Out-of-the-Box Instruct Model** | Deploying `Qwen2.5-7B-Instruct` zero-shot with prompt engineering. | **ACCEPTABLE AS BASELINE, BUT SUB-OPTIMAL**: The model follows instructions well, but lacks localized Indian agro-climatic zone framing, ICAR package of practices knowledge, and the standardized 5-part AgroCycle response structure. |
| **3. QLoRA Domain Fine-Tuning on Instruct Model** | Starting from an instruction-tuned checkpoint (`Qwen2.5-7B-Instruct`) and training low-rank adapter weights (QLoRA) on `split_train.jsonl`. | **RECOMMENDED STRATEGY**: Combines pre-trained instruction-following and safety alignment with domain-specific agricultural precision and multi-lingual adherence. |

### Technical Rationale for QLoRA on Instruct Checkpoint:
- **Preserves Core Alignment**: Starting from an Instruct checkpoint retains foundational conversational safety and multilingual reasoning.
- **Domain Specialization**: QLoRA updates target linear projection layers (`q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`) with low memory overhead, aligning the assistant with localized Indian farming practices.
- **Modular Deployment**: The resulting LoRA adapter (~50 MB–150 MB) can be hot-swapped or merged into 4-bit/8-bit base weights for ultra-efficient inference.

---

## Conclusion & Action Plan

1. **Selected Model Architecture**: **`Qwen/Qwen2.5-7B-Instruct`** (Balanced Tier) with **`sarvamai/sarvam-2b-v0.5`** as the lightweight edge alternative.
2. **Adaptation Protocol**: 4-bit QLoRA fine-tuning on `ai/dataset/processed/split_train.jsonl` with validation tracking on `ai/dataset/processed/split_validation.jsonl`.
3. **Execution Guardrail**: Do not download weights or initiate training until the training script specification is reviewed and approved.

---
*Report saved to `ai/training/base_model_selection.md`.*
