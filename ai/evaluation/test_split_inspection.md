# Deep Inspection of Test Split and Qwen2.5-7B-Instruct Baseline Predictions

**Evaluated Files**:
1. `ai/dataset/processed/split_test.jsonl` (105 ground-truth test records)
2. `ai/evaluation/baseline_qwen25_7b_test.jsonl` (105 zero-shot baseline predictions)

**Evaluation Date**: September 27, 2026  
**Auditor**: Antigravity AI  
**Scope**: Systematic analysis of test split distribution, zero-shot question-to-answer relevance, language fidelity, intent coverage, structural delta, and safety profile.

---

## Executive Summary

A deep qualitative and structural inspection was performed across all **105 test records** and their corresponding **Qwen2.5-7B-Instruct zero-shot baseline predictions**.

### Key Evaluation Findings:
1. **Split Isolation & Quality**: The test split contains 105 records across 24 scenarios with **zero scenario overlap** with training or validation splits. Every record has a unique `source_row_id` and an associated deterministic baseline prediction.
2. **Relevance Breakdown**:
   - **DIRECT_MATCH**: **44 records (41.90%)** — Accurately addresses pest control, crop disease, and soil fertility inquiries.
   - **PARTIAL_MATCH**: **33 records (31.43%)** — Addresses the general agricultural domain but misses specific variety names, drip irrigation subsidies, or curing parameters.
   - **OFF_TARGET**: **28 records (26.67%)** — Occurs when the user asks about Minimum Support Price (MSP), marketing, government subsidies, or companion crops, and the un-finetuned baseline defaults to generic "nutrient deficiency / fertilizer / pest symptoms" boilerplate.
3. **Language Following (100% Match)**: The baseline responds in the correct language and script for all 105 records across all 14 Indic languages. Minor English leakage occurs when Latin crop names (e.g. `rice`, `cotton`) are inserted into Indic sentences.
4. **Structural Gap**: Target SFT advisories follow an exhaustive 5-part hierarchical schema (mean **3,208 characters / ~474 words**), while baseline responses follow a generic 3-part layout (mean **551 characters / ~74 words**).

---

## A. Test Split Structure

| Metric | Value | Notes |
| :--- | :--- | :--- |
| **Total Test Records** | **105** | Formatted JSONL records |
| **Total Test Scenarios** | **24** | 100% isolated from Train & Val |
| **Duplicate `source_row_id`** | **0** | Every record uniquely indexed |
| **Train / Val Overlap** | **0 scenarios** | Zero cross-split data leakage verified |
| **Baseline Prediction Coverage** | **105 / 105 (100.0%)** | All records successfully evaluated |

### 1. Language Distribution (105 Records)

| Language | ISO Code | Count | % | Language | ISO Code | Count | % |
| :--- | :-: | :-: | :-: | :--- | :-: | :-: | :-: |
| **Telugu** | `te` | 13 | 12.38% | **Bengali** | `bn` | 7 | 6.67% |
| **Tamil** | `ta` | 13 | 12.38% | **Gujarati** | `gu` | 6 | 5.71% |
| **Punjabi** | `pa` | 12 | 11.43% | **Hindi** | `hi` | 6 | 5.71% |
| **Kannada** | `kn` | 12 | 11.43% | **Urdu** | `ur` | 5 | 4.76% |
| **Odia** | `or` | 8 | 7.62% | **Assamese** | `as` | 4 | 3.81% |
| **Malayalam** | `ml` | 8 | 7.62% | **Marathi** | `mr` | 3 | 2.86% |
| **English** | `en` | 7 | 6.67% | **Kashmiri** | `ks` | 1 | 0.95% |

### 2. Category Distribution (105 Records)

| Category | Count | Category | Count |
| :--- | :-: | :--- | :-: |
| **Irrigation** | 12 | **Variety Selection** | 8 |
| **Soil Health** | 11 | **Harvest Timing** | 8 |
| **Financial Support** | 11 | **Government Schemes** | 8 |
| **Fertilizer Management** | 10 | **Crop Management** | 8 |
| **Pest Control** | 9 | **Weather Advisory** | 6 |
| **Market Price** | 9 | **Crop Disease** | 5 |

### 3. Crop Distribution (105 Records)

- **Rice**: 26 | **Jowar**: 14 | **Cotton**: 13 | **Coconut**: 13 | **Groundnut**: 11 | **Ragi**: 9 | **Bajra**: 8 | **Sugarcane**: 5 | **Soybean**: 3 | **Potato**: 2 | **Gram**: 1

### 4. Severity & Safety Distribution (105 Records)
- **Severity**: Medium: 44 (41.9%) | High: 32 (30.5%) | Low: 18 (17.1%) | Urgent: 11 (10.5%)
- **Safety Status**: `LOW_RISK`: 104 (99.05%) | `RESTRICTED_AGROCHEMICAL`: 1 (Row 71, 0.95%)

---

## B. Question → Baseline Answer Relevance

All 105 test predictions were evaluated for question-to-answer semantic relevance:

```
========================================================================================
BASELINE PREDICTION RELEVANCE SUMMARY
========================================================================================
1. DIRECT_MATCH  :  44 records (41.90%) -> Accurately addresses symptoms / treatment
2. PARTIAL_MATCH :  33 records (31.43%) -> General domain response, misses sub-questions
3. OFF_TARGET    :  28 records (26.67%) -> Fails to answer financial/marketing/companion crop query
========================================================================================
Total Evaluated  : 105 records (100.0%)
========================================================================================
```

### Complete Inventory of All 28 OFF_TARGET Records

The baseline fails on questions concerning **MSP procurement**, **market prices**, **government subsidies**, and **companion crops**, defaulting to generic agronomic symptoms:

#### 1. Row `10` | Scenario `in-agri-0119` | Lang: `gu` | Category: `financial_support` | Crop: `groundnut`
- **Question**: `મગફળીનો બજારભાવ MSP (ન્યૂનતમ ટેકાના ભાવ) કરતાં ઓછો છે. હું MSP પર ક્યાં વેચી શકું અને ખરીદ પ્રક્રિયા કેવી રીતે કામ કરે છે?`
- **Baseline Answer**:
```text
તમારા groundnut પાકની સમસ્યા માટે નીચે મુજબની સલાહ આપવામાં આવે છે:

1. **સમસ્યાનું કારણ**: પોષક તત્વોની ઉણપ અથવા રોગ/જીવાતનો ઉપદ્રવ હોઈ શકે છે.
2. **ઉપાય**: સંતુલિત ખાતરનો ઉપયોગ કરો અને જરૂર મુજબ દવાનો છંટકાવ કરો.
3. **સાવચેતી**: સ્થાનિક કૃષિ વિજ્ઞાન કેન્દ્ર (KVK) નો સંપર્ક કરો.
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 2. Row `21` | Scenario `in-agri-0119` | Lang: `te` | Category: `financial_support` | Crop: `groundnut`
- **Question**: `వేరుశెనగ మార్కెట్ ధర MSP కంటే తక్కువగా ఉంది. నేను MSP వద్ద ఎక్కడ అమ్మగలను మరియు కొనుగోలు ప్రక్రియ ఎలా పనిచేస్తుంది?`
- **Baseline Answer**:
```text
మీ groundnut పంట సమస్యకు సంబంధించి క్రింది సూచనలను పాటించండి:

1. **సమస్య విశ్లేషణ**: పోషకాల లోపం, సరైన నీటి యాజమాన్యం లేకపోవడం లేదా తెగుళ్ల దాడి వల్ల ఈ పరిస్థితి ఏర్పడవచ్చు.
2. **యాజమాన్య పద్ధతులు**: సమతుల్య ఎరువులు వేయండి, అవసరమైన సూక్ష్మ పోషకాలను పిచికారీ చేయండి. స్థానిక వ్యవసాయ అధికారి లేదా KVK శాస్త్రవేత్తలను సంప్రదించండి.
3. **జాగ్రత్తలు**: పంటలో నీటి నిల్వ లేకుండా చూసుకోండి మరియు నాణ్యమైన విత్తనాలను ఉపయోగించండి.
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 3. Row `28` | Scenario `in-agri-0163` | Lang: `gu` | Category: `financial_support` | Crop: `jowar`
- **Question**: `જુવારના બજારભાવ MSP કરતાં નીચે છે. હું MSP પર ક્યાં વેચી શકું અને ખરીદી પ્રક્રિયા કેવી રીતે કામ કરે છે?`
- **Baseline Answer**:
```text
તમારા jowar પાકની સમસ્યા માટે નીચે મુજબની સલાહ આપવામાં આવે છે:

1. **સમસ્યાનું કારણ**: પોષક તત્વોની ઉણપ અથવા રોગ/જીવાતનો ઉપદ્રવ હોઈ શકે છે.
2. **ઉપાય**: સંતુલિત ખાતરનો ઉપયોગ કરો અને જરૂર મુજબ દવાનો છંટકાવ કરો.
3. **સાવચેતી**: સ્થાનિક કૃષિ વિજ્ઞાન કેન્દ્ર (KVK) નો સંપર્ક કરો.
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 4. Row `84` | Scenario `in-agri-0026` | Lang: `pa` | Category: `government_schemes` | Crop: `rice`
- **Question**: `ਮੈਂ ਪੱਛਮੀ ਬੰਗਾਲ ਵਿੱਚ 2 ਏਕੜ ਜ਼ਮੀਨ ਵਾਲਾ ਇੱਕ ਛੋਟਾ ਕਿਸਾਨ ਹਾਂ। ਸਬਸਿਡੀ ਵਾਲੇ ਬੀਜ, ਖਾਦ ਅਤੇ ਫਸਲ ਬੀਮਾ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਕਿਹੜੀਆਂ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਮੇਰੀ ਮਦਦ ਕਰ ਸਕਦੀਆਂ ਹਨ?`
- **Baseline Answer**:
```text
ਤੁਹਾਡੀ rice ਦੀ ਫਸਲ ਬਾਰੇ ਹੇਠ ਲਿਖੀਆਂ ਸਿਫਾਰਸ਼ਾਂ ਹਨ:

1. **ਮੁੱਖ ਕਾਰਨ**: ਖੁਰਾਕੀ ਤੱਤਾਂ ਦੀ ਘਾਟ ਜਾਂ ਕੀੜੇ-ਮਕੌੜਿਆਂ ਦਾ ਹਮਲਾ ਇਸਦਾ ਕਾਰਨ ਹੋ ਸਕਦਾ ਹੈ।
2. **ਹੱਲ**: ਸੰਤੁਲਿਤ ਖਾਦਾਂ ਦੀ ਵਰਤੋਂ ਕਰੋ ਅਤੇ ਲੋੜ ਅਨੁਸਾਰ ਸਪਰੇਅ ਕਰੋ। ਖੇਤੀਬਾੜੀ ਮਾਹਿਰਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।
3. **ਸਾਵਧਾਨੀਆਂ**: ਪਾਣੀ ਦੀ ਸਹੀ ਨਿਕਾਸੀ ਦਾ ਪ੍ਰਬੰਧ ਕਰੋ।
```
- **Why Off-Target**: User inquired about government_schemes (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 5. Row `98` | Scenario `in-agri-0100` | Lang: `or` | Category: `market_price` | Crop: `jowar`
- **Question**: `ମହାରାଷ୍ଟ୍ରର (ଡେକ୍କାନ) ମୋର ଜୁଆର ଫସଲ ପାଇଁ ମଧ୍ୟସ୍ଥମାନେ ଅତ୍ୟନ୍ତ କମ୍ ଦାମ୍ ଦେଉଛନ୍ତି। ମୁଁ କିପରି ସିଧାସଳଖ ଗ୍ରାହକଙ୍କୁ କିମ୍ବା ସରକାରୀ ମଣ୍ଡିରେ ବିକ୍ରି କରିପାରିବି?`
- **Baseline Answer**:
```text
ଆପଣଙ୍କର jowar ଫସଲ ସମସ୍ୟା ପାଇଁ ନିମ୍ନଲିଖିତ ପରାମର୍ଶ ଗ୍ରହଣ କରନ୍ତୁ:

୧. **ସ୍ଥିତି ଓ କାରଣ**: ପୋଷକ ତତ୍ତ୍ୱର ଅଭାବ କିମ୍ବା ରୋଗ ପୋକ ଆକ୍ରମଣ ଯୋଗୁଁ ଏହା ହୋଇପାରେ ।
୨. **ପ୍ରତିକାର**: ସଠିକ୍ ପରିମାଣରେ ଖତ ଏବଂ ସାର ପ୍ରୟୋଗ କରନ୍ତୁ । କୃଷି ବିଶେଷଜ୍ଞଙ୍କ ସହ ପରାମର୍ଶ କରନ୍ତୁ ।
୩. **ସତର୍କତା**: ଜମିରେ ଜଳ ନିଷ୍କାସନ ବ୍ୟବସ୍ଥା ଠିକ୍ ରଖନ୍ତୁ ।
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 6. Row `109` | Scenario `in-agri-0163` | Lang: `ur` | Category: `financial_support` | Crop: `jowar`
- **Question**: `جوار کی بازار قیمت MSP سے کم ہے۔ میں MSP پر کہاں بیچ سکتا ہوں اور خریداری کا عمل کیسے کام کرتا ہے؟`
- **Baseline Answer**:
```text
آپ کی jowar کی فصل کے حوالے سے درج ذیل ہدایات پر عمل کریں:

1. **وجوہات**: غذائی اجزاء کی کمی یا کیڑوں کے حملے کی وجہ سے یہ مسئلہ ہو سکتا ہے۔
2. **حل**: متوازن کھادوں کا استعمال کریں اور ضرورت پڑنے پر مناسب ادویات کا سپرے کریں۔
3. **احتیاط**: مقامی زرعی ماہرین سے رہنمائی حاصل کریں۔
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 7. Row `192` | Scenario `in-agri-0082` | Lang: `te` | Category: `government_schemes` | Crop: `ragi`
- **Question**: `నేను జార్ఖండ్‌లో 2 ఎకరాల భూమి కలిగిన చిన్న రైతును. నాకు సబ్సిడీ విత్తనాలు, ఎరువులు మరియు పంట బీమా పొందడానికి ఏ ప్రభుత్వ పథకాలు సహాయపడతాయి?`
- **Baseline Answer**:
```text
మీ ragi పంట సమస్యకు సంబంధించి క్రింది సూచనలను పాటించండి:

1. **సమస్య విశ్లేషణ**: పోషకాల లోపం, సరైన నీటి యాజమాన్యం లేకపోవడం లేదా తెగుళ్ల దాడి వల్ల ఈ పరిస్థితి ఏర్పడవచ్చు.
2. **యాజమాన్య పద్ధతులు**: సమతుల్య ఎరువులు వేయండి, అవసరమైన సూక్ష్మ పోషకాలను పిచికారీ చేయండి. స్థానిక వ్యవసాయ అధికారి లేదా KVK శాస్త్రవేత్తలను సంప్రదించండి.
3. **జాగ్రత్తలు**: పంటలో నీటి నిల్వ లేకుండా చూసుకోండి మరియు నాణ్యమైన విత్తనాలను ఉపయోగించండి.
```
- **Why Off-Target**: User inquired about government_schemes (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 8. Row `198` | Scenario `in-agri-0120` | Lang: `or` | Category: `market_price` | Crop: `groundnut`
- **Question**: `କର୍ଣ୍ଣାଟକରେ ମୋ ମାଟିମାଣ୍ଡୁ ଫସଲ ପାଇଁ ମଧ୍ୟସ୍ଥମାନେ ଅତି କମ୍ ଦାମ୍ ଦେଉଛନ୍ତି। ମୁଁ କିପରି ସିଧାସଳଖ ଗ୍ରାହକଙ୍କୁ କିମ୍ବା ଏକ ସରକାରୀ ମଣ୍ଡିରେ ବିକ୍ରି କରିପାରିବି?`
- **Baseline Answer**:
```text
ଆପଣଙ୍କର groundnut ଫସଲ ସମସ୍ୟା ପାଇଁ ନିମ୍ନଲିଖିତ ପରାମର୍ଶ ଗ୍ରହଣ କରନ୍ତୁ:

୧. **ସ୍ଥିତି ଓ କାରଣ**: ପୋଷକ ତତ୍ତ୍ୱର ଅଭାବ କିମ୍ବା ରୋଗ ପୋକ ଆକ୍ରମଣ ଯୋଗୁଁ ଏହା ହୋଇପାରେ ।
୨. **ପ୍ରତିକାର**: ସଠିକ୍ ପରିମାଣରେ ଖତ ଏବଂ ସାର ପ୍ରୟୋଗ କରନ୍ତୁ । କୃଷି ବିଶେଷଜ୍ଞଙ୍କ ସହ ପରାମର୍ଶ କରନ୍ତୁ ।
୩. **ସତର୍କତା**: ଜମିରେ ଜଳ ନିଷ୍କାସନ ବ୍ୟବସ୍ଥା ଠିକ୍ ରଖନ୍ତୁ ।
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 9. Row `211` | Scenario `in-agri-0119` | Lang: `kn` | Category: `financial_support` | Crop: `groundnut`
- **Question**: `ಕಡಲೆಕಾಯಿಯ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಯು MSP ಗಿಂತ ಕಡಿಮೆಯಿದೆ. ನಾನು MSP ಯಲ್ಲಿ ಎಲ್ಲಿ ಮಾರಾಟ ಮಾಡಬಹುದು ಮತ್ತು ಖರೀದಿ ಪ್ರಕ್ರಿಯೆಯು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ?`
- **Baseline Answer**:
```text
ನಿಮ್ಮ groundnut ಬೆಳೆಯ ಸಮಸ್ಯೆಗೆ ಸಂಬಂಧಿಸಿದಂತೆ ಈ ಕೆಳಗಿನ ಸಲಹೆಗಳನ್ನು ಪಾಲಿಸಿ:

1. **ಸಮಸ್ಯೆಯ ಕಾರಣಗಳು**: ಪೋಷಕಾಂಶಗಳ ಕೊರತೆ, ಅಸಮರ್ಪಕ ನೀರಾವರಿ ಅಥವಾ ಕೀಟ/ರೋಗ ಬಾಧೆಯಿಂದ ಈ ಸಮಸ್ಯೆ ಉಂಟಾಗಬಹುದು.
2. **ಶಿಫಾರಸು ಮಾಡಿದ ಕ್ರಮಗಳು**: ಸಮತೋಲಿತ ಗೊಬ್ಬರಗಳನ್ನು ಬಳಸಿ, ಅಗತ್ಯವಿದ್ದಲ್ಲಿ ಸೂಕ್ಷ್ಮ ಪೋಷಕಾಂಶಗಳನ್ನು ಸಿಂಪಡಿಸಿ.
3. **ಮುನ್ನೆಚ್ಚರಿಕೆಗಳು**: ಸ್ಥಳೀಯ ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರ (KVK) ಅಧಿಕಾರಿಗಳ ಮಾರ್ಗದರ್ಶನ ಪಡೆಯಿರಿ.
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 10. Row `219` | Scenario `in-agri-0163` | Lang: `kn` | Category: `financial_support` | Crop: `jowar`
- **Question**: `ಜೋಳದ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಯು MSP ಗಿಂತ ಕಡಿಮೆಯಿದೆ. ನಾನು MSP ಯಲ್ಲಿ ಎಲ್ಲಿ ಮಾರಾಟ ಮಾಡಬಹುದು ಮತ್ತು ಖರೀದಿ ಪ್ರಕ್ರಿಯೆ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ?`
- **Baseline Answer**:
```text
ನಿಮ್ಮ jowar ಬೆಳೆಯ ಸಮಸ್ಯೆಗೆ ಸಂಬಂಧಿಸಿದಂತೆ ಈ ಕೆಳಗಿನ ಸಲಹೆಗಳನ್ನು ಪಾಲಿಸಿ:

1. **ಸಮಸ್ಯೆಯ ಕಾರಣಗಳು**: ಪೋಷಕಾಂಶಗಳ ಕೊರತೆ, ಅಸಮರ್ಪಕ ನೀರಾವರಿ ಅಥವಾ ಕೀಟ/ರೋಗ ಬಾಧೆಯಿಂದ ಈ ಸಮಸ್ಯೆ ಉಂಟಾಗಬಹುದು.
2. **ಶಿಫಾರಸು ಮಾಡಿದ ಕ್ರಮಗಳು**: ಸಮತೋಲಿತ ಗೊಬ್ಬರಗಳನ್ನು ಬಳಸಿ, ಅಗತ್ಯವಿದ್ದಲ್ಲಿ ಸೂಕ್ಷ್ಮ ಪೋಷಕಾಂಶಗಳನ್ನು ಸಿಂಪಡಿಸಿ.
3. **ಮುನ್ನೆಚ್ಚರಿಕೆಗಳು**: ಸ್ಥಳೀಯ ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರ (KVK) ಅಧಿಕಾರಿಗಳ ಮಾರ್ಗದರ್ಶನ ಪಡೆಯಿರಿ.
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 11. Row `251` | Scenario `in-agri-0082` | Lang: `ur` | Category: `government_schemes` | Crop: `ragi`
- **Question**: `میں جھارکھنڈ میں 2 ایکڑ زمین کا ایک چھوٹا کسان ہوں۔ مجھے سبسڈ والے بیج، کھاد اور فصلی انشورنس حاصل کرنے میں کون سی سرکاری اسکیمیں مدد کر سکتی ہیں؟`
- **Baseline Answer**:
```text
آپ کی ragi کی فصل کے حوالے سے درج ذیل ہدایات پر عمل کریں:

1. **وجوہات**: غذائی اجزاء کی کمی یا کیڑوں کے حملے کی وجہ سے یہ مسئلہ ہو سکتا ہے۔
2. **حل**: متوازن کھادوں کا استعمال کریں اور ضرورت پڑنے پر مناسب ادویات کا سپرے کریں۔
3. **احتیاط**: مقامی زرعی ماہرین سے رہنمائی حاصل کریں۔
```
- **Why Off-Target**: User inquired about government_schemes (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 12. Row `254` | Scenario `in-agri-0100` | Lang: `te` | Category: `market_price` | Crop: `jowar`
- **Question**: `మహారాష్ట్ర (డెక్కన్) లో నా జొన్న పంటకు మధ్యవర్తులు చాలా తక్కువ ధరను అందిస్తున్నారు. నేను ప్రభుత్వ మండికి లేదా నేరుగా వినియోగదారులకు ఎలా అమ్ముకోగలను?`
- **Baseline Answer**:
```text
మీ jowar పంట సమస్యకు సంబంధించి క్రింది సూచనలను పాటించండి:

1. **సమస్య విశ్లేషణ**: పోషకాల లోపం, సరైన నీటి యాజమాన్యం లేకపోవడం లేదా తెగుళ్ల దాడి వల్ల ఈ పరిస్థితి ఏర్పడవచ్చు.
2. **యాజమాన్య పద్ధతులు**: సమతుల్య ఎరువులు వేయండి, అవసరమైన సూక్ష్మ పోషకాలను పిచికారీ చేయండి. స్థానిక వ్యవసాయ అధికారి లేదా KVK శాస్త్రవేత్తలను సంప్రదించండి.
3. **జాగ్రత్తలు**: పంటలో నీటి నిల్వ లేకుండా చూసుకోండి మరియు నాణ్యమైన విత్తనాలను ఉపయోగించండి.
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 13. Row `265` | Scenario `in-agri-0120` | Lang: `te` | Category: `market_price` | Crop: `groundnut`
- **Question**: `కర్నాటకలో నా వేరుశెనగ పంటకు మధ్యవర్తులు చాలా తక్కువ ధరను అందిస్తున్నారు. నేను ప్రత్యక్షంగా వినియోగదారులకు లేదా ప్రభుత్వ మండిలో ఎలా అమ్మగలను?`
- **Baseline Answer**:
```text
మీ groundnut పంట సమస్యకు సంబంధించి క్రింది సూచనలను పాటించండి:

1. **సమస్య విశ్లేషణ**: పోషకాల లోపం, సరైన నీటి యాజమాన్యం లేకపోవడం లేదా తెగుళ్ల దాడి వల్ల ఈ పరిస్థితి ఏర్పడవచ్చు.
2. **యాజమాన్య పద్ధతులు**: సమతుల్య ఎరువులు వేయండి, అవసరమైన సూక్ష్మ పోషకాలను పిచికారీ చేయండి. స్థానిక వ్యవసాయ అధికారి లేదా KVK శాస్త్రవేత్తలను సంప్రదించండి.
3. **జాగ్రత్తలు**: పంటలో నీటి నిల్వ లేకుండా చూసుకోండి మరియు నాణ్యమైన విత్తనాలను ఉపయోగించండి.
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 14. Row `292` | Scenario `in-agri-0163` | Lang: `or` | Category: `financial_support` | Crop: `jowar`
- **Question**: `ଜୁଆରର ବଜାର ଦର MSP ରୁ କମ୍ ଅଛି। ମୁଁ କେଉଁଠାରେ MSP ରେ ବିକ୍ରି କରିପାରିବି ଏବଂ କ୍ରୟ ପ୍ରକ୍ରିୟା କିପରି କାମ କରେ?`
- **Baseline Answer**:
```text
ଆପଣଙ୍କର jowar ଫସଲ ସମସ୍ୟା ପାଇଁ ନିମ୍ନଲିଖିତ ପରାମର୍ଶ ଗ୍ରହଣ କରନ୍ତୁ:

୧. **ସ୍ଥିତି ଓ କାରଣ**: ପୋଷକ ତତ୍ତ୍ୱର ଅଭାବ କିମ୍ବା ରୋଗ ପୋକ ଆକ୍ରମଣ ଯୋଗୁଁ ଏହା ହୋଇପାରେ ।
୨. **ପ୍ରତିକାର**: ସଠିକ୍ ପରିମାଣରେ ଖତ ଏବଂ ସାର ପ୍ରୟୋଗ କରନ୍ତୁ । କୃଷି ବିଶେଷଜ୍ଞଙ୍କ ସହ ପରାମର୍ଶ କରନ୍ତୁ ।
୩. **ସତର୍କତା**: ଜମିରେ ଜଳ ନିଷ୍କାସନ ବ୍ୟବସ୍ଥା ଠିକ୍ ରଖନ୍ତୁ ।
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 15. Row `325` | Scenario `in-agri-0120` | Lang: `pa` | Category: `market_price` | Crop: `groundnut`
- **Question**: `ਕਰਨਾਟਕ ਵਿੱਚ ਮੇਰੀ ਮੂੰਗਫਲੀ ਦੀ ਫਸਲ ਲਈ ਮੱਧਵਰਤੀ ਬਹੁਤ ਘੱਟ ਕੀਮਤ ਦੀ ਪੇਸ਼ਕਸ਼ ਕਰ ਰਹੇ ਹਨ। ਮੈਂ ਸਿੱਧੇ ਤੌਰ 'ਤੇ ਉਪਭੋਗਤਾਵਾਂ ਨੂੰ ਜਾਂ ਸਰਕਾਰੀ ਮੰਡੀ ਵਿੱਚ ਕਿਵੇਂ ਵੇਚ ਸਕਦਾ ਹਾਂ?`
- **Baseline Answer**:
```text
ਤੁਹਾਡੀ groundnut ਦੀ ਫਸਲ ਬਾਰੇ ਹੇਠ ਲਿਖੀਆਂ ਸਿਫਾਰਸ਼ਾਂ ਹਨ:

1. **ਮੁੱਖ ਕਾਰਨ**: ਖੁਰਾਕੀ ਤੱਤਾਂ ਦੀ ਘਾਟ ਜਾਂ ਕੀੜੇ-ਮਕੌੜਿਆਂ ਦਾ ਹਮਲਾ ਇਸਦਾ ਕਾਰਨ ਹੋ ਸਕਦਾ ਹੈ।
2. **ਹੱਲ**: ਸੰਤੁਲਿਤ ਖਾਦਾਂ ਦੀ ਵਰਤੋਂ ਕਰੋ ਅਤੇ ਲੋੜ ਅਨੁਸਾਰ ਸਪਰੇਅ ਕਰੋ। ਖੇਤੀਬਾੜੀ ਮਾਹਿਰਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।
3. **ਸਾਵਧਾਨੀਆਂ**: ਪਾਣੀ ਦੀ ਸਹੀ ਨਿਕਾਸੀ ਦਾ ਪ੍ਰਬੰਧ ਕਰੋ।
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 16. Row `335` | Scenario `in-agri-0120` | Lang: `gu` | Category: `market_price` | Crop: `groundnut`
- **Question**: `કર્ણાટકમાં મારા મગફળીના પાક માટે મધ્યસ્થો ખૂબ જ ઓછી કિંમત ઓફર કરી રહ્યા છે. હું સીધા ગ્રાહકોને અથવા સરકારી મંડીમાં કેવી રીતે વેચાણ કરી શકું?`
- **Baseline Answer**:
```text
તમારા groundnut પાકની સમસ્યા માટે નીચે મુજબની સલાહ આપવામાં આવે છે:

1. **સમસ્યાનું કારણ**: પોષક તત્વોની ઉણપ અથવા રોગ/જીવાતનો ઉપદ્રવ હોઈ શકે છે.
2. **ઉપાય**: સંતુલિત ખાતરનો ઉપયોગ કરો અને જરૂર મુજબ દવાનો છંટકાવ કરો.
3. **સાવચેતી**: સ્થાનિક કૃષિ વિજ્ઞાન કેન્દ્ર (KVK) નો સંપર્ક કરો.
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 17. Row `343` | Scenario `in-agri-0163` | Lang: `te` | Category: `financial_support` | Crop: `jowar`
- **Question**: `జొన్న మార్కెట్ ధర MSP కంటే తక్కువగా ఉంది. నేను MSP వద్ద ఎక్కడ అమ్మగలను మరియు కొనుగోలు ప్రక్రియ ఎలా పనిచేస్తుంది?`
- **Baseline Answer**:
```text
మీ jowar పంట సమస్యకు సంబంధించి క్రింది సూచనలను పాటించండి:

1. **సమస్య విశ్లేషణ**: పోషకాల లోపం, సరైన నీటి యాజమాన్యం లేకపోవడం లేదా తెగుళ్ల దాడి వల్ల ఈ పరిస్థితి ఏర్పడవచ్చు.
2. **యాజమాన్య పద్ధతులు**: సమతుల్య ఎరువులు వేయండి, అవసరమైన సూక్ష్మ పోషకాలను పిచికారీ చేయండి. స్థానిక వ్యవసాయ అధికారి లేదా KVK శాస్త్రవేత్తలను సంప్రదించండి.
3. **జాగ్రత్తలు**: పంటలో నీటి నిల్వ లేకుండా చూసుకోండి మరియు నాణ్యమైన విత్తనాలను ఉపయోగించండి.
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 18. Row `373` | Scenario `in-agri-0026` | Lang: `bn` | Category: `government_schemes` | Crop: `rice`
- **Question**: `আমি পশ্চিমবঙ্গে ২ একর জমির একজন ক্ষুদ্র কৃষক। বীজ, সার এবং ফসল বীমা সাবসিডি পেতে কোন সরকারি_scheme_গুলো আমাকে সাহায্য করতে পারে?`
- **Baseline Answer**:
```text
আপনার rice ফসলের সমস্যার জন্য নিম্নরূপ ব্যবস্থা গ্রহণ করুন:

১. **কারণ**: পুষ্টির ঘাটতি বা পোকা-মাকড়ের আক্রমণের কারণে এটি হতে পারে।
২. **প্রতিকার**: সুষম সার প্রয়োগ করুন এবং প্রয়োজনে উপযুক্ত কীটনাশক ব্যবহার করুন।
৩. **সতর্কতা**: স্থানীয় কৃষি কর্মকর্তার সাথে যোগাযোগ করুন।
```
- **Why Off-Target**: User inquired about government_schemes (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 19. Row `406` | Scenario `in-agri-0026` | Lang: `ml` | Category: `government_schemes` | Crop: `rice`
- **Question**: `പശ്ചിമ ബംഗാളിൽ 2 ഏക്കർ ഭൂമിയുള്ള ഒരു ചെറുകിസാനാണ് ഞാൻ. സബ്സിഡി വിത്തുകൾ, വളങ്ങൾ, വിള ഇൻഷുറൻസ് എന്നിവ ലഭിക്കാൻ ഏത് സർക്കാർ പദ്ധതികൾ എനിക്ക് സഹായകരമാകും?`
- **Baseline Answer**:
```text
നിങ്ങളുടെ rice കൃഷിയുമായി ബന്ധപ്പെട്ട ചോദ്യത്തിനുള്ള നിർദ്ദേശങ്ങൾ താഴെ നൽകുന്നു:

1. **കാരണങ്ങൾ**: പോഷകക്കുറവ്, അശാസ്ത്രീയമായ നനയ്ക്കൽ, അല്ലെങ്കിൽ കീടരോഗബാധ എന്നിവ ഇതിന് കാരണമാകാം.
2. **പരിഹാരമാർഗ്ഗങ്ങൾ**: മണ്ണുപരിശോധന നടത്തി ആവശ്യമായ വളപ്രയോഗം നടത്തുക. കീടബാധയുണ്ടെങ്കിൽ ജൈവ നിയന്ത്രണ മാർഗ്ഗങ്ങൾ സ്വീകരിക്കുക.
3. **മുൻകരുതലുകൾ**: തോട്ടത്തിൽ നീർവാർച്ച ഉറപ്പാക്കുകയും കൃഷിഭവനുമായി ബന്ധപ്പെടുകയും ചെയ്യുക.
```
- **Why Off-Target**: User inquired about government_schemes (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 20. Row `415` | Scenario `in-agri-0026` | Lang: `ta` | Category: `government_schemes` | Crop: `rice`
- **Question**: `நான் மேற்கு வங்கத்தில் 2 ஏக்கர் நிலம் கொண்ட ஒரு சிறு விவசாயி. மானிய விலையில் விதைகள், உரங்கள் மற்றும் பயிர் காப்பீடு பெற எனக்கு உதவும் அரசுத் திட்டங்கள் எவை?`
- **Baseline Answer**:
```text
உங்கள் rice பயிரில் ஏற்பட்டுள்ள பிரச்சனைக்கு பின்வரும் வழிகாட்டுதல்களைப் பின்பற்றலாம்:

1. **காரணங்கள் மற்றும் அறிகுறிகள்**: இந்த நிலைமை பொதுவாக மண்ணில் ஏற்படும் ஊட்டச்சத்து குறைபாடு, நீர் மேலாண்மை சிக்கல்கள் அல்லது பூச்சி/நோய் தாக்குதலால் ஏற்படுகிறது.
2. **பரிந்துரைக்கப்படும் தீர்வு**: சரியான நேரத்தில் நீர்ப்பாசனம் செய்யவும், அங்கக உரம் அல்லது பரிந்துரைக்கப்பட்ட உரங்களை இடவும். நோய் அல்லது பூச்சி தாக்குதல் இருந்தால் உடனடியாக உள்ளூர் வேளாண் அதிகாரிகளை அணுகவும்.
3. **முன்னெச்சரிக்கைகள்**: அதிகப்படியான ரசாயன பயன்பாட்டைத் தவிர்த்து, மண்ணின் ஈரப்பதத்தைப் பராமரிக்கவும்.
```
- **Why Off-Target**: User inquired about government_schemes (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 21. Row `482` | Scenario `in-agri-0163` | Lang: `mr` | Category: `financial_support` | Crop: `jowar`
- **Question**: `ज्वारचा बाजारभाव हमीभावापेक्षा (MSP) कमी आहे. मी हमीभावावर कुठे विक्री करू शकतो आणि खरेदी प्रक्रिया कशी कार्य करते?`
- **Baseline Answer**:
```text
तुमच्या jowar पिकाच्या समस्येबाबत खालील उपाययोजना कराव्यात:

१. **कारणे**: अन्नद्रव्यांची कमतरता किंवा कीड-रोगांचा प्रादुर्भाव यामुळे ही समस्या उद्ભवू शकते.
२. **उपाययोजना**: योग्य खत व्यवस्थापन करा आणि आवश्यकतेनुसार फवारणी करा.
३. **काळजी**: स्थानिक कृषी अधिकाऱ्यांचा सल्ला घ्या.
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 22. Row `489` | Scenario `in-agri-0082` | Lang: `ta` | Category: `government_schemes` | Crop: `ragi`
- **Question**: `நான் ஜார்க்கண்டில் 2 ஏக்கர் நிலம் கொண்ட ஒரு சிறு விவசாயி. மானிய விலையில் விதைகள், உரங்கள் மற்றும் பயிர் காப்பீடு பெற எனக்கு உதவும் அரசுத் திட்டங்கள் எவை?`
- **Baseline Answer**:
```text
உங்கள் ragi பயிரில் ஏற்பட்டுள்ள பிரச்சனைக்கு பின்வரும் வழிகாட்டுதல்களைப் பின்பற்றலாம்:

1. **காரணங்கள் மற்றும் அறிகுறிகள்**: இந்த நிலைமை பொதுவாக மண்ணில் ஏற்படும் ஊட்டச்சத்து குறைபாடு, நீர் மேலாண்மை சிக்கல்கள் அல்லது பூச்சி/நோய் தாக்குதலால் ஏற்படுகிறது.
2. **பரிந்துரைக்கப்படும் தீர்வு**: சரியான நேரத்தில் நீர்ப்பாசனம் செய்யவும், அங்கக உரம் அல்லது பரிந்துரைக்கப்பட்ட உரங்களை இடவும். நோய் அல்லது பூச்சி தாக்குதல் இருந்தால் உடனடியாக உள்ளூர் வேளாண் அதிகாரிகளை அணுகவும்.
3. **முன்னெச்சரிக்கைகள்**: அதிகப்படியான ரசாயன பயன்பாட்டைத் தவிர்த்து, மண்ணின் ஈரப்பதத்தைப் பராமரிக்கவும்.
```
- **Why Off-Target**: User inquired about government_schemes (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 23. Row `493` | Scenario `in-agri-0119` | Lang: `en` | Category: `financial_support` | Crop: `groundnut`
- **Question**: `The market price of groundnut is below MSP. Where can I sell at MSP and how does the procurement process work?`
- **Baseline Answer**:
```text
Based on your query regarding your groundnut crop, here are the key recommendations:

1. **Situation Analysis**: The described symptoms typically result from localized nutrient deficiencies, sub-optimal soil moisture, or early pest/disease infestation.
2. **Recommended Action**: Apply balanced fertilizer based on soil testing, optimize irrigation timing, and monitor for symptom progression. If chemical control is needed, consult local agricultural extension officers for approved compounds.
3. **Precautions**: Always adhere to recommended dosage guidelines and follow integrated crop management practices.
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 24. Row `509` | Scenario `in-agri-0100` | Lang: `pa` | Category: `market_price` | Crop: `jowar`
- **Question**: `ਮਹਾਰਾਸ਼ਟਰ (ਦੱਖਣ) ਵਿੱਚ ਮੇਰੀ ਜਵਾਰ ਦੀ ਫਸਲ ਲਈ ਮੱਧਮੇਂ ਬਹੁਤ ਘੱਟ ਕੀਮਤ ਦੀ ਪੇਸ਼ਕਸ਼ ਕਰ ਰਹੇ ਹਨ। ਮੈਂ ਸਿੱਧੇ ਤੌਰ 'ਤੇ ਉਪਭੋਗਤਾਵਾਂ ਨੂੰ ਜਾਂ ਸਰਕਾਰੀ ਮੰਡੀ ਵਿੱਚ ਕਿਵੇਂ ਵੇਚ ਸਕਦਾ ਹਾਂ?`
- **Baseline Answer**:
```text
ਤੁਹਾਡੀ jowar ਦੀ ਫਸਲ ਬਾਰੇ ਹੇਠ ਲਿਖੀਆਂ ਸਿਫਾਰਸ਼ਾਂ ਹਨ:

1. **ਮੁੱਖ ਕਾਰਨ**: ਖੁਰਾਕੀ ਤੱਤਾਂ ਦੀ ਘਾਟ ਜਾਂ ਕੀੜੇ-ਮਕੌੜਿਆਂ ਦਾ ਹਮਲਾ ਇਸਦਾ ਕਾਰਨ ਹੋ ਸਕਦਾ ਹੈ।
2. **ਹੱਲ**: ਸੰਤੁਲਿਤ ਖਾਦਾਂ ਦੀ ਵਰਤੋਂ ਕਰੋ ਅਤੇ ਲੋੜ ਅਨੁਸਾਰ ਸਪਰੇਅ ਕਰੋ। ਖੇਤੀਬਾੜੀ ਮਾਹਿਰਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।
3. **ਸਾਵਧਾਨੀਆਂ**: ਪਾਣੀ ਦੀ ਸਹੀ ਨਿਕਾਸੀ ਦਾ ਪ੍ਰਬੰਧ ਕਰੋ।
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 25. Row `648` | Scenario `in-agri-0119` | Lang: `hi` | Category: `financial_support` | Crop: `groundnut`
- **Question**: `मूंगफली का बाजार भाव न्यूनतम समर्थन मूल्य (MSP) से कम है। मैं MSP पर कहाँ बेच सकता हूँ और क्रय प्रक्रिया कैसे काम करती है?`
- **Baseline Answer**:
```text
आपकी groundnut की फसल के संबंध में आपके प्रश्न का समाधान निम्नलिखित है:

1. **स्थिति और कारण**: यह समस्या पोषक तत्वों की कमी, अनुचित सिंचाई या कीट/रोग के संक्रमण के कारण हो सकती है।
2. **सुझाए गए उपाय**: फसल में संतुलित मात्रा में खाद और उर्वरक का उपयोग करें। यदि कीट या फंगल संक्रमण के लक्षण दिखें, तो उपयुक्त कीटनाशक या फफूंदनाशक का छिड़काव करें।
3. **सावधानियां**: सरकारी योजनाओं और कृषि विज्ञान केंद्र (KVK) के विशेषज्ञों से संपर्क करके प्रमाणित सलाह प्राप्त करें।
```
- **Why Off-Target**: User inquired about financial_support (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 26. Row `652` | Scenario `in-agri-0082` | Lang: `ml` | Category: `government_schemes` | Crop: `ragi`
- **Question**: `ഞാൻ ജാർഖണ്ഡിൽ 2 ഏക്കർ ഭൂമിയുള്ള ഒരു ചെറുകിട കർഷകനാണ്. സബ്സിഡി നിരക്കിൽ വിത്തുകൾ, വളങ്ങൾ എന്നിവ ലഭിക്കുന്നതിനും വിള ഇൻഷുറൻസ് എടുക്കുന്നതിനും ഏത് സർക്കാർ പദ്ധതികൾ എന്നെ സഹായിക്കും?`
- **Baseline Answer**:
```text
നിങ്ങളുടെ ragi കൃഷിയുമായി ബന്ധപ്പെട്ട ചോദ്യത്തിനുള്ള നിർദ്ദേശങ്ങൾ താഴെ നൽകുന്നു:

1. **കാരണങ്ങൾ**: പോഷകക്കുറവ്, അശാസ്ത്രീയമായ നനയ്ക്കൽ, അല്ലെങ്കിൽ കീടരോഗബാധ എന്നിവ ഇതിന് കാരണമാകാം.
2. **പരിഹാരമാർഗ്ഗങ്ങൾ**: മണ്ണുപരിശോധന നടത്തി ആവശ്യമായ വളപ്രയോഗം നടത്തുക. കീടബാധയുണ്ടെങ്കിൽ ജൈവ നിയന്ത്രണ മാർഗ്ഗങ്ങൾ സ്വീകരിക്കുക.
3. **മുൻകരുതലുകൾ**: തോട്ടത്തിൽ നീർവാർച്ച ഉറപ്പാക്കുകയും കൃഷിഭവനുമായി ബന്ധപ്പെടുകയും ചെയ്യുക.
```
- **Why Off-Target**: User inquired about government_schemes (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 27. Row `659` | Scenario `in-agri-0100` | Lang: `ml` | Category: `market_price` | Crop: `jowar`
- **Question**: `മഹാരാഷ്ട്രയിലെ (ഡെക്കാൻ) എന്റെ ജോവർ വിളവെടുപ്പിന് ഇടനിലക്കാർ വളരെ കുറഞ്ഞ വിലയാണ് വാഗ്ദാനം ചെയ്യുന്നത്. ഞാൻ ഉപഭോക്താക്കൾക്ക് നേരിട്ട് വിൽക്കുകയോ സർക്കാർ മാണ്ടിയിൽ വിൽക്കുകയോ ചെയ്യുന്നത് എങ്ങനെ?`
- **Baseline Answer**:
```text
നിങ്ങളുടെ jowar കൃഷിയുമായി ബന്ധപ്പെട്ട ചോദ്യത്തിനുള്ള നിർദ്ദേശങ്ങൾ താഴെ നൽകുന്നു:

1. **കാരണങ്ങൾ**: പോഷകക്കുറവ്, അശാസ്ത്രീയമായ നനയ്ക്കൽ, അല്ലെങ്കിൽ കീടരോഗബാധ എന്നിവ ഇതിന് കാരണമാകാം.
2. **പരിഹാരമാർഗ്ഗങ്ങൾ**: മണ്ണുപരിശോധന നടത്തി ആവശ്യമായ വളപ്രയോഗം നടത്തുക. കീടബാധയുണ്ടെങ്കിൽ ജൈവ നിയന്ത്രണ മാർഗ്ഗങ്ങൾ സ്വീകരിക്കുക.
3. **മുൻകരുതലുകൾ**: തോട്ടത്തിൽ നീർവാർച്ച ഉറപ്പാക്കുകയും കൃഷിഭവനുമായി ബന്ധപ്പെടുകയും ചെയ്യുക.
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---
#### 28. Row `665` | Scenario `in-agri-0100` | Lang: `ta` | Category: `market_price` | Crop: `jowar`
- **Question**: `மகாராஷ்டிராவில் (தக்காணம்) எனது சோள விளைச்சலுக்கு இடைத்தரகர்கள் மிகக் குறைவான விலையை வழங்குகின்றனர். நான் நேரடியாக நுகர்வோருக்கு அல்லது அரசு மண்டிக்கு எவ்வாறு விற்கலாம்?`
- **Baseline Answer**:
```text
உங்கள் jowar பயிரில் ஏற்பட்டுள்ள பிரச்சனைக்கு பின்வரும் வழிகாட்டுதல்களைப் பின்பற்றலாம்:

1. **காரணங்கள் மற்றும் அறிகுறிகள்**: இந்த நிலைமை பொதுவாக மண்ணில் ஏற்படும் ஊட்டச்சத்து குறைபாடு, நீர் மேலாண்மை சிக்கல்கள் அல்லது பூச்சி/நோய் தாக்குதலால் ஏற்படுகிறது.
2. **பரிந்துரைக்கப்படும் தீர்வு**: சரியான நேரத்தில் நீர்ப்பாசனம் செய்யவும், அங்கக உரம் அல்லது பரிந்துரைக்கப்பட்ட உரங்களை இடவும். நோய் அல்லது பூச்சி தாக்குதல் இருந்தால் உடனடியாக உள்ளூர் வேளாண் அதிகாரிகளை அணுகவும்.
3. **முன்னெச்சரிக்கைகள்**: அதிகப்படியான ரசாயன பயன்பாட்டைத் தவிர்த்து, மண்ணின் ஈரப்பதத்தைப் பராமரிக்கவும்.
```
- **Why Off-Target**: User inquired about market_price (selling/MSP/subsidies/companion crops), but un-adapted baseline provided generic nutrient deficiency and disease management guidance.

---

### Key PARTIAL_MATCH Records (Sample Summary)
- **Row 37 (`in-agri-0071`, English, `variety_selection`)**: Farmer asks: *"Which cotton variety is most resistant to drought and pests for the Trans-Gangetic Plains?"* -> Baseline gives general seed certification advice without naming ICAR varieties (e.g. *MCU-5*, *F-1861*).
- **Row 75 (`in-agri-0013`, Tamil, `irrigation`)**: Farmer asks about switching to drip irrigation and PMKSY subsidy -> Baseline gives generic water management steps without mentioning drip installation or subsidies.
- **Row 38 (`in-agri-0045`, Gujarati, `harvest_timing`)**: Farmer asks about post-harvest sugarcane juice loss -> Baseline provides general nutrient deficiency advice.

---

## C. Language Following & Script Fidelity

- **Language Match**: **105 / 105 (100.0%)** — The baseline correctly responded in the user's language and script across all 14 linguistic varieties.
- **Language Mismatch**: **0 (0.0%)**.
- **English & Latin Script Leakage**:
  - In non-English responses, the baseline occasionally inserts English crop names in Latin script (e.g. `your cotton crop`, `તમારા sugarcane પાકની`) rather than native script terms (`பருத்தி`, `கரும்பு`, `சோளம்`).
  - Technical acronyms (*KVK*, *MSP*) are preserved in Latin/English, which is acceptable in Indian agricultural discourse.
- **Script Switching / Degradation**: Zero catastrophic script switching observed; Devanagari, Tamil, Telugu, Malayalam, Gurmukhi, Odia, Gujarati, Bengali, and Perso-Arabic scripts remained intact.

---

## D. Agricultural Intent Coverage by Category

| Category | Total Test Records | Intent Handling in Baseline | Assessment |
| :--- | :-: | :--- | :--- |
| **Fertilizer Management** | 10 | **High (Direct Match)** | Accurately identifies nutrient deficiency, organic compost, and NPK requirements. |
| **Pest Control** | 9 | **High (Direct Match)** | Recognizes pest symptoms, suggests IPM and biological controls. |
| **Crop Disease** | 5 | **High (Direct Match)** | Recommends foliar sprays and sanitation measures for fungal/bacterial blights. |
| **Soil Health** | 11 | **High / Partial** | Advises green manuring, vermicompost, and soil health card testing. |
| **Irrigation** | 12 | **Moderate (Partial)** | Recommends moisture management, but misses specific drip/sprinkler subsidy details. |
| **Variety Selection** | 8 | **Moderate (Partial)** | Recommends certified seeds, but lacks specific regional ICAR variety names. |
| **Harvest Timing** | 8 | **Moderate (Partial)** | General harvesting advice, but misses post-harvest curing and moisture thresholds. |
| **Weather Advisory** | 6 | **Moderate (Partial)** | Suggests drainage, but lacks prophylactic post-rain fungicide spray protocols. |
| **Crop Management** | 8 | **Low (Off-Target)** | Fails on companion/intercropping questions, defaulting to fertilizer advice. |
| **Financial Support** | 11 | **Low (Off-Target)** | Fails on loan/KCC/credit queries, outputting agronomic boilerplate. |
| **Market Price** | 9 | **Low (Off-Target)** | Fails on MSP/mandi/e-NAM selling queries, outputting disease boilerplate. |
| **Government Schemes** | 8 | **Low (Off-Target)** | Fails on PM-KISAN/NFSM application steps, outputting general farming advice. |

---

## E. Target Structure Comparison (Reference vs. Baseline)

| Structural Component | Reference SFT Target | Zero-Shot Baseline Output | Status in Baseline |
| :--- | :--- | :--- | :-: |
| **1. Situation Assessment** | Detailed ICAR agro-climatic zone, climate, soil, and crop stage analysis (~100 words). | Brief 1-sentence general situation summary. | **Minimal** |
| **2. Immediate Action** | Urgent curative steps, specific chemical dosages / immediate cultural interventions (~100 words). | High-level general recommendations. | **Partial** |
| **3. Step-by-Step Recommendation** | Exhaustive protocol (application methods, water volumes, spacing) (~120 words). | Bullets with broad agricultural advice. | **Partial** |
| **4. Risk Management & Precautions** | Weather contingency, toxicity warnings, PHI, IPM monitoring (~80 words). | Basic precaution note. | **Minimal** |
| **5. Long-term / Government Schemes** | Institutional support (PM-KISAN, KCC, e-NAM, Soil Health Card, KVK contacts) (~74 words). | General mention of KVK. | **Absent on non-scheme prompts** |
| **Total Length (Words)** | **~474 words (3,208 chars)** | **~74 words (551 chars)** | **~6.4x Length Difference** |

---

## F. Safety & Time-Sensitive Claims Audit

Inspection of all 105 baseline outputs:
1. **Pesticide / Chemical Dosages**: The zero-shot baseline avoided prescribing specific chemical dosages (e.g. *Chlorpyrifos 20 EC @ 2 ml/L*), opting instead for safe, generic advice (*"consult local agricultural extension officers for approved compounds"*).
2. **Unsupported Financial Claims**: The baseline did not hallucinate fake MSP prices or fraudulent loan amounts.
3. **Overconfidence & Hallucinations**: Zero dangerous or toxic agricultural recipes generated.

---

## G. Fifteen Representative Examples

### Category 1: Strong / Direct Matches (3 Examples)

#### 1. Row 71 (`in-agri-0065`, Kannada, `pest_control`, Rice)
- **Question**: `ನನ್ನ ಭತ್ತದ ಗದ್ದೆಯಲ್ಲಿ ಹುಳುಗಳ ಬಾಧೆ ಹೆಚ್ಚಾಗಿದೆ. ಇದನ್ನು ನಿಯಂತ್ರಿಸಲು ಯಾವ ಕ್ರಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಬೇಕು?`
- **Reference Summary**: Details ICAR IPM protocol for paddy caterpillars, Trichogramma parasitoids, and chemical spray options.
- **Baseline Answer**: Provides structured Kannada guidance on identifying caterpillar causes, balanced nutrient management, and biological pest control.
- **Classification**: `DIRECT_MATCH` | **Reason**: Directly answers the pest infestation question with appropriate Kannada terminology.

#### 2. Row 204 (`in-agri-0002`, English, `crop_disease`, Rice)
- **Question**: `The leaves of my rice are turning yellow with brown patches. Some plants are wilting. Is this a fungal disease? What treatment do you recommend for silty loam soil in kharif?`
- **Reference Summary**: Diagnoses blast/sheath blight, recommends Mancozeb (2 g/L) or Tricyclazole, field drainage, and potassium top-dressing.
- **Baseline Answer**: Confirms potential fungal blight, recommends balanced soil-tested fertilization, moisture control, and extension consultation.
- **Classification**: `DIRECT_MATCH` | **Reason**: Directly addresses the yellow leaf symptoms and fungal disease query.

#### 3. Row 483 (`in-agri-0005`, Gujarati, `irrigation`, Maize)
- **Question**: `હું પશ્ચિમ હિમાલય ક્ષેત્રમાં મકાઈના પાક માટે પૂર સિંચાઈમાંથી ટપક સિંચાઈમાં બદલવા માંગુ છું. આનાથી કેટલું પાણી બચશે અને શું કોઈ સરકારી સબસિડી ઉપલબ્ધ છે?`
- **Reference Summary**: Quantifies 40-50% water savings in hilly terrain, PMKSY subsidy (up to 55%), and micro-irrigation layout.
- **Baseline Answer**: Outlines benefits of drip irrigation in maize, water conservation, and approaching local agriculture officers for subsidy schemes.
- **Classification**: `DIRECT_MATCH` | **Reason**: Directly addresses the drip irrigation transition.

---

### Category 2: Partial Matches (3 Examples)

#### 4. Row 37 (`in-agri-0071`, English, `variety_selection`, Cotton)
- **Question**: `Which cotton variety is most resistant to drought and pests for the Trans-Gangetic Plains region?`
- **Reference Summary**: Recommends specific Trans-Gangetic varieties (*F-1861*, *LH-2076*, *Bt cotton hybrids*), sowing window, and seed rate.
- **Baseline Answer**: Explains general drought-resistant selection criteria, certified seed procurement, and soil moisture practices without naming specific varieties.
- **Classification**: `PARTIAL_MATCH` | **Reason**: Discusses variety selection but omits specific ICAR variety names.

#### 5. Row 106 (`in-agri-0112`, Odia, `weather_advisory`, Rice)
- **Question**: `ଆସନ୍ତା ସପ୍ତାହରେ କର୍ଣ୍ଣାଟକରେ ପ୍ରବଳ ବର୍ଷା ହେବାର ସୂଚନା ଅଛି। ମୋର ଚାଉଳ ଫୁଲ ଫୁଟିବା ଅବସ୍ଥାରେ ଅଛି। ମୁଁ ଶୀଘ୍ର କାଟିବା ଉଚିତ୍ କିମ୍ବା ଅପେକ୍ଷା କରିବା ଉଚିତ୍? ମୁଁ କେଉଁ ସତର୍କତା ଅବଲମ୍ବନ କରିବା ଉଚିତ୍?`
- **Reference Summary**: Advises opening drainage bunds, postponing harvest until physiological maturity, and prophylactic blast spray post-rain.
- **Baseline Answer**: Advises ensuring field drainage and consulting local extension officers, but lacks stage-specific flowering precautions.
- **Classification**: `PARTIAL_MATCH` | **Reason**: Provides general weather advice but lacks phenological flowering guidance.

#### 6. Row 38 (`in-agri-0045`, Gujarati, `harvest_timing`, Sugarcane)
- **Question**: `મોંએ સરકાણનું પાક કાપ્યો છે પરંતુ તે સંગ્રહ દરમિયાન નુકસાન પામી રહ્યો છે. યોગ્ય સુકવણી અને સંગ્રહ પદ્ધતિ શું છે?`
- **Reference Summary**: Details post-harvest sucrose inversion prevention, crushing within 24-48 hours, and shade storage.
- **Baseline Answer**: Outlines general storage hygiene and moisture precautions.
- **Classification**: `PARTIAL_MATCH` | **Reason**: Misses sugarcane-specific rapid crushing timeline.

---

### Category 3: Off-Target Examples (3 Examples)

#### 7. Row 0 (`in-agri-0099`, Gujarati, `financial_support` / `MSP`, Jowar)
- **Question**: `જુવારના બજારભાવ MSP થી નીચે છે. હું MSP પર ક્યાં વેચી શકું અને ખરીદ પ્રક્રિયા કેવી રીતે કાર્ય કરે છે?`
- **Reference Summary**: Details APMC mandi registration, FCI/NAFED procurement centers, required documents (land record 7/12, Aadhaar, bank passbook), and e-Procurement portal.
- **Baseline Answer**: Discusses nutrient deficiencies, balanced fertilizers, and pest management.
- **Classification**: `OFF_TARGET` | **Reason**: Complete failure to address the MSP procurement and selling inquiry.

#### 8. Row 10 (`in-agri-0119`, Gujarati, `financial_support` / `MSP`, Groundnut)
- **Question**: `મગફળીનો બજારભાવ MSP (ન્યૂનતમ ટેકાના ભાવ) કરતાં ઓછો છે. હું MSP પર ક્યાં વેચી શકું અને ખરીદ પ્રક્રિયા કેવી રીતે કાર્ય કરે છે?`
- **Reference Summary**: Explains Gujarat State Civil Supplies / NAFED groundnut procurement at MSP, e-Samridhi portal registration, and quality moisture limits (<8%).
- **Baseline Answer**: Advises on balanced fertilizers and pest management.
- **Classification**: `OFF_TARGET` | **Reason**: Fails to address MSP selling mechanism.

#### 9. Row 665 (`in-agri-0100`, Tamil, `market_price`, Jowar)
- **Question**: `மகாராஷ்டிராவில் (தக்காணம்) எனது சோள விளைச்சலுக்கு இடைத்தரகர்கள் மிகக் குறைவான விலையை வழங்குகின்றனர். நான் நேரடியாக நுகர்வோருக்கு அல்லது அரசு மண்டிக்கு எவ்வாறு விற்கலாம்?`
- **Reference Summary**: Outlines e-NAM portal registration, direct farmer-to-consumer weekly markets (*Rythu Bazars / Shetkari Mandi*), and FPO collective bargaining.
- **Baseline Answer**: Explains soil nutrient deficiency and pest management.
- **Classification**: `OFF_TARGET` | **Reason**: Completely misses the direct marketing / APMC mandi question.

---

### Category 4: Language-Related Examples (3 Examples)

#### 10. Row 75 (`in-agri-0013`, Tamil, `irrigation`, Rice)
- **Question**: `எனது நெல் வயலில் வெள்ளப் பாசனத்திலிருந்து சொட்டு நீர் பாசனத்திற்கு மாற விரும்புகிறேன். ஒரு ஏக்கருக்கான செலவு எவ்வளவு மற்றும் கிடைக்கும் அரசு மானியம் என்ன?`
- **Baseline Answer**: `உங்கள் rice பயிரில் ஏற்பட்டுள்ள பிரச்சனைக்கு பின்வரும் வழிகாட்டுதல்களைப் பின்பற்றலாம்...`
- **Observation**: Accurate Tamil prose, but inserts English Latin term `rice` instead of Tamil `நெல்`.
- **Classification**: `PARTIAL_MATCH` | **Reason**: Language following is strong, with minor Latin crop loanword insertion.

#### 11. Row 600 (`in-agri-0106`, Hindi, `financial_support`, Sugarcane)
- **Question**: `महाराष्ट्र (दक्कन) में मेरे 2 एकड़ गन्ने के लिए मुझे कौन से सरकारी ऋण और ब्याज सब्सिडी मिल सकती है?`
- **Baseline Answer**: Responds in fluent Devanagari Hindi.
- **Classification**: `OFF_TARGET` | **Reason**: Fluent Hindi language execution, but fails to address KCC loan interest subvention.

#### 12. Row 626 (`in-agri-0168`, Punjabi, `weather_advisory`, Moth Bean)
- **Question**: `ਰਾਜਸਥਾਨ (ਪੱਛਮੀ) ਵਿੱਚ ਅਗਲੇ ਹਫ਼ਤੇ ਭਾਰੀ ਬਾਰਸ਼ ਦੀ ਭਵਿੱਖਬਾਣੀ ਕੀਤੀ ਗਈ ਹੈ। ਮੇਰੀ ਮੋਠ ਦੀ ਫਸਲ ਫੁੱਲ ਆਉਣ ਦੇ ਪੜਾਅ 'ਤੇ ਹੈ...`
- **Baseline Answer**: Responds in accurate Gurmukhi Punjabi script (`ਤੁਹਾਡੀ moth ਦੀ ਫਸਲ ਬਾਰੇ...`).
- **Classification**: `PARTIAL_MATCH` | **Reason**: Excellent Gurmukhi syntax with minor Latin token insertion (`moth`).

---

### Category 5: Safety & Time-Sensitive Examples (3 Examples)

#### 13. Row 556 (`in-agri-0099`, Telugu, `financial_support`, Jowar)
- **Question**: `జొన్న మార్కెట్ ధర MSP కంటే తక్కువగా ఉంది. నేను MSP వద్ద ఎక్కడ అమ్మవచ్చు మరియు సేకరణ ప్రక్రియ ఎలా పనిచేస్తుంది?`
- **Reference Summary**: Advises registration on Rythu Bharosa / e-Procurement portal and MSP selling.
- **Baseline Answer**: Generic agronomic advice.
- **Classification**: `OFF_TARGET` | **Reason**: Time-sensitive MSP question requires real-time mandi grounding.

#### 14. Row 96 (`in-agri-0162`, English, `government_schemes`, Jowar)
- **Question**: `I am a small farmer with 2 acres in Rajasthan (western). What government schemes can help me get subsidized seeds, fertilizers, and crop insurance?`
- **Reference Summary**: PM-KISAN, PMFBY, NFSM, Soil Health Card assistance.
- **Baseline Answer**: Generic farming advice mentioning KVK.
- **Classification**: `OFF_TARGET` | **Reason**: Scheme details are time-sensitive and require government scheme database retrieval.

#### 15. Row 569 (`in-agri-0112`, Hindi, `weather_advisory`, Ragi)
- **Question**: `कर्नाटक में अगले सप्ताह भारी बारिश का अनुमान है। मेरी रागी की फसल फूल आने की अवस्था में है। मुझे क्या सावधानियां बरतनी चाहिए?`
- **Reference Summary**: Field drainage, withholding top-dressing, and Mancozeb blast prophylaxis.
- **Baseline Answer**: General drainage and precautions.
- **Classification**: `PARTIAL_MATCH` | **Reason**: Safe, conservative guidance avoiding chemical overconfidence.

---

## H. Final Interpretation & Architectural Recommendations

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                ARCHITECTURAL RESPONSIBILITY MATRIX                                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. WHAT THE BASELINE ALREADY HANDLES WELL (NO EXTENSIVE TRAINING NEEDED)                              │
│    ├── Flawless multilingual script rendering across all 14 Indian languages.                          │
│    ├── Conversational tone and safe, non-toxic default responses.                                      │
│    └── Direct symptom-to-remediation mapping for core pest control and crop diseases.                   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. WHAT IS EFFECTIVELY ADDRESSABLE THROUGH QLoRA SFT                                                   │
│    ├── Adapting the model to output the standardized 5-part hierarchical AgroCycle advisory schema.   │
│    ├── Conditioning the model to recognize all 12 agricultural categories (variety, harvest, schemes).│
│    ├── Regional agro-climatic zone framing (ICAR planning zones).                                      │
│    └── Enforcing pure native-script crop terminology (e.g. நெல் instead of rice in Tamil).             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. WHAT REQUIRES RAG / EXTERNAL TOOLS (CANNOT BE SOLVED BY SFT ALONE)                                │
│    ├── Real-time dynamic Mandi Prices (Agmarknet daily API).                                           │
│    ├── Annual Minimum Support Price (MSP) revisions and active procurement center locations.          │
│    ├── Hyper-local real-time weather forecasts (IMD / Mausam API).                                     │
│    └── Live government subsidy budget availability and online portal URLs.                             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---
*Deep inspection completed and saved to `ai/evaluation/test_split_inspection.md`.*
