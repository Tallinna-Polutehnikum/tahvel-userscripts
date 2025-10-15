# Development Guide

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the userscript:
   ```bash
   npm run build
   ```
   The bundled `.user.js` file will be generated inside the **`build/`** folder.

---

## Project Structure

- **`src/`** – Contains all source code.
  - The main entry point is **`index.js`**.
  - Import any feature or utility files into `index.js` to include them in the final build.

- **`header.js`** – Contains the Tampermonkey metadata block (e.g., `// ==UserScript==`).
  - This header is automatically prepended to the bundled output.

---

## Development Notes

- Keep each feature in its own file within `src/` for better organization.
- Use `npm run build` whenever you add or modify files to regenerate the final script.
- For faster iteration, you can add a `watch` script to rebuild automatically:
  ```bash
  npm run watch
  ```
