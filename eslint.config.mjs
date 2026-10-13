import next from "eslint-config-next/core-web-vitals";

const config = [
  ...next,
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "next-env.d.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // TypeScript estricto: no se permite `any` sin justificación comentada.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
