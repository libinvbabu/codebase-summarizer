export const DEFAULT_LIMIT = 100;

export const IGNORED_PATHS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/out/**',
  '**/test*/**',
  '**/__tests__/**',
  '**/tmp/**',
  '**/.next/**',
  '**/.git/**',
  '**/logs/**',
  '**/.idea/**'
];

export const MODULE_PATTERNS = [
  'src/modules/*',
  'src/*',
  'packages/*',
  'apps/*'
];

export const SERVICE_PATTERNS = [
  '**/*Service.{js,ts}',
  '**/services/**/*.{js,ts}',
  '**/*Util.{js,ts}',
  '**/*Helper.{js,ts}',
  '**/*utils*.{js,ts}',
  '**/*helper*.{js,ts}',
  '**/*util*.{js,ts}'
];

export const ROUTE_PATTERNS = [
  '**/routes/**/*.{js,ts}',
  '**/controllers/**/*.{js,ts}',
  '**/api/**/*.{js,ts}',
  '**/*router*.{js,ts}',
  '**/*route*.{js,ts}'
];

export const MODEL_PATTERNS = [
  '**/models/**/*.{js,ts}',
  '**/schemas/**/*.{js,ts}',
  '**/entities/**/*.{js,ts}',
  '**/*Model.{js,ts}',
  '**/*Schema.{js,ts}'
];

export const UTIL_PATTERNS = [
  '**/utils/**/*.{js,ts}',
  '**/helpers/**/*.{js,ts}',
  '**/lib/**/*.{js,ts}',
  '**/*util*.{js,ts}',
  '**/*helper*.{js,ts}'
];

export const SOURCE_PATTERNS = [
  'src/**/*.{js,ts}',
  '**/*.{js,ts}'
];
