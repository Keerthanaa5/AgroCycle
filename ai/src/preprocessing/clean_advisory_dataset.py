#!/usr/bin/env python3
"""
================================================================================
AGROCYCLE PREPROCESSING PIPELINE
================================================================================
Script: ai/src/preprocessing/clean_advisory_dataset.py
Purpose: Non-destructive cleaning, language disambiguation, safety auditing,
         provenance enrichment, and group-aware train/val/test splitting
         for Indian Agriculture Advisory Multilingual Dataset.
Author: Antigravity AI (Pair Programming with AgroCycle Engineer)
Date: September 27, 2026
================================================================================
"""

import os
import sys
import json
import re
import hashlib
import unicodedata
import random
from collections import defaultdict, Counter
import pandas as pd

# Enforce UTF-8 standard output across all platforms (including Windows console)
sys.stdout.reconfigure(encoding='utf-8')

# ==============================================================================
# CONFIGURATION & FILE PATHS
# ==============================================================================
RAW_CSV_PATH = os.path.join('ai', 'dataset', 'raw', 'indian_agri_advisory_raw.csv')
PROCESSED_DIR = os.path.join('ai', 'dataset', 'processed')

OUTPUT_CLEAN_ALL = os.path.join(PROCESSED_DIR, 'advisory_clean_all.jsonl')
OUTPUT_SFT = os.path.join(PROCESSED_DIR, 'advisory_sft.jsonl')
OUTPUT_EVAL = os.path.join(PROCESSED_DIR, 'advisory_eval.jsonl')
OUTPUT_REVIEW = os.path.join(PROCESSED_DIR, 'advisory_review.jsonl')
OUTPUT_SPLIT_TRAIN = os.path.join(PROCESSED_DIR, 'split_train.jsonl')
OUTPUT_SPLIT_VAL = os.path.join(PROCESSED_DIR, 'split_validation.jsonl')
OUTPUT_SPLIT_TEST = os.path.join(PROCESSED_DIR, 'split_test.jsonl')

RANDOM_SEED = 42

# SFT Exclusions (Policy Hallucinations & Language Mismatches)
EXCLUDED_SCENARIOS_FROM_SFT = {'in-agri-0019', 'in-agri-0020'}
EXCLUDED_SOURCE_ROWS_FROM_SFT = {441, 376}

# CIBRC High-Hazard & Monitored Agrochemicals
RESTRICTED_AGROCHEMICALS = [
    'chlorpyrifos', 'monocrotophos', 'carbofuran', 'phorate',
    'paraquat', 'glyphosate', 'carbendazim'
]

# Time-Sensitive Financial / Scheme Keywords
TIME_SENSITIVE_KEYWORDS = [
    'msp', 'minimum support price', 'न्यूनतम समर्थन', 'குறைந்தபட்ச ஆதரவு',
    'हमीभाव', 'pm-kisan', 'pmfby', 'fasal bima', 'kisan credit card',
    '1551', '9152987821', '1800-180-1551'
]

# Rabi crops labeled as Kharif in raw data
RABI_CROPS = {'wheat', 'gram', 'potato'}
PERENNIAL_CROPS = {'coconut', 'arecanut', 'tea'}

# Synthetic Bracket Header Regex Pattern
SYNTHETIC_HEADER_REGEX = re.compile(r'^\s*\[\s*[^\]]+\s*\]\s*[\r\n]*', re.UNICODE)

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def compute_file_md5(filepath: str) -> str:
    """Computes MD5 hash to verify file integrity."""
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def normalize_text(text: str) -> str:
    """
    Applies lossless Unicode NFC normalization, whitespace standardization,
    and line break harmonization without altering Indic characters.
    """
    if not isinstance(text, str):
        return ""
    # Unicode Canonical Decomposition + Canonical Composition
    text = unicodedata.normalize('NFC', text)
    # Standardize line breaks
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # Replace non-breaking spaces and zero-width spaces
    text = text.replace('\u00A0', ' ').replace('\u200B', '').replace('\ufeff', '')
    # Normalize curly quotes
    text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    # Normalize multiple consecutive horizontal spaces (preserving newlines)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    # Normalize excessive consecutive newlines to maximum 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def clean_question_text(raw_question: str) -> tuple[str, bool]:
    """
    Strips synthetic [crop | region | season | severity] prefix from question.
    Returns (cleaned_question, had_bracket_header).
    """
    normalized_q = normalize_text(raw_question)
    has_header = bool(SYNTHETIC_HEADER_REGEX.match(normalized_q))
    cleaned = SYNTHETIC_HEADER_REGEX.sub('', normalized_q).strip()
    return cleaned, has_header

# Lexical markers for Devanagari disambiguation
MARATHI_MARKERS = {
    'आहे', 'आहेत', 'आणि', 'माझ्या', 'उस', 'ऊस', 'शेतकरी', 'पद्धत',
    'करावी', 'करावे', 'होईल', 'नाही', 'झाली', 'तांदूळ', 'गहू', 'शेंगदाणा', 'पिकावर'
}

HINDI_MARKERS = {
    'है', 'हैं', 'और', 'मेरा', 'मेरी', 'मेरे', 'किसान', 'तरीका',
    'करना', 'होगा', 'नहीं', 'गया', 'चावल', 'गेहूं', 'मूंगफली', 'फसल', 'उपज'
}

KASHMIRI_CHARS = {'ؚ', 'ٛ', 'ٚ', 'ٗ', 'ٙ', 'ۄ', 'ۅ', 'ۆ', 'ۇ', 'چوٗل', 'میٚن'}

def detect_language_and_script(text: str) -> tuple[str, str]:
    """
    Deterministic language and script classifier.
    Returns (ISO language code, Script Name).
    """
    if not isinstance(text, str) or not text.strip():
        return "und", "Unknown"
        
    script_counts = {
        'English': 0, 'Devanagari': 0, 'Tamil': 0, 'Telugu': 0,
        'Kannada': 0, 'Malayalam': 0, 'Bengali': 0, 'Gujarati': 0,
        'Punjabi': 0, 'Odia': 0, 'Perso-Arabic': 0
    }
    
    for c in text:
        name = unicodedata.name(c, '')
        if 'DEVANAGARI' in name:
            script_counts['Devanagari'] += 1
        elif 'TAMIL' in name:
            script_counts['Tamil'] += 1
        elif 'TELUGU' in name:
            script_counts['Telugu'] += 1
        elif 'KANNADA' in name:
            script_counts['Kannada'] += 1
        elif 'MALAYALAM' in name:
            script_counts['Malayalam'] += 1
        elif 'BENGALI' in name:
            script_counts['Bengali'] += 1
        elif 'GUJARATI' in name:
            script_counts['Gujarati'] += 1
        elif 'GURMUKHI' in name:
            script_counts['Punjabi'] += 1
        elif 'ORIYA' in name or 'ODIA' in name:
            script_counts['Odia'] += 1
        elif 'ARABIC' in name:
            script_counts['Perso-Arabic'] += 1
        elif 'LATIN' in name:
            script_counts['English'] += 1
            
    sorted_s = sorted(script_counts.items(), key=lambda x: x[1], reverse=True)
    top_script, top_cnt = sorted_s[0]
    
    if top_cnt == 0:
        return "und", "Unknown"
        
    # Handle cases where bracket headers had slightly more Latin chars than very short Indic body
    indic_items = [(k, v) for k, v in sorted_s if k != 'English' and v > 10]
    if top_script == 'English' and indic_items and indic_items[0][1] > 15:
        top_script = indic_items[0][0]

    if top_script == 'Tamil':
        return "ta", "Tamil"
    elif top_script == 'Telugu':
        return "te", "Telugu"
    elif top_script == 'Kannada':
        return "kn", "Kannada"
    elif top_script == 'Malayalam':
        return "ml", "Malayalam"
    elif top_script == 'Gujarati':
        return "gu", "Gujarati"
    elif top_script == 'Punjabi':
        return "pa", "Gurmukhi"
    elif top_script == 'Odia':
        return "or", "Odia"
    elif top_script == 'Devanagari':
        m_cnt = sum(1 for w in MARATHI_MARKERS if w in text)
        h_cnt = sum(1 for w in HINDI_MARKERS if w in text)
        if m_cnt > h_cnt:
            return "mr", "Devanagari"
        return "hi", "Devanagari"
    elif top_script == 'Bengali':
        if 'ৰ' in text or 'ৱ' in text:
            return "as", "Bengali"
        return "bn", "Bengali"
    elif top_script == 'Perso-Arabic':
        if any(c in text for c in KASHMIRI_CHARS):
            return "ks", "Perso-Arabic"
        return "ur", "Perso-Arabic"
    elif top_script == 'English':
        return "en", "Latin"
        
    return "und", "Unknown"

# ==============================================================================
# MAIN PREPROCESSING PIPELINE
# ==============================================================================

def run_preprocessing_pipeline():
    print("=" * 80)
    print("STARTING AGROCYCLE NON-DESTRUCTIVE DATASET PREPROCESSING PIPELINE")
    print("=" * 80)

    # 1. Verify Raw CSV Existence & Immutability Check
    if not os.path.exists(RAW_CSV_PATH):
        raise FileNotFoundError(f"Raw CSV not found at: {RAW_CSV_PATH}")

    initial_raw_md5 = compute_file_md5(RAW_CSV_PATH)
    raw_size_bytes = os.path.getsize(RAW_CSV_PATH)
    print(f"[*] Ingesting: {RAW_CSV_PATH}")
    print(f"[*] Raw File Size: {raw_size_bytes:,} bytes | MD5: {initial_raw_md5}")

    df_raw = pd.read_csv(RAW_CSV_PATH)
    total_raw_rows = len(df_raw)
    assert total_raw_rows == 718, f"Expected 718 rows in raw CSV, found {total_raw_rows}"
    print(f"[+] Loaded {total_raw_rows} raw records across {len(df_raw.columns)} columns.")

    os.makedirs(PROCESSED_DIR, exist_ok=True)

    processed_records = []
    
    # Tracking counters
    lang_counter = Counter()
    safety_counter = Counter()
    flags_counter = Counter()

    # 2. Iterate and process every record
    for source_row_id, raw_row in df_raw.iterrows():
        scenario_id = str(raw_row['id']).strip()
        crop_primary = str(raw_row['crop_primary']).strip().lower()
        category = str(raw_row['category']).strip().lower()
        farming_practice = str(raw_row['farming_practice']).strip().lower()
        growth_stage = str(raw_row['growth_stage']).strip().lower()
        irrigation_type = str(raw_row['irrigation_type']).strip().lower()
        region = str(raw_row['region']).strip().lower()
        original_season = str(raw_row['season']).strip().lower()
        severity = str(raw_row['severity']).strip().lower()
        soil_type = str(raw_row['soil_type']).strip().lower()
        source_type = str(raw_row['source_type']).strip().lower()
        
        raw_question = str(raw_row['question'])
        raw_answer = str(raw_row['answer'])
        
        # Clean text
        cleaned_question, had_bracket = clean_question_text(raw_question)
        normalized_answer = normalize_text(raw_answer)

        # Detect Language & Script
        q_lang, q_script = detect_language_and_script(cleaned_question if cleaned_question else raw_question)
        a_lang, a_script = detect_language_and_script(normalized_answer)
        
        assigned_lang = a_lang if a_lang != 'und' else q_lang
        assigned_script = a_script if a_script != 'Unknown' else q_script
        lang_counter[assigned_lang] += 1

        # Quality & Safety Flagging
        quality_flags = []
        risk_reasons = []
        safety_status = "LOW_RISK"
        verification_required = False

        if had_bracket:
            quality_flags.append("SYNTHETIC_HEADER_STRIPPED")

        # Check QA language mismatch
        if q_lang != a_lang and q_lang != 'und' and a_lang != 'und':
            quality_flags.append("QA_LANGUAGE_MISMATCH")
            risk_reasons.append(f"Question language ({q_lang}) differs from Answer language ({a_lang})")
            verification_required = True

        # Check Policy Hallucination (Tea MSP)
        if scenario_id in EXCLUDED_SCENARIOS_FROM_SFT:
            quality_flags.append("POLICY_HALLUCINATION_TEA_MSP")
            risk_reasons.append("Tea is a plantation crop not covered by the Central Government MSP regime")
            verification_required = True

        # Check High-Hazard Agrochemicals
        answer_lower = normalized_answer.lower()
        found_chemicals = [ch for ch in RESTRICTED_AGROCHEMICALS if ch in answer_lower]
        if found_chemicals:
            safety_status = "RESTRICTED_AGROCHEMICAL"
            verification_required = True
            chemical_str = ", ".join(found_chemicals)
            quality_flags.append(f"RESTRICTED_CHEMICAL_{found_chemicals[0].upper()}")
            risk_reasons.append(f"Advisory recommends restricted/monitored agrochemical(s): {chemical_str}")
            safety_counter[safety_status] += 1
        else:
            safety_counter["LOW_RISK"] += 1

        # Check Time-Sensitive Financial Claims
        combined_text = (cleaned_question + " " + normalized_answer).lower()
        if any(kw in combined_text for kw in TIME_SENSITIVE_KEYWORDS):
            quality_flags.append("TIME_SENSITIVE_FINANCIAL_DATA")
            risk_reasons.append("Contains historical MSP rates, direct subsidy values, or emergency helplines")
            verification_required = True

        # Season Verification Handling
        if crop_primary in RABI_CROPS:
            verified_season = "rabi"
            season_verification_status = "needs_external_verification"
            quality_flags.append("SEASON_MISMATCH_RABI_AS_KHARIF")
            risk_reasons.append(f"Crop {crop_primary} is predominantly a Rabi crop in India; raw data labeled as kharif")
            verification_required = True
        elif crop_primary in PERENNIAL_CROPS:
            verified_season = "perennial"
            season_verification_status = "perennial_crop"
        else:
            verified_season = original_season
            season_verification_status = "aligned_kharif"

        # SFT and Eval Eligibility Determination
        is_sft_eligible = True
        if (scenario_id in EXCLUDED_SCENARIOS_FROM_SFT or
            source_row_id in EXCLUDED_SOURCE_ROWS_FROM_SFT or
            "QA_LANGUAGE_MISMATCH" in quality_flags or
            "POLICY_HALLUCINATION_TEA_MSP" in quality_flags):
            is_sft_eligible = False

        is_eval_eligible = True  # All 718 records are preserved for evaluation

        for f in quality_flags:
            flags_counter[f] += 1

        risk_reason_str = "; ".join(risk_reasons) if risk_reasons else None

        record = {
            "source_row_id": int(source_row_id),
            "scenario_id": scenario_id,
            "language": assigned_lang,
            "script": assigned_script,
            "question": cleaned_question,
            "answer": normalized_answer,
            "original_question": raw_question,
            "crop_primary": crop_primary,
            "category": category,
            "farming_practice": farming_practice,
            "growth_stage": growth_stage,
            "irrigation_type": irrigation_type,
            "region": region,
            "original_season": original_season,
            "verified_season": verified_season,
            "season_verification_status": season_verification_status,
            "severity": severity,
            "soil_type": soil_type,
            "source_type": source_type,
            "safety_status": safety_status,
            "verification_required": verification_required,
            "risk_reason": risk_reason_str,
            "quality_flags": quality_flags,
            "is_sft_eligible": is_sft_eligible,
            "is_eval_eligible": is_eval_eligible,
            "split": "unassigned",
            "source_dataset": "indian_agri_advisory_raw.csv"
        }
        processed_records.append(record)

    # 3. Deterministic Group-Aware Train / Validation / Test Splitting by scenario_id
    print("\n[*] Performing Group-Aware Stratified Scenario Splitting (70% Train / 15% Val / 15% Test)...")
    
    # Only split across SFT eligible scenarios
    sft_records = [r for r in processed_records if r['is_sft_eligible']]
    sft_scenarios = sorted(list(set(r['scenario_id'] for r in sft_records)))
    
    # Group scenarios by category for stratified sampling
    scenario_to_cat = {}
    for r in sft_records:
        scenario_to_cat[r['scenario_id']] = r['category']
        
    strata = defaultdict(list)
    for sid in sft_scenarios:
        strata[scenario_to_cat[sid]].append(sid)

    rng = random.Random(RANDOM_SEED)
    train_scenarios = set()
    val_scenarios = set()
    test_scenarios = set()

    for cat, sids in sorted(strata.items()):
        sids_sorted = sorted(sids)
        rng.shuffle(sids_sorted)
        n = len(sids_sorted)
        
        n_val = max(1, round(n * 0.15))
        n_test = max(1, round(n * 0.15))
        n_train = n - n_val - n_test
        
        if n_train < 1:
            n_train = n - n_val
            n_test = 0
            
        val_set = set(sids_sorted[:n_val])
        test_set = set(sids_sorted[n_val:n_val + n_test])
        train_set = set(sids_sorted[n_val + n_test:])
        
        val_scenarios.update(val_set)
        test_scenarios.update(test_set)
        train_scenarios.update(train_set)

    # Assign split to records
    for r in processed_records:
        sid = r['scenario_id']
        if not r['is_sft_eligible']:
            r['split'] = 'excluded'
        elif sid in train_scenarios:
            r['split'] = 'train'
        elif sid in val_scenarios:
            r['split'] = 'validation'
        elif sid in test_scenarios:
            r['split'] = 'test'

    # 4. Generate Target JSONL Files
    print("\n[*] Exporting JSONL Dataset Views...")

    # A. Clean All (718 records)
    with open(OUTPUT_CLEAN_ALL, 'w', encoding='utf-8') as f:
        for r in processed_records:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f"  [✓] Exported: {OUTPUT_CLEAN_ALL} ({len(processed_records)} records)")

    # B. SFT (704 records)
    sft_rows = [r for r in processed_records if r['is_sft_eligible']]
    with open(OUTPUT_SFT, 'w', encoding='utf-8') as f:
        for r in sft_rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f"  [✓] Exported: {OUTPUT_SFT} ({len(sft_rows)} records)")

    # C. Evaluation (718 records)
    eval_rows = [r for r in processed_records if r['is_eval_eligible']]
    with open(OUTPUT_EVAL, 'w', encoding='utf-8') as f:
        for r in eval_rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f"  [✓] Exported: {OUTPUT_EVAL} ({len(eval_rows)} records)")

    # D. Review Dataset (Excluded records + flagged records)
    review_rows = [r for r in processed_records if r['verification_required'] or not r['is_sft_eligible']]
    with open(OUTPUT_REVIEW, 'w', encoding='utf-8') as f:
        for r in review_rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f"  [✓] Exported: {OUTPUT_REVIEW} ({len(review_rows)} records)")

    # E. Split Train
    train_rows = [r for r in processed_records if r['split'] == 'train']
    with open(OUTPUT_SPLIT_TRAIN, 'w', encoding='utf-8') as f:
        for r in train_rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f"  [✓] Exported: {OUTPUT_SPLIT_TRAIN} ({len(train_rows)} records | {len(train_scenarios)} scenarios)")

    # F. Split Validation
    val_rows = [r for r in processed_records if r['split'] == 'validation']
    with open(OUTPUT_SPLIT_VAL, 'w', encoding='utf-8') as f:
        for r in val_rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f"  [✓] Exported: {OUTPUT_SPLIT_VAL} ({len(val_rows)} records | {len(val_scenarios)} scenarios)")

    # G. Split Test
    test_rows = [r for r in processed_records if r['split'] == 'test']
    with open(OUTPUT_SPLIT_TEST, 'w', encoding='utf-8') as f:
        for r in test_rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f"  [✓] Exported: {OUTPUT_SPLIT_TEST} ({len(test_rows)} records | {len(test_scenarios)} scenarios)")

    # 5. Validation Checks & Assertions
    print("\n" + "=" * 80)
    print("RUNNING STRICT VALIDATION CHECKS & INTEGRITY AUDIT")
    print("=" * 80)

    # Check 1: Total processed rows
    assert len(processed_records) == 718, f"Mismatch: {len(processed_records)} != 718"
    print("[PASS] Validation 1: Processed exactly 718 records.")

    # Check 2: Raw file immutability check
    final_raw_md5 = compute_file_md5(RAW_CSV_PATH)
    assert initial_raw_md5 == final_raw_md5, "CRITICAL ERROR: Raw CSV file was modified during processing!"
    print(f"[PASS] Validation 2: Raw CSV is 100% unchanged (MD5: {final_raw_md5}).")

    # Check 3: Unique source_row_id check
    row_ids = [r['source_row_id'] for r in processed_records]
    assert len(row_ids) == len(set(row_ids)) == 718, "Duplicate source_row_id detected!"
    print("[PASS] Validation 3: All 718 source_row_id values are completely unique and traceable (0..717).")

    # Check 4: Zero scenario leakage across splits
    assert len(train_scenarios.intersection(val_scenarios)) == 0, "Leakage between train and val!"
    assert len(train_scenarios.intersection(test_scenarios)) == 0, "Leakage between train and test!"
    assert len(val_scenarios.intersection(test_scenarios)) == 0, "Leakage between val and test!"
    print("[PASS] Validation 4: Zero scenario leakage verified across train/val/test splits.")

    # Check 5: SFT Exclusions verified
    excluded_rows = [r for r in processed_records if not r['is_sft_eligible']]
    assert len(excluded_rows) == 14, f"Expected 14 excluded rows from SFT, found {len(excluded_rows)}"
    assert len(sft_rows) == 704, f"Expected 704 SFT rows, found {len(sft_rows)}"
    print("[PASS] Validation 5: Exactly 14 problematic rows excluded from SFT (in-agri-0019 (8), in-agri-0020 (4), row 441 (1), row 376 (1)).")

    # Check 6: All splits sum up to SFT total
    assert len(train_rows) + len(val_rows) + len(test_rows) == 704, "Split row sum mismatch!"
    print(f"[PASS] Validation 6: Train ({len(train_rows)}) + Val ({len(val_rows)}) + Test ({len(test_rows)}) = {len(sft_rows)} SFT rows.")

    # 6. Comprehensive Metrics Summary
    print("\n" + "=" * 80)
    print("FINAL DATASET PREPROCESSING METRICS REPORT")
    print("=" * 80)
    print(f"Total Processed Records       : {len(processed_records)}")
    print(f"SFT Training Eligible Records : {len(sft_rows)}")
    print(f"Evaluation Records            : {len(eval_rows)}")
    print(f"Review / Verification Records : {len(review_rows)}")
    print(f"Excluded from SFT             : {len(excluded_rows)}")
    print("-" * 80)
    print(f"Train Records                 : {len(train_rows)} ({len(train_scenarios)} scenarios)")
    print(f"Validation Records            : {len(val_rows)} ({len(val_scenarios)} scenarios)")
    print(f"Test Records                  : {len(test_rows)} ({len(test_scenarios)} scenarios)")
    print("-" * 80)
    print("Language Distribution:")
    for lang, cnt in lang_counter.most_common():
        print(f"  {lang:5s}: {cnt:3d} records ({cnt/len(processed_records)*100:5.2f}%)")
    print("-" * 80)
    print("Safety & Quality Flag Counts:")
    for flag, cnt in flags_counter.most_common():
        print(f"  {flag:35s}: {cnt:3d}")
    print("=" * 80)
    print("[SUCCESS] Preprocessing completed successfully without errors.\n")

if __name__ == '__main__':
    run_preprocessing_pipeline()
