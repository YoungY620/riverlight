import tsParser from "@typescript-eslint/parser";

const primitives = [
  { selector: "JSXOpeningElement[name.name='button']", message: "Use the installed Button component." },
  { selector: "JSXOpeningElement[name.name='table']", message: "Use the installed Table component." },
  { selector: "JSXOpeningElement[name.name='input']", message: "Use the installed Input component." },
  { selector: "JSXOpeningElement[name.name='textarea']", message: "Use the installed Textarea component." },
];

export default [
  { ignores: ["dist/**", "android/**", "ios/**"] },
  {
    files: ["src/**/*.{tsx,jsx}"],
    ignores: ["src/components/ui/**", "**/*.{test,spec}.{tsx,jsx}", "**/__tests__/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { "no-restricted-syntax": ["warn", ...primitives] },
  },
];
