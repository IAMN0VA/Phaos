# PHAOS

PHAOS is a browser-based medical imaging exploration platform designed to make CT, MRI, X-ray, and other medical imaging easier to explore and understand.

The goal is to give students and the general public an interactive way to navigate real medical scans using 2D slices, 3D reconstruction, anatomical references, measurements, and guided educational tools.

PHAOS is built for **education and visualization only**. It is not intended for diagnosis, treatment, or clinical decision-making.

---

## Features

- DICOM file, folder, and ZIP support
- 3D volume reconstruction
- Axial, sagittal, and coronal MPR views
- Synchronized crosshairs
- CT window presets
- Thermal, grayscale, skeletal, and pseudocolor visualization modes
- Anatomical search and reference system
- Structure focus and isolation
- Circle & Identify reference matching
- Measurements and ROI tools
- HU / voxel probe
- Cine playback
- Study Mode
- Explore Mode
- Demo Mode
- Local browser-based image processing
- PHI-conscious exports and diagnostics
- Interactive thermal particle loading animation

---

## Anatomy Engine

PHAOS is being developed around a deterministic, non-AI anatomy engine.

Instead of using a machine-learning model to guess anatomical structures, PHAOS is being designed to use:

- DICOM spatial metadata
- patient-space coordinates
- regional anatomical atlases
- major anatomical landmarks
- tissue characteristics
- geometric relationships
- atlas registration
- structured anatomical rules

For example, an ACL reference may be defined using relationships such as:

```text
Region: Knee
Type: Ligament
Between: Femur + Tibia
Near: Intercondylar Notch
Anterior to: PCL
Attached to: Femur + Tibia
```

The long-term goal is to create body-wide regional atlases that PHAOS can align to individual scans.

---

## Planned Atlas Development

### Phase 1

- Knee
- Shoulder
- Ankle
- Wrist
- Elbow
- Hip
- Hand
- Foot

### Phase 2

Improve and validate the Phase 1 atlases across a wider range of scans.

### Phase 3

- Spine
- Brain / Head
- Chest
- Abdomen
- Pelvis

### Phase 4

Expand into finer anatomical structures including:

- vessels
- nerves
- muscles
- tendons
- ligaments
- smaller anatomical substructures

---

## Circle & Identify

PHAOS includes an experimental deterministic anatomy-reference identifier.

Instead of comparing a selected area against one fixed coordinate, the enhanced system is intended to evaluate:

```text
Body region
↓
Spatial location
↓
Nearby anatomical landmarks
↓
Anatomical relationships
↓
Tissue characteristics
↓
Ranked reference matches
```

Results are presented as **reference matches**, not detected anatomy or diagnostic findings.

---

## Study Mode

Study Mode is designed for biology, health-science, anatomy, and medical-imaging education.

Planned educational features include:

- guided anatomy exploration
- structure hide / reveal
- anatomy learning objectives
- imaging-plane guidance
- interactive regional lessons
- anatomy relationships
- modality education
- structured learning modules

---

## Project Team

PHAOS is being developed as an interdisciplinary project combining software engineering, anatomy, medical-imaging education, cybersecurity, and privacy.

### Product & Engineering

Responsible for:

- application architecture
- DICOM processing
- 3D reconstruction
- viewer development
- anatomy-engine implementation
- UI / UX
- releases

### Anatomy & Biological Data

Responsible for:

- regional anatomy atlases
- structure names and aliases
- anatomical classifications
- landmarks
- anatomical relationships
- hierarchy
- source validation

### Medical Imaging Education

Responsible for:

- guided anatomy exploration
- imaging education
- learning objectives
- Study Mode content
- educational explanations
- modality and plane guidance

### Security & Privacy

Responsible for:

- threat modeling
- PHI leakage testing
- malicious-input testing
- browser security
- dependency review
- privacy architecture
- deployment hardening

---

## Privacy

PHAOS is designed around local browser processing.

Medical-image pixel data is intended to remain on the user's device during normal use.

PHAOS does not require medical images to be permanently uploaded to a remote server for visualization.

Users should still be aware that normal website requests may expose standard technical information such as IP address, browser information, and request metadata to the hosting provider.

Screenshots, exports, filenames, DICOM metadata, and user-created labels may still contain identifying information and should be handled appropriately.

---

## Intended Use

PHAOS is intended for:

- anatomy education
- medical-imaging education
- visualization
- research and experimentation
- technical demonstrations
- non-clinical exploration of medical-image data

PHAOS is **not intended for**:

- diagnosis
- treatment decisions
- detecting disease
- identifying tumors or fractures
- determining whether anatomy is normal or abnormal
- surgical planning
- clinical interpretation
- replacing PACS or diagnostic workstations
- scanner calibration or certification

---

## Technology

PHAOS currently uses technologies including:

- JavaScript
- Vite
- Cornerstone3D
- Cornerstone DICOM Image Loader
- Cornerstone Tools
- VTK.js
- WebGL
- Canvas
- browser-based DICOM processing

---

## Running PHAOS Locally

Install dependencies:

```bash
npm install
```

Run development mode:

```bash
npm run dev
```

Run project validation:

```bash
npm run launch:check
```

Create a production build:

```bash
npm run build
```

---

## Current Status

PHAOS is actively under development.

Current work is focused on:

- improving the anatomy engine
- building regional anatomical atlases
- improving deterministic Circle & Identify
- expanding Study Mode
- validating anatomy references
- improving performance
- strengthening privacy and security
- testing across different DICOM studies

---

## Important Disclaimer

PHAOS is an educational and experimental software project.

It should not be relied upon for medical diagnosis, treatment, patient management, or other clinical decision-making.

Anatomical highlighting, identification, isolation, and reference matching within PHAOS represent educational references and should not be interpreted as confirmed identification of structures within an individual patient's scan.

---

## Version

Current development version: **PHAOS v1.5.5**
