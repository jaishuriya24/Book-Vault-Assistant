# 📖 ReadEase / Book Vault

An accessibility-first digital reading companion designed specifically for blind, visually impaired, and hands-free readers. Features voice-guided page scanning, real-time object alignment, facial biometric authentication, and interactive audio narration.

---

## 🌟 Key Features

* **Biometric Face Login & Enrollment**: Real-time facial vector recognition (128-D Euclidean distance metric) with audio earcon feedback.
* **Voice-Guided Page Scanner**: Computer-vision powered guidance (COCO-SSD & adaptive thresholding) to instruct users on camera framing (*"Move left"*, *"Hold still"*).
* **Interactive Document Reader**: Natural Text-to-Speech audio synchronization with reading cursor tracking.
* **Multilingual Intent Parsing**: Gemini & NLP-powered voice intent parsing for hands-free navigation.
* **Secure MySQL Data Persistence**: Dedicated tables for user accounts, biometric embeddings, books, collections, and reading progress.

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, TailwindCSS, Lucide React, GSAP, Three.js / OGL
* **AI & Computer Vision**: TensorFlow.js, COCO-SSD, Tesseract.js, ONNX Runtime Web, Gemini 2.0 / 1.5 Flash API
* **Backend**: Node.js, Express.js (Port 3001), `mysql2`
* **Speech & Audio**: Web Speech API (`SpeechSynthesis` & `SpeechRecognition`), ElevenLabs TTS

---

## 🚀 Teammate Setup Guide

Follow these steps to run the complete project locally:

### 1. Prerequisites

* **Node.js** (v18.x or higher) & **npm**
* **MySQL Server** (Local instance or remote MySQL database)
* Modern web browser with Webcam and Microphone permissions (Google Chrome or Microsoft Edge recommended)

---

### 2. Installation

Clone the repository and install all required dependencies:

```bash
git clone https://github.com/jaishuriya24/Book-Vault-Assistant.git
cd Book-Vault-Assistant
npm install
```

---

### 3. Environment Variables Configuration

Copy the example environment file:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# macOS / Linux / Git Bash
cp .env.example .env
```

Open `.env` in your editor and configure your MySQL credentials and optional API keys:

```env
# Server & API Ports
PORT=3001
VITE_SERVER_URL="http://localhost:3001"
VITE_SPRING_BOOT_AUTH_URL="http://localhost:3001"
VITE_SPRING_BOOT_API_URL="http://localhost:3001"

# MySQL Database Configuration
MYSQL_HOST="localhost"
MYSQL_PORT=3306
MYSQL_USER="root"
MYSQL_PASSWORD="your_mysql_password"
MYSQL_DB="book_vault_db"

# AI Voice & Intent Parsing (Optional for enhanced NLP)
GEMINI_API_KEY="your_gemini_api_key"
VITE_GEMINI_API_KEY="your_gemini_api_key"
VITE_OPENROUTER_API_KEY="your_openrouter_api_key"
VITE_ELEVENLABS_API_KEY="your_elevenlabs_api_key"
```

---

### 4. Database Setup & Initialization

Run the automated database setup script to create all required tables, constraints, and indexes:

```bash
npm run setup:db
```

---

### 5. Running the Application

You need both the backend server and the frontend Vite dev server running:

#### Terminal 1 — Backend API Server (Port 3001)
```bash
npm run server
```

#### Terminal 2 — Frontend Client (Port 5173)
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗺️ Application Routes

| Route | View | Description |
|---|---|---|
| `/` or `/signin` | `SignIn.jsx` | Main Sign-In page. Biometric face detection or password credentials (toggle with `F` / `P` keys). |
| `/signup` | `SignUp.jsx` | User Registration & Face Biometric enrollment. |
| `/facelogin` | `FaceLogin.jsx` | Standalone voice-guided face login flow. |
| `/library` | `MyBookCollection` | Dashboard showing personal book collection, shelf categories, and read history. |
| `/reader/:id` | `InteractiveBook.jsx` | Accessible audio reader with synchronized document viewer. |
| `/add-book` | `BookScanner.jsx` | Document upload and Live Camera Voice Scanner. |
| `/profile` | `ProfileScreen.jsx` | Account preferences, speech rate, and language options. |

---

## 🧪 Verification & Test Scripts

* **Test Biometric MySQL Storage & Login**:
  ```bash
  node test_biometric_mysql.cjs
  ```
* **Test Database Connection**:
  ```bash
  node test_db.cjs
  ```
* **Lint Codebase**:
  ```bash
  npm run lint
  ```
