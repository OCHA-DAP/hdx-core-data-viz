import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import astro from "eslint-plugin-astro";
import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ts.configs.recommended,
  ...astro.configs["flat/recommended"],
  ...svelte.configs["flat/recommended"],
  prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
  },
);
