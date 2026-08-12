# Contributing to ReadEase / Book Vault

Thank you for your interest in contributing to **ReadEase / Book Vault**! We are building an accessibility-first digital reading companion for visually impaired and blind readers worldwide.

---

## 🌟 Code of Conduct

* Be welcoming, inclusive, and respectful to all contributors.
* Focus on accessibility and screen-reader usability when adding new UI elements.
* Give constructive feedback in discussions and pull request reviews.

---

## 🚀 Getting Started

1. **Fork the Repository** on GitHub.
2. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/Book-Vault-Assistant.git
   cd Book-Vault-Assistant
   ```
3. **Create a new branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Set up `.env`**:
   ```bash
   cp .env.example .env
   ```
6. **Initialize the database**:
   ```bash
   npm run setup:db
   ```

---

## 📋 Guidelines for Contributions

### 1. Accessibility First (A11y)
- Ensure all interactive elements have proper `aria-*` tags, `role`, `tabIndex`, or screen-reader labels.
- Provide audio earcons or speech feedback for state changes where applicable.
- Preserve keyboard navigation (e.g., `F` for Face Login, `P` for Password Login, `Enter`, `Escape`).

### 2. Code Quality & Standards
- Run linter before committing:
  ```bash
  npm run lint
  ```
- Keep components modular, reusable, and cleanly organized under `src/components/`, `src/screens/`, `src/services/`, and `src/utils/`.

### 3. Commit Messages
Follow conventional commits:
* `feat: add Tamil voice narration support`
* `fix: prevent camera frame loop leak on unmount`
* `docs: update setup guide for Docker and MySQL`
* `refactor: optimize 128-D facial vector distance computation`

---

## 📬 Submitting a Pull Request

1. Push your changes to your branch on GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Open a Pull Request from your fork against the `main` branch.
3. Describe the problem your PR solves, what you tested, and any UI/Accessibility implications.
4. Link any related issues.

---

## 💡 Questions or Need Help?
Feel free to open an **[Issue](https://github.com/jaishuriya24/Book-Vault-Assistant/issues)** or start a GitHub Discussion!
