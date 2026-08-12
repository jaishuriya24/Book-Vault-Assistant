<div align="center">

# 📖 ReadEase / Book Vault
### *An Accessibility-First, AI-Powered Digital Reading Companion*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-Object_Detection-FF6F00.svg?logo=tensorflow)](https://www.tensorflow.org/js)
[![MySQL](https://img.shields.io/badge/MySQL-Relational_Store-4479A1.svg?logo=mysql)](https://www.mysql.com/)
[![Accessibility](https://img.shields.io/badge/A11y-Voice_&_Audio_Guided-brightgreen.svg)](#-accessibility-features)

<p align="center">
  <b>ReadEase</b> is an open-source, voice-navigated reading assistant specifically engineered for <b>blind, visually impaired, and hands-free users</b>. It combines real-time computer vision, voice direction, biometric facial authentication, and synchronized audio narration into a unified reading vault.
</p>

[Quick Start](#-quick-start) •
[Features](#-key-features) •
[Architecture](#-system-architecture) •
[A11y & Keybindings](#-accessibility-features) •
[Contributing](#-contributing) •
[License](#-license)

</div>

---

## 🌟 Key Features

* **👁️ Face Biometric Authentication**:
  Passwordless login using a 128-D normalized facial vector matching algorithm with instant audio chime (880Hz) / error earcon (330Hz) feedback.
* **🎙️ Voice-Guided Camera Alignment**:
  Real-time object detection (COCO-SSD) and stability tracking that instructs the user verbally (*"Move camera left"*, *"Move closer"*, *"Perfect. Hold still"*).
* **📄 Automatic Page Deskew & OCR**:
  Captures book pages upon camera stabilization, cleans and deskews images, extracts text via OCR, and saves pages to your personal digital library.
* **🗣️ Synchronized Audio Reader**:
  Hands-free interactive reader with browser `SpeechSynthesis` and optional ElevenLabs high-fidelity neural voices, synchronized with reading cursor positions.
* **🧠 Multilingual Voice Intent Engine**:
  Natural voice command classification powered by Google Gemini and local NLP algorithms for searching books, flipping pages, adjusting volume, or asking contextual questions.

---

## 🏛️ System Architecture

```text
               +----------------------------------------------------+
               |                User (Voice & Audio)                |
               +----------------------------------------------------+
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
       [ Frontend (React 19 + Vite) ]             [ Biometric / Camera Feed ]
       ├─ VoiceAuthGate (Earcons / Speech)        ├─ Face Descriptor Vector (128-D)
       ├─ InteractiveBook Reader                  ├─ COCO-SSD Document Alignment
       └─ VoiceScanner (Live Camera Guide)        └─ Stability & Blur Detection
                   │
                   ▼ (HTTP / REST API)
       [ Node.js Backend Server (Port 3001) ]
       ├─ /api/auth/*       ── Biometric Comparison & Credential Verification
       ├─ /api/books/*      ── Shelf & Collection Management
       ├─ /api/save-page    ── OCR Text Persistence & Image Storage
       └─ /api/parse-intent ── Gemini AI NLP Voice Intent Classification
                   │
                   ▼
       [ MySQL Database (Port 3306) ]
       ├─ book_vault_users  (Credentials & 128-D Biometrics)
       ├─ books             (Titles, Authors, Shelf Locations)
       └─ book_pages        (OCR Text, Page Ordering, Perceptual Hashes)
```

---

## ⚡ Quick Start

### Prerequisites
Make sure you have installed on your machine:
* **Node.js** (v18.x or higher) — [Download](https://nodejs.org/)
* **npm** (comes with Node.js)
* **MySQL Server** (Local or remote instance) — [Download](https://dev.mysql.com/downloads/installer/)
* A modern browser with **Webcam & Microphone permissions** (Google Chrome or Microsoft Edge recommended)

---

### 1. Clone the Repository
```bash
git clone https://github.com/jaishuriya24/Book-Vault-Assistant.git
cd Book-Vault-Assistant
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create your local configuration file from the template:

**On Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**On macOS / Linux:**
```bash
cp .env.example .env
```

Open `.env` and configure your local MySQL credentials:
```env
# Server Port
PORT=3001
VITE_SERVER_URL="http://localhost:3001"
VITE_SPRING_BOOT_AUTH_URL="http://localhost:3001"
VITE_SPRING_BOOT_API_URL="http://localhost:3001"

# MySQL Database Settings
MYSQL_HOST="localhost"
MYSQL_PORT=3306
MYSQL_USER="root"
MYSQL_PASSWORD="your_password_here"
MYSQL_DB="book_vault_db"

# AI Voice Keys (Optional - works with default fallback)
GEMINI_API_KEY=""
VITE_GEMINI_API_KEY=""
```

### 4. Initialize Database Tables
Execute the automated database setup script to create all relational schemas, audit views, and demo records:
```bash
npm run setup:db
```

### 5. Launch the Application
Start the backend server and frontend development server in separate terminals:

* **Terminal 1 (Backend API on Port 3001):**
  ```bash
  npm run server
  ```

* **Terminal 2 (Frontend Client on Port 5173):**
  ```bash
  npm run dev
  ```

Open your browser at **[http://localhost:5173](http://localhost:5173)**!

---

## ♿ Accessibility Features

ReadEase is built from the ground up for full screen-reader and keyboard accessibility:

| Shortcut / Trigger | Action | Description |
|---|---|---|
| <kbd>F</kbd> | Switch to Face Login | Activates camera and initiates voice-guided facial biometric recognition. |
| <kbd>P</kbd> | Switch to Password Login | Switches the authentication panel to standard accessible text inputs. |
| <kbd>Space</kbd> / <kbd>Enter</kbd> | Play / Pause Reader | Toggles speech playback inside the document viewer. |
| **Voice Command** | *"Search [Title]"* | Finds a book by title or shelf location. |
| **Voice Command** | *"Open Camera"* / *"Scan"* | Triggers the camera alignment and scanner module. |
| **Audio Feedback** | **Earcon Chimes** | High-frequency chimes (880Hz) indicate success; low pulses (330Hz) signal errors. |

---

## 📂 Project Directory Structure

```text
Book-Vault-Assistant/
├── .github/                   # GitHub Issue & PR templates
├── backend/                   # Backend microservices & configs
├── public/                    # Static assets, models, and icons
├── src/
│   ├── app/                   # App root component and router
│   ├── components/            # Reusable UI components (SpotlightCards, UI gates)
│   ├── hooks/                 # Custom React hooks (useBookScanner, etc.)
│   ├── screens/               # Screen views (auth, library, reader, scanner)
│   ├── services/              # API clients, Gemini NLP, and ElevenLabs TTS
│   ├── utils/                 # Biometrics (128-D vector), OpenCV, Blur/Stability detector
│   └── voice/                 # Speech prompts and voice navigation handlers
├── .env.example               # Example environment variable template
├── CONTRIBUTING.md            # Guidelines for open-source contributors
├── LICENSE                    # MIT Open-Source License
├── package.json               # Dependencies and build scripts
├── README.md                  # Project documentation
├── server.js                  # Express API proxy and MySQL endpoints
├── setup_mysql.cjs            # Database schema creator script
└── vite.config.js             # Vite configuration
```

---

## 🧪 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts Vite local development server on `http://localhost:5173`. |
| `npm run server` | Starts Express backend server on `http://localhost:3001`. |
| `npm run setup:db` | Initializes MySQL tables, constraints, and demo data. |
| `npm run build` | Builds the production bundle in the `dist/` directory. |
| `npm run lint` | Runs the Oxlint static code analyzer. |
| `node test_biometric_mysql.cjs` | Runs an automated test of the 128-D facial biometrics pipeline. |

---

## 🤝 Contributing

We welcome all contributions, ideas, bug reports, and accessibility improvements!

1. Check out our [Contributing Guide](CONTRIBUTING.md).
2. Look at open issues or submit a [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) / [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md).
3. Fork the repository, create your branch (`feature/amazing-feature`), and open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">
  <sub>Built with ❤️ for inclusive, accessible reading worldwide.</sub>
</div>
