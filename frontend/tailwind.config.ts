// frontend/tailwind.config.ts
// Tailwind CSS configuration for Canopy Routes frontend
// Last modified: 2026-03-04

import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [forms],
} satisfies Config;
