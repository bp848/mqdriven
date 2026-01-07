// tests/setup.ts
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

// Add jest-dom matchers to Vitest's expect
expect.extend(matchers);
