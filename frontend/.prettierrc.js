module.exports = {
  // Formatting options
  semi: true, // Add semicolons
  singleQuote: true, // Use single quotes instead of double
  trailingComma: 'es5', // Add trailing commas where valid in ES5
  tabWidth: 2, // 2 spaces per indentation level
  useTabs: false, // Use spaces instead of tabs
  printWidth: 120, // Line length (same as ESLint max-len)
  bracketSpacing: true, // Spaces between brackets in objects
  arrowParens: 'always', // Always include parens for arrow functions
  endOfLine: 'lf', // Unix line endings
  jsxSingleQuote: false, // Use double quotes in JSX

  // File-specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        proseWrap: 'always',
        printWidth: 80,
      },
    },
  ],
};
