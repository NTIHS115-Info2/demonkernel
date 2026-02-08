module.exports = [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        sourceType: "script"
      }
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin")
    },
    rules: {
      "no-var": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn"]
    }
  }
];
