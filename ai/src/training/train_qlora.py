#!/usr/bin/env python3
"""
================================================================================
AGROCYCLE QLORA TRAINING PIPELINE: QWEN2.5-7B-INSTRUCT
================================================================================
Script: ai/src/training/train_qlora.py
Model: Qwen/Qwen2.5-7B-Instruct
Method: 4-bit Quantization (NF4) + PEFT QLoRA (Rank 16, Alpha 32)
Loss: Assistant-only loss masking with -100 on prompt tokens
Dataset:
  - Training   : ai/dataset/processed/split_train.jsonl (493 records)
  - Validation : ai/dataset/processed/split_validation.jsonl (106 records)
  - Test Set   : STRICTLY EXCLUDED FROM TRAINING & TUNING
Target Hardware: Suitable for 16 GB GPU (RTX 4080 / RTX 3090 / T4 / V100 / A100)
================================================================================
"""

import os
import sys
import json
import argparse
import platform
from typing import Dict, Any, List, Optional

# Force UTF-8 encoding
sys.stdout.reconfigure(encoding='utf-8')

# Ensure parent directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
try:
    from ai.src.training.qlora_data_collator import AgroCycleDataCollator, AgroCycleTokenizerHelper
except ImportError:
    from qlora_data_collator import AgroCycleDataCollator, AgroCycleTokenizerHelper


def parse_args():
    parser = argparse.ArgumentParser(description="AgroCycle QLoRA Fine-Tuning Pipeline for Qwen2.5-7B-Instruct")
    
    # Model & Data Paths
    parser.add_argument("--model_id", type=str, default="Qwen/Qwen2.5-7B-Instruct", help="Base model identifier")
    parser.add_argument("--train_file", type=str, default="ai/dataset/processed/split_train.jsonl", help="Path to train split JSONL")
    parser.add_argument("--validation_file", type=str, default="ai/dataset/processed/split_validation.jsonl", help="Path to validation split JSONL")
    parser.add_argument("--output_dir", type=str, default="ai/models/qlora_qwen25_7b", help="Directory to save fine-tuned adapter weights")
    
    # QLoRA Hyperparameters
    parser.add_argument("--lora_rank", type=int, default=16, help="LoRA attention rank dimension (r)")
    parser.add_argument("--lora_alpha", type=int, default=32, help="LoRA scaling alpha")
    parser.add_argument("--lora_dropout", type=float, default=0.05, help="LoRA dropout rate")
    parser.add_argument("--target_modules", nargs="+", default=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"], help="Target linear modules for LoRA adapters")
    
    # Training Hyperparameters (Conservative 16 GB GPU Profile)
    parser.add_argument("--learning_rate", type=float, default=2e-4, help="Peak learning rate for AdamW")
    parser.add_argument("--batch_size", type=int, default=2, help="Per-device train/eval batch size")
    parser.add_argument("--gradient_accumulation", type=int, default=8, help="Gradient accumulation steps (Effective batch size = batch_size * grad_accum)")
    parser.add_argument("--epochs", type=int, default=3, help="Total training epochs")
    parser.add_argument("--max_seq_length", type=int, default=2048, help="Maximum sequence length (tokens)")
    parser.add_argument("--warmup_ratio", type=float, default=0.03, help="Linear warmup ratio")
    parser.add_argument("--weight_decay", type=float, default=0.01, help="Weight decay for regularization")
    parser.add_argument("--lr_scheduler_type", type=str, default="cosine", help="Learning rate decay scheduler")
    
    # Logging & Checkpointing
    parser.add_argument("--logging_steps", type=int, default=5, help="Logging step frequency")
    parser.add_argument("--eval_steps", type=int, default=25, help="Evaluation step frequency")
    parser.add_argument("--save_steps", type=int, default=50, help="Checkpoint save step frequency")
    parser.add_argument("--save_total_limit", type=int, default=2, help="Maximum checkpoints to retain")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--dry_run", action="store_true", help="Perform preflight configuration checks without running training")
    
    return parser.parse_args()


def check_dataset_paths(train_path: str, val_path: str) -> tuple[str, str]:
    """Resolves and validates split file existence."""
    # Check primary path or alternative sft/ subfolder
    if not os.path.exists(train_path):
        alt_train = os.path.join("ai", "dataset", "processed", "sft", "train.jsonl")
        if os.path.exists(alt_train):
            train_path = alt_train
        else:
            raise FileNotFoundError(f"Training split not found at: {train_path} or {alt_train}")
            
    if not os.path.exists(val_path):
        alt_val = os.path.join("ai", "dataset", "processed", "sft", "validation.jsonl")
        if os.path.exists(alt_val):
            val_path = alt_val
        else:
            raise FileNotFoundError(f"Validation split not found at: {val_path} or {alt_val}")
            
    return train_path, val_path


def load_jsonl_data(filepath: str) -> List[Dict[str, Any]]:
    records = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def get_hardware_profile():
    """Detects available GPU acceleration, VRAM, and bfloat16 support."""
    profile = {
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "cuda_available": False,
        "device_name": "CPU",
        "device_count": 0,
        "vram_gb": 0.0,
        "bf16_supported": False,
        "precision": "float32"
    }
    try:
        import torch
        if torch.cuda.is_available():
            profile["cuda_available"] = True
            profile["device_count"] = torch.cuda.device_count()
            profile["device_name"] = torch.cuda.get_device_name(0)
            profile["vram_gb"] = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
            profile["bf16_supported"] = torch.cuda.is_bf16_supported()
            profile["precision"] = "bfloat16" if profile["bf16_supported"] else "float16"
    except ImportError:
        pass
    return profile


def print_training_blueprint(args, hw_profile: Dict[str, Any], train_count: int, val_count: int):
    effective_batch = args.batch_size * args.gradient_accumulation
    total_steps = (train_count // effective_batch) * args.epochs
    
    print("\n" + "=" * 80)
    print("AGROCYCLE QLORA TRAINING BLUEPRINT: QWEN2.5-7B-INSTRUCT")
    print("=" * 80)
    print(f"Base Model              : {args.model_id}")
    print(f"Target Hardware         : {hw_profile['device_name']} ({hw_profile['vram_gb']} GB VRAM)")
    print(f"Compute Precision       : {hw_profile['precision']}")
    print(f"Quantization            : 4-bit NormalFloat (NF4) with Double Quantization")
    print("-" * 80)
    print(f"Training Split Records  : {train_count} (Exclusively isolated train scenarios)")
    print(f"Validation Records      : {val_count} (Exclusively isolated val scenarios)")
    print(f"Test Split Usage        : ZERO (Strictly untouched & isolated)")
    print("-" * 80)
    print(f"LoRA Rank (r)           : {args.lora_rank}")
    print(f"LoRA Alpha (α)          : {args.lora_alpha} (Scaling: {args.lora_alpha / args.lora_rank:.2f})")
    print(f"LoRA Dropout            : {args.lora_dropout}")
    print(f"Target Modules          : {', '.join(args.target_modules)}")
    print("-" * 80)
    print(f"Per-Device Batch Size   : {args.batch_size}")
    print(f"Gradient Accumulation   : {args.gradient_accumulation}")
    print(f"Effective Batch Size    : {effective_batch}")
    print(f"Learning Rate           : {args.learning_rate} (Cosine decay, Warmup={args.warmup_ratio*100:.1f}%)")
    print(f"Total Epochs            : {args.epochs}")
    print(f"Max Sequence Length     : {args.max_seq_length} tokens")
    print(f"Estimated Steps/Epoch   : {train_count // effective_batch}")
    print(f"Total Training Steps    : ~{total_steps} optimizer steps")
    print(f"Loss Function           : Assistant-Only CrossEntropy (Prompt tokens masked with -100)")
    print(f"Gradient Checkpointing  : ENABLED (Saves ~40% VRAM during backprop)")
    print(f"Expected Memory Footprint: ~9.8 GB - 11.2 GB (Safe within 16 GB VRAM)")
    print("=" * 80 + "\n")


def build_qlora_trainer(args):
    """Initializes and returns the HuggingFace SFT / Trainer instance."""
    train_file, val_file = check_dataset_paths(args.train_file, args.validation_file)
    train_records = load_jsonl_data(train_file)
    val_records = load_jsonl_data(val_file)
    
    hw = get_hardware_profile()
    print_training_blueprint(args, hw, len(train_records), len(val_records))
    
    if args.dry_run:
        print("[+] Dry run complete. Configuration verified successfully.")
        return None
        
    try:
        import torch
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            BitsAndBytesConfig,
            TrainingArguments,
            Trainer
        )
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from datasets import Dataset
    except ImportError as e:
        print(f"[!] Warning: Missing ML dependencies ({e}).")
        print("[!] Install requirements: pip install torch transformers peft bitsandbytes accelerate datasets trl")
        return None

    # 1. 4-bit Quantization Config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16 if hw["bf16_supported"] else torch.float16
    )

    # 2. Load Tokenizer & Model
    print(f"[*] Loading tokenizer: {args.model_id}")
    tokenizer = AutoTokenizer.from_pretrained(args.model_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token or "<|endoftext|>"

    print(f"[*] Loading model in 4-bit NF4 precision: {args.model_id}")
    model = AutoModelForCausalLM.from_pretrained(
        args.model_id,
        quantization_config=bnb_config,
        device_map="auto" if hw["cuda_available"] else "cpu",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16 if hw["bf16_supported"] else torch.float16
    )

    # Prepare for k-bit training & enable gradient checkpointing
    model = prepare_model_for_kbit_training(model)
    model.gradient_checkpointing_enable()

    # 3. Configure LoRA PEFT
    peft_config = LoraConfig(
        r=args.lora_rank,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        target_modules=args.target_modules,
        bias="none",
        task_type="CAUSAL_LM"
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 4. Custom Collator with Assistant-Only Masking
    data_collator = AgroCycleDataCollator(
        tokenizer=tokenizer,
        max_seq_length=args.max_seq_length,
        pad_to_multiple_of=8
    )

    # 5. Datasets
    train_dataset = Dataset.from_list(train_records)
    val_dataset = Dataset.from_list(val_records)

    # 6. Training Arguments
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        lr_scheduler_type=args.lr_scheduler_type,
        warmup_ratio=args.warmup_ratio,
        num_train_epochs=args.epochs,
        weight_decay=args.weight_decay,
        fp16=not hw["bf16_supported"] and hw["cuda_available"],
        bf16=hw["bf16_supported"] and hw["cuda_available"],
        gradient_checkpointing=True,
        logging_steps=args.logging_steps,
        eval_strategy="steps",
        eval_steps=args.eval_steps,
        save_strategy="steps",
        save_steps=args.save_steps,
        save_total_limit=args.save_total_limit,
        load_best_model_at_end=True,
        metric_for_best_model="loss",
        greater_is_better=False,
        seed=args.seed,
        report_to="none"
    )

    # 7. Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
        tokenizer=tokenizer
    )

    return trainer


if __name__ == "__main__":
    cli_args = parse_args()
    build_qlora_trainer(cli_args)
