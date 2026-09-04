# Translator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deploy to GitHub Pages](https://github.com/FrancoFantomius/translator/actions/workflows/deploy.yml/badge.svg)](https://github.com/FrancoFantomius/translator/actions/workflows/deploy.yml)

A fast, private, 100% client-side neural translation and optical character recognition (OCR) application running entirely in your browser using **WebAssembly**, **ONNX Runtime Web**, and **Transformers.js**.

No text, documents, or images are ever uploaded to an external server — all machine learning models execute locally on your device.

---

## Features

- **100% Private & On-Device**: Translations and image OCR are computed locally inside Web Workers using WebAssembly (WASM CPU SIMD). No telemetry, no third-party APIs, no cloud dependency.
- **100+ Languages Supported**:
  - **Specialized Bilingual Models**: Ultra-fast direct neural translation for major language pairs powered by Helsinki-NLP Opus-MT models (~95 MB, 77M parameters).
  - **Universal Multilingual Model**: Meta M2M-100 (418M parameters) for universal many-to-many translation across 100 languages without English pivoting.
- **In-Browser OCR (Text from Images)**:
  - Text detection with DBNet (`PP-OCRv5_mobile_det`).
  - Multi-script text recognition supporting Latin, Cyrillic, East Slavic, CJK (Chinese, Japanese, Korean), Arabic, Devanagari (Hindi), Greek, and Thai scripts via PaddleOCR PP-OCRv5.
  - Interactive bounding boxes with direct text translation overlays on top of uploaded photos.
- **Instant Language Detection**: Neural language identification powered by Google Compact Language Detector v3 (CLD3) compiled to WebAssembly.
- **Persistent Offline Storage**: Models are cached locally via the browser's Cache Storage API so subsequent visits work without re-downloading weights.
- **Speech-to-Text & Text-to-Speech**: Integrated browser speech synthesis (TTS) and voice recognition.
- **Material Design 3**: Modern, clean UI built with `@francofantomius/material-components`, adhering to M3 tokenized styling, smooth elevation, dynamic themes (Light, Dark, System), and desktop & mobile responsive layouts.
- **Internationalized UI**: The interface is localized in 12 languages (English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Chinese, Japanese, Arabic, and Hindi).

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Web Browser UI                       │
│        (Lit / Material Design 3 Web Components)        │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
      postMessage()              postMessage()
               ▼                          ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│     Translation Worker       │ │          OCR Worker          │
│   (@huggingface/transformers │ │     (onnxruntime-web WASM)   │
│    + ONNX Runtime Web WASM)  │ │                              │
│  - Xenova/opus-mt-* (Q8)     │ │  - PP-OCRv5 Mobile Det       │
│  - Xenova/m2m100_418M (Q8)   │ │  - PP-OCRv5 Mobile Rec       │
│  - Sentence segmentation     │ │  - CLD3 WASM Auto-Detect     │
└──────────────┬───────────────┘ └──────────────┬───────────────┘
               │                                │
               └───────────────┬────────────────┘
                               ▼
               ┌───────────────────────────────┐
               │   CacheStorage API (Browser)  │
               │   (IndexedDB / HTTP Cache)    │
               └───────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) `>= 20.0.0`
- `npm` `>= 9.0.0`

### Installation

```bash
# Clone the repository
git clone https://github.com/FrancoFantomius/translator.git
cd translator

# Install dependencies
npm install
```

### Local Development

Start the Vite development server:

```bash
npm run dev
```

Open your browser at `http://localhost:3000`.

### Building for Production

To create an optimized production bundle in the `dist/` directory:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## Deployment to GitHub Pages

This repository includes an automated GitHub Actions CI/CD workflow (`.github/workflows/deploy.yml`) that builds and publishes the application directly to GitHub Pages on every push to `main`.

### Enabling GitHub Pages on your repository:

1. Push your code to GitHub on the `main` branch.
2. In your GitHub repository, navigate to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. The workflow will automatically trigger, build the assets, and deploy your site to `https://<username>.github.io/<repository-name>/`.

---

## Machine Learning Models & Academic Citations

This application relies on open-weights neural network models developed by the machine learning research community:

### 1. Helsinki-NLP Opus-MT
- **Models**: `Xenova/opus-mt-*` (Bilingual translation models)
- **Creators**: Jörg Tiedemann and Santhosh Thottingal (Language Technology Research Group, University of Helsinki)
- **License**: [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Citation**:
  ```bibtex
  @inproceedings{tiedemann-thottingal-2020-opus,
    title = "{OPUS}-{MT} {--} Building open translation services for the World",
    author = "Tiedemann, J{\"o}rg and Thottingal, Santhosh",
    booktitle = "Proceedings of the 22nd Annual Conference of the European Association for Machine Translation",
    month = nov,
    year = "2020",
    address = "Lisbon, Portugal",
    publisher = "European Association for Machine Translation",
    pages = "479--480",
    url = "https://aclanthology.org/2020.eamt-1.61"
  }
  ```

### 2. Meta M2M-100
- **Model**: `Xenova/m2m100_418M` (Universal multilingual translation model)
- **Creators**: Angela Fan et al. (Meta AI / Facebook AI Research)
- **License**: [MIT License](https://github.com/facebookresearch/fairseq/blob/main/LICENSE)
- **Citation**:
  ```bibtex
  @article{fan2020beyond,
    title={Beyond English-Centric Multilingual Machine Translation},
    author={Fan, Angela and Bhosale, Shruti and Schwenk, Holger and Ma, Zhiyi and El-Kishky, Ahmed and Goyal, Siddharth and Baines, Mandeep and Celebi, Onur and Wenzek, Guillaume and Chaudhary, Vishrav and Goyal, Naman and Birch, Tom and Liptchinsky, Vitaliy and Edunov, Sergey and Grave, Edouard and Auli, Michael and Joulin, Armand},
    journal={arXiv preprint arXiv:2010.11125},
    year={2020}
  }
  ```

### 3. PaddleOCR PP-OCRv5
- **Models**: `PP-OCRv5_mobile_det`, `*_PP-OCRv5_mobile_rec` (ONNX format)
- **Creators**: PaddlePaddle Authors, Baidu Inc.
- **License**: [Apache License 2.0](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE)

### 4. Google Compact Language Detector v3 (CLD3)
- **Module**: `cld3-asm` WebAssembly port by OJ Kwon
- **Creators**: Google LLC
- **License**: [Apache License 2.0](https://github.com/google/cld3/blob/master/LICENSE)

### 5. Transformers.js & ONNX Runtime Web
- **Transformers.js**: Hugging Face Inc. ([Apache-2.0](https://github.com/huggingface/transformers.js/blob/main/LICENSE))
- **ONNX Runtime Web**: Microsoft Corporation ([MIT License](https://github.com/microsoft/onnxruntime/blob/main/LICENSE))

---

## License

This application is licensed under the [MIT License](LICENSE).
See the [LICENSE](LICENSE) file for complete terms and third-party notices.
