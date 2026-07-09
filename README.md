# Aqua Insight

Aqua Insight is a Progressive Web App (PWA) and AI-powered aquaculture diagnostic and decision-support platform designed for laboratory analysis and pond health management. It runs entirely on the client side (offline-first) with local edge AI processing.

## 🌟 Key Features

1. **Hematology Analyzer**: Supports both Fish (oval & nucleated) and Mammalian/Human (circular & non-nucleated) blood smear analysis, including cell classification (RBC, WBC, Platelets), erythrocyte indices (MCV, MCH, MCHC), and clinical diagnostics.
2. **Plankton Analyzer**: Automates cell density calculation using Haemocytometer formulas and Shannon-Wiener/Simpson diversity indexes, with an offline LocalStorage database for pond session tracking.
3. **Wet Mount HP Pathologist**: Features circular vignette lens simulation, focus/magnification controls, and interactive contour detection of pathologies (ATM, Melanosis, Lipid coverage) on Shrimp Hepatopancreas.
4. **Electrophoresis Gel Analyzer**: Simulates agarose gels, maps DNA ladder calibration curves using quadratic regression, and estimates sample base pairs (bp) based on migration distance ($Rf$) with pan and zoom image controls.
5. **qPCR Gene Expression Analyzer**: Quantifies relative expression using $2^{-\Delta\Delta C_T}$ (Livak) or Pfaffl efficiency-corrected methods, complete with Welch's t-test significance and SD error propagation.
6. **Colony Counter**: Detects microbial colonies (TSA/NA or TCBS selective media) utilizing local adaptive thresholding (separable box blur) and HSV color profiling to classify Vibrio strains.
7. **Risk Analysis Fuzzy Dashboard**: Employs trapezoidal fuzzy membership logic to estimate risk levels for major shrimp pathogens (WSSV, AHPND, EHP, IMNV) alongside predictive OLS trend regression and sensitivity perturbation modeling.
8. **Bioinformatics Workspace**: Implements online/offline GenBank sequence fetching, Progressive Guide-Tree MSA (UPGMA), and Maximum Likelihood phylogenetic tree reconstruction with 1000x Bootstrap validation.
9. **Statistics Analyzer & Chart Maker**: Professional biostatistics suite offering parametric (t-test, ANOVA, OLS regression) and non-parametric tests (Wilcoxon, Chi-Square), aligned with SPSS output standards, and a custom chart generator.

## 📂 Project Structure

```text
aqua-insight/
├── assets/             # Images, icons, and static visual assets
├── backend/            # Mock server or local mock endpoints
├── css/                # Styling files and theme systems (Vanilla CSS)
├── js/                 # Javascript business logic
│   ├── bio/            # Bioinformatics & genetics
│   ├── charts/         # Custom charting wrappers
│   ├── colony/         # Colony counting algorithms
│   ├── core/           # Core modules, math utilities, i18n, and cv-engine
│   ├── electrophoresis/# Gel alignment and mapping
│   ├── epidemiology/   # Spatial modeling
│   ├── gene/           # qPCR quantification formulas
│   ├── hematology/     # Blood smear processing (fish & mammal)
│   ├── plankton/       # Plankton counting & IndexedDB
│   ├── risk/           # Fuzzy logic risk calculations
│   ├── statistics/     # SPSS-aligned statistical formulas
│   └── wetmount/       # Microscope HP simulation
├── mlops/              # Machine learning training & conversion scripts
├── pages/              # HTML modules and UI layouts
├── tools/              # Utility scripts for translation and maintenance
├── index.html          # Application portal entry
├── manifest.json       # PWA configuration manifest
├── sw.js               # Service Worker for offline-first caching
└── README.md           # Documentation
```

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari).
- (Optional) Node.js if you want to run a local dev server.

### Running Locally

Since Aqua Insight is built as a static Progressive Web App, you can run it simply by opening `index.html` in your web browser. 

Alternatively, you can run a local server for a production-like experience:

Using Node.js (`npx`):
```bash
npx serve .
```

Using Python:
```bash
python -m http.server 8000
```
Open `http://localhost:8000` (or the port specified by serve) in your browser.

## 🔒 Offline & Installation

Aqua Insight is fully compliant with the Progressive Web App (PWA) standard. You can install it on your Desktop or Mobile device directly from the browser address bar. Once installed, it will load and operate fully offline in remote aquaculture sites without internet coverage.
