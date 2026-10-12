import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["node_modules/**", "playwright-report/**", "test-results/**"] },
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["app.js", "charts.js", "engine.js"], languageOptions: { sourceType: "script", globals: { ...globals.browser, module: "readonly" } } },
  { files: ["tests/**", "*.config.*", "scripts/**"], languageOptions: { globals: globals.node } },
  { files: ["tests/browser/**"], languageOptions: { globals: globals.browser } },
]);
