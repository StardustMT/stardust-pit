import js from "@eslint/js"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import storybook from "eslint-plugin-storybook"
import globals from "globals"

// react-refresh/only-export-components is a Vite HMR hint, not a code-quality
// rule. We mix components + helpers in the same files intentionally; running
// it as a warning produces noise without catching real bugs. Disabled.

export default tseslint.config(
  {
    ignores: ["dist", "storybook-static", "node_modules"],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.stories.{ts,tsx}"],
    ...storybook.configs["flat/recommended"][0],
    rules: {
      ...(storybook.configs["flat/recommended"][0].rules ?? {}),
      "react-hooks/rules-of-hooks": "off",
    },
  },
)
