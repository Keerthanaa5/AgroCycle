#!/usr/bin/env python3
"""
================================================================================
AGROCYCLE QLORA DATA COLLATOR: ASSISTANT-ONLY LOSS MASKING
================================================================================
File: ai/src/training/qlora_data_collator.py
Model: Qwen/Qwen2.5-7B-Instruct
Template: ChatML (<|im_start|>system...<|im_end|><|im_start|>user...<|im_end|><|im_start|>assistant...<|im_end|>)

Masking Protocol:
1. System Prompt & Headers : label = -100 (ignored in loss computation)
2. User Question & Headers : label = -100 (ignored in loss computation)
3. Assistant Start Header  : label = -100 (ignored in loss computation)
4. Assistant Response Body : label = token_id (actively receives loss gradient)
5. Assistant EOS (<|im_end|>): label = token_id (learns stop condition)
6. Padding Tokens          : label = -100, attention_mask = 0
================================================================================
"""

import os
import sys
import json
from typing import List, Dict, Any, Union, Optional

DEFAULT_SYSTEM_PROMPT = "You are AgroCycle, a helpful multilingual AI agricultural assistant."

# Special Token IDs for Qwen2.5 (Vocabulary size: 152,064)
QWEN_IM_START_TOKEN = "<|im_start|>"
QWEN_IM_END_TOKEN = "<|im_end|>"
QWEN_PAD_TOKEN = "<|endoftext|>"


class AgroCycleTokenizerHelper:
    """
    Lightweight tokenizer helper and ChatML formatter for Qwen2.5.
    Works with official HuggingFace transformers AutoTokenizer or standalone mode.
    """
    def __init__(self, tokenizer=None, model_id: str = "Qwen/Qwen2.5-7B-Instruct"):
        self.tokenizer = tokenizer
        self.model_id = model_id
        if self.tokenizer is None:
            self._try_load_tokenizer()

    def _try_load_tokenizer(self):
        try:
            from transformers import AutoTokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id, trust_remote_code=True)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token or "<|endoftext|>"
        except Exception:
            self.tokenizer = None

    def format_chatml(self, user_question: str, assistant_response: Optional[str] = None, system_prompt: str = DEFAULT_SYSTEM_PROMPT) -> Dict[str, str]:
        """
        Formats conversation turns into official Qwen2.5 ChatML format.
        """
        prompt_prefix = (
            f"<|im_start|>system\n{system_prompt}<|im_end|>\n"
            f"<|im_start|>user\n{user_question}<|im_end|>\n"
            f"<|im_start|>assistant\n"
        )
        if assistant_response is not None:
            full_text = f"{prompt_prefix}{assistant_response}<|im_end|>\n"
        else:
            full_text = prompt_prefix
        
        return {
            "prompt_text": prompt_prefix,
            "assistant_text": assistant_response if assistant_response else "",
            "full_text": full_text
        }


class AgroCycleDataCollator:
    """
    Custom Data Collator for QLoRA SFT on Qwen2.5-7B-Instruct.
    Applies strict assistant-only loss masking by setting labels=-100 for all
    system and user tokens, while preserving labels for assistant response tokens
    and the trailing <|im_end|> token.
    """
    def __init__(
        self,
        tokenizer=None,
        max_seq_length: int = 2048,
        pad_to_multiple_of: Optional[int] = 8,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        model_id: str = "Qwen/Qwen2.5-7B-Instruct"
    ):
        self.tokenizer = tokenizer
        self.max_seq_length = max_seq_length
        self.pad_to_multiple_of = pad_to_multiple_of
        self.system_prompt = system_prompt
        self.helper = AgroCycleTokenizerHelper(tokenizer=tokenizer, model_id=model_id)

    def process_sample(self, question: str, answer: str) -> Dict[str, Any]:
        """
        Processes a single question-answer pair into input_ids, attention_mask, and labels.
        Labels for all tokens before the assistant response are set to -100.
        """
        chat = self.helper.format_chatml(question, answer, self.system_prompt)
        prompt_text = chat["prompt_text"]
        full_text = chat["full_text"]

        if self.helper.tokenizer is not None:
            # HuggingFace Tokenizer path
            prompt_tokens = self.helper.tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
            full_tokens = self.helper.tokenizer(full_text, add_special_tokens=False)["input_ids"]
            
            # Truncate if exceeds max_seq_length
            if len(full_tokens) > self.max_seq_length:
                full_tokens = full_tokens[:self.max_seq_length]
            
            prompt_len = min(len(prompt_tokens), len(full_tokens))
            
            # Construct labels with -100 masking on prompt
            labels = [-100] * prompt_len + full_tokens[prompt_len:]
            attention_mask = [1] * len(full_tokens)
            
            return {
                "input_ids": full_tokens,
                "attention_mask": attention_mask,
                "labels": labels,
                "prompt_token_count": prompt_len,
                "assistant_token_count": len(full_tokens) - prompt_len,
                "total_token_count": len(full_tokens)
            }
        else:
            # Standalone Character-level / Subword simulation path for environments without transformers
            # Maps tokens cleanly for verification and pipeline validation
            import re
            # Approximate BPE tokenization
            def pseudo_tokenize(text: str) -> List[int]:
                # Deterministic hash token mapping for dry-run testing
                tokens = []
                parts = re.findall(r'<\|im_start\|>|<\|im_end\|>|\w+|[^\w\s]|\s+', text)
                for p in parts:
                    tokens.append(abs(hash(p)) % 150000 + 100)
                return tokens

            prompt_tokens = pseudo_tokenize(prompt_text)
            full_tokens = pseudo_tokenize(full_text)
            
            if len(full_tokens) > self.max_seq_length:
                full_tokens = full_tokens[:self.max_seq_length]
                
            prompt_len = min(len(prompt_tokens), len(full_tokens))
            labels = [-100] * prompt_len + full_tokens[prompt_len:]
            attention_mask = [1] * len(full_tokens)
            
            return {
                "input_ids": full_tokens,
                "attention_mask": attention_mask,
                "labels": labels,
                "prompt_token_count": prompt_len,
                "assistant_token_count": len(full_tokens) - prompt_len,
                "total_token_count": len(full_tokens)
            }

    def __call__(self, batch: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Collate a batch of samples, pad to the maximum sequence length in the batch,
        and set padding labels to -100.
        """
        processed_samples = []
        for sample in batch:
            if "question" in sample and "answer" in sample:
                q = sample["question"]
                a = sample["answer"]
            elif "messages" in sample:
                messages = sample["messages"]
                q = next((m["content"] for m in messages if m["role"] == "user"), "")
                a = next((m["content"] for m in messages if m["role"] == "assistant"), "")
            else:
                raise ValueError(f"Sample missing question/answer or messages: {list(sample.keys())}")
            
            processed_samples.append(self.process_sample(q, a))

        max_len = max(len(s["input_ids"]) for s in processed_samples)
        if self.pad_to_multiple_of is not None and max_len % self.pad_to_multiple_of != 0:
            max_len = ((max_len // self.pad_to_multiple_of) + 1) * self.pad_to_multiple_of

        pad_token_id = 0
        if self.helper.tokenizer is not None and self.helper.tokenizer.pad_token_id is not None:
            pad_token_id = self.helper.tokenizer.pad_token_id

        batch_input_ids = []
        batch_attention_mask = []
        batch_labels = []

        for s in processed_samples:
            cur_len = len(s["input_ids"])
            pad_len = max_len - cur_len
            
            input_ids = s["input_ids"] + [pad_token_id] * pad_len
            attention_mask = s["attention_mask"] + [0] * pad_len
            labels = s["labels"] + [-100] * pad_len

            batch_input_ids.append(input_ids)
            batch_attention_mask.append(attention_mask)
            batch_labels.append(labels)

        try:
            import torch
            return {
                "input_ids": torch.tensor(batch_input_ids, dtype=torch.long),
                "attention_mask": torch.tensor(batch_attention_mask, dtype=torch.long),
                "labels": torch.tensor(batch_labels, dtype=torch.long),
            }
        except ImportError:
            return {
                "input_ids": batch_input_ids,
                "attention_mask": batch_attention_mask,
                "labels": batch_labels,
            }


if __name__ == "__main__":
    # Self-test collator on representative multilingual samples
    print("[*] Testing AgroCycleDataCollator on English, Tamil, Hindi, and Telugu...")
    collator = AgroCycleDataCollator()
    
    samples = [
        {
            "language": "en",
            "question": "What is the recommended fertilizer dosage for cotton in black soil?",
            "answer": "1. Situation Assessment: Black soil cotton. 2. Immediate Action: Apply NPK 80:40:40."
        },
        {
            "language": "ta",
            "question": "பருத்தி பயிரில் பூச்சி தாக்குதலை எவ்வாறு கட்டுப்படுத்துவது?",
            "answer": "1. சூழல் மதிப்பீடு: பருத்தி சாகுபடி. 2. உடனடி நடவடிக்கை: வேப்ப எண்ணெய் தெளிக்கவும்."
        },
        {
            "language": "hi",
            "question": "धान की फसल में खरपतवार नियंत्रण के लिए क्या उपाय करें?",
            "answer": "1. स्थिति विश्लेषण: धान की खेती. 2. त्वरित कार्रवाई: ब्यूटाक्लोर का छिड़काव करें।"
        },
        {
            "language": "te",
            "question": "వరి పంటలో తెగుళ్ల నివారణకు ఎలాంటి చర్యలు తీసుకోవాలి?",
            "answer": "1. పరిస్థితి అంచనా: వరి పంట. 2. తక్షణ చర్య: ట్రైసైక్లాజోల్ పిచికారీ చేయండి."
        }
    ]
    
    batch = collator(samples)
    print("[+] Batch collation successful!")
    print(f"[*] Batch size: {len(batch['input_ids'])}")
    print(f"[*] Input shape: {len(batch['input_ids'])} x {len(batch['input_ids'][0])}")
    
    for i, s in enumerate(samples):
        labels = batch["labels"][i]
        masked_count = sum(1 for x in labels if x == -100)
        active_count = sum(1 for x in labels if x != -100)
        print(f" - Sample {i+1} ({s['language']}): Total={len(labels)}, Masked(-100)={masked_count}, Active Loss Tokens={active_count}")
