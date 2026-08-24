import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      ".contract-tests/**",
      ".sdd/conflicts/**",
      "data/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["scripts/**/*.mjs"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default config;
