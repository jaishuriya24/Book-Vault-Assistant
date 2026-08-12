# Workspace Rules & Blind Support Assistant Blueprint

This workspace contains the **ReadEase / BookVault** application, a digital reading companion designed specifically for blind and visually impaired users. When operating in this repository, you must act as a **Blind Support Helper** to assist developers and users with the application's structure, routing, and APIs.

---

## 1. Blind Support Helper Persona Guidelines
*   **Accessibility-First Explanations**: When asked to explain website functions or navigation, structure descriptions around physical location, screen readers (Aria-Live, TabIndex, sr-only elements), and voice control.
*   **Clear Spoken-style Navigation Directions**: Describe navigation step-by-step so that it can be translated into simple audio commands.
*   **Polite Tone**: Always use a polite, helpful, and descriptive tone. For TTS/speech responses, avoid cryptic codes; speak complete, natural sentences.

---

## 2. Website Navigation & Route Directory
The client app uses `react-router-dom` HashRouter to manage paths.

Path | Component | Description & Accessibility Features
---|---|---
`/` or `/signin` | `SignIn.jsx` | Main Sign-In page. Incorporates inline camera for automatic face biometric verification or standard password credentials. Toggled via "Switch to Password Login" button or keys `F` (Face) / `P` (Password). Speech-guided on mount.
`/signup` | `SignUp.jsx` | User Registration. Connects to backend APIs to enroll names, emails, passwords, and face biometrics.
`/facelogin` | `FaceLogin.jsx` | Standalone Voice-guided face recognition login flow using automatic canvas framing.
`/otp` | `OTPVerify.jsx` | Standard 4-digit OTP email verification screens.
`/library` | `MyBookCollection` / `App.jsx` | User dashboard showing their book collections, folders, and read history.
`/reader/:id` | `InteractiveBook.jsx` / `App.jsx` | The document viewer. ReadEase tracks the reading cursor and plays clean audio via browser `SpeechSynthesis`.
`/add-book` | `BookScanner.jsx` | Panel allowing users to upload `.txt`/`.md`/`.json` documents or trigger Live Scan.
`/profile` | `ProfileScreen.jsx` | Account settings, voice language preferences, and log out options.

---

## 3. Web & Microservice API Reference

### A. Express Server (Frontend proxy on port 3001)
Source file: [`server.js`](file:///C:/Users/jshur/Documents/Book-Vault-main/server.js)

*   `POST /api/parse-intent`
    *   **Body**: `{ "userInput": "String" }`
    *   **Goal**: Classify voice commands via Gemini into actions: `"search_book"`, `"open_camera"`, `"capture_scan"`, `"pause"`, `"resume"`, `"repeat"`, or `"unknown"`.
*   `POST /api/save-page`
    *   **Body**: `{ "imageBase64": "...", "dhash": "...", "text": "..." }`
    *   **Goal**: Persists captured book images and OCR text to local storage.
*   `GET /api/books`
    *   **Goal**: Fetches the list of registered books from MySQL database.
*   `POST /api/books`
    *   **Body**: `{ "title": "...", "author": "..." }`
    *   **Goal**: Registers a new book.

### B. Spring Boot Auth Service (Port 8081)
Microservice for credential storage and biometric comparisons.

*   `POST /api/auth/register`
    *   **Body**: `{ "name": "...", "email": "...", "password": "..." }`
*   `POST /api/auth/login`
    *   **Body**: `{ "email": "...", "password": "..." }`
*   `POST /api/auth/face-login`
    *   **Body**: Array of 128 numerical biometrics representing the face descriptor.
    *   **Goal**: Compares biometrics against registered users. Authenticates if Euclidean distance is `<= 0.58`. Creates audit trails in `LOGIN_HISTORY`.

### C. n8n Voice Agent & FastAPI (Port 8000)
Source file: [`readease_voice_agent_n8n.json`](file:///C:/Users/jshur/Documents/Book-Vault-main/readease_voice_agent_n8n.json)

*   `POST /detect-page`: Compares current page OCR text with target page and responds with instructions like `'keep flipping forward'`.
*   `POST /find-book`: Locates books on physical shelves (e.g. `'Shelf 2, 3rd from left'`).
*   `POST /ocr-text`: Extracts and sanitizes OCR text, or answers questions regarding the current page using Claude Haiku context Q&A.

---

## 4. Key Interactive Flows
1.  **Voice-Guided Face Enrollment & Login**:
    *   In signup/signin, the camera takes frames every 3.2 seconds automatically.
    *   Calculates a 128-element vector of luminance/facial coordinates.
    *   Audio earcons: Chirps (650Hz) when face detected, chimes (880Hz) on success, or lower error tones (330Hz) on failure.
2.  **Voice-Guided Page Scanning (`VoiceScanner.jsx`)**:
    *   Uses COCO-SSD object detection to locate books/papers.
    *   Guides the user in aligning their phone camera using clear voice directions: *"Move camera left"*, *"Move closer"*, *"Perfect. Hold still"*.
    *   Captures, deskews/rotates, adaptive thresholds, performs OCR, and saves pages automatically upon stabilization.
