module.exports = {
  // Environment: Defines global variables available in your code
  env: {
    browser: true, // Browser global variables (window, document, etc.)
    es2021: true, // ES2021 globals and syntax
    node: true, // Node.js global variables (process, __dirname, etc.)
  },

  // Extends: Use recommended rule sets from plugins
  extends: [
    'eslint:recommended', // ESLint core recommended rules
    'plugin:react/recommended', // React-specific linting rules
    'plugin:react-hooks/recommended', // Rules for React Hooks
    'plugin:jsx-a11y/recommended', // Accessibility rules for JSX
    'plugin:import/recommended', // Import/export validation rules
    'prettier', // Disable formatting rules that conflict with Prettier
    'plugin:prettier/recommended', // Prettier integration (must be last)
  ],

  // Parser options: How ESLint should parse your code
  parserOptions: {
    ecmaVersion: 'latest', // Support latest ECMAScript features
    sourceType: 'module', // Use ES modules (import/export)
    ecmaFeatures: {
      jsx: true, // Enable JSX syntax
    },
  },

  // Plugins: Additional ESLint plugins to enable
  plugins: ['react', 'react-hooks', 'jsx-a11y', 'import'],

  // Settings: Shared settings for plugins
  settings: {
    react: {
      version: 'detect', // Automatically detect React version
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx'], // Resolve these file extensions
      },
    },
  },

  // Rules: Customize or override rules
  rules: {
    // ===== Code Correctness =====
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_', // Ignore variables starting with _
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true, // Ignore rest properties in destructuring
      },
    ],
    'no-console': 'off', // Allow console.log (useful for debugging)
    'no-debugger': 'warn', // Warn on debugger statements
    'no-constant-condition': 'warn', // Warn on constant conditions in loops
    'no-undef': 'error', // Error on undefined variables

    // ===== Formatting (handled by Prettier) =====
    indent: 0, // Prettier handles indentation
    quotes: 0, // Prettier handles quotes
    semi: 0, // Prettier handles semicolons

    // ===== Modern JavaScript Best Practices =====
    'prefer-const': 'warn', // Prefer const over let when not reassigned
    'no-var': 'error', // Disallow var, use let/const
    'prefer-arrow-callback': 'warn', // Prefer arrow functions for callbacks
    'prefer-template': 'warn', // Prefer template literals over string concat
    'object-shorthand': 'warn', // Prefer shorthand object property syntax
    'prefer-destructuring': [
      'warn',
      {
        array: false, // Don't enforce array destructuring
        object: true, // Enforce object destructuring
      },
    ],

    // ===== React Specific =====
    'react/prop-types': 'off', // Disable prop-types (using modern practices)
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/jsx-uses-react': 'off', // Not needed in React 17+
    'react/jsx-filename-extension': [
      'warn',
      {
        extensions: ['.js', '.jsx'], // Allow JSX in .js and .jsx files
      },
    ],
    'react/jsx-key': 'error', // Require key prop in lists
    'react/no-unescaped-entities': 'warn',
    'react/no-array-index-key': 'warn', // Warn against using array index as key

    // ===== React Hooks =====
    'react-hooks/rules-of-hooks': 'error', // Enforce hooks rules
    'react-hooks/exhaustive-deps': 'warn', // Warn on missing dependencies

    // ===== Import/Export =====
    'import/no-unresolved': 'off', // Turn off (handled by bundler)
    'import/named': 'off', // Turn off (handled by bundler)
    'import/order': [
      'warn',
      {
        groups: [
          'builtin', // Node built-in modules
          'external', // npm packages
          'internal', // Internal modules
          'parent', // Parent directories
          'sibling', // Sibling files
          'index', // Index files
        ],
        'newlines-between': 'never', // No newlines between import groups
        alphabetize: {
          order: 'asc', // Sort alphabetically
          caseInsensitive: true, // Ignore case
        },
      },
    ],

    // ===== Readability and Consistency =====
    semi: ['warn', 'always'], // Require semicolons
    quotes: [
      'warn',
      'single',
      {
        avoidEscape: true, // Allow double quotes to avoid escaping
        allowTemplateLiterals: true, // Allow template literals
      },
    ],
    'comma-dangle': [
      'warn',
      {
        arrays: 'always-multiline', // Trailing comma in multiline arrays
        objects: 'always-multiline', // Trailing comma in multiline objects
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never', // No trailing comma in function params
      },
    ],
    indent: [
      'warn',
      2,
      {
        // 2-space indentation
        SwitchCase: 1, // Indent case clauses
      },
    ],
    'max-len': [
      'warn',
      {
        code: 120, // Max line length
        ignoreStrings: true, // Ignore long strings
        ignoreTemplateLiterals: true, // Ignore long template literals
        ignoreComments: true, // Ignore long comments
      },
    ],
    'no-multiple-empty-lines': [
      'warn',
      {
        max: 1, // Max 1 empty line
        maxEOF: 0, // No empty lines at end of file
      },
    ],
    'eol-last': ['warn', 'always'], // Require newline at end of file

    // ===== Accessibility =====
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
  },
};
