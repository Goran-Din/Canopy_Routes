// frontend/tailwind.config.ts
// Tailwind CSS configuration for Canopy Routes frontend
// Last modified: 2026-03-04

import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'cr-navy': '#1B3A5C',
        'cr-blue': '#2E75B6',
        'cr-green': '#2E8B57',
        'cr-purple': '#6B3FA0',
        'cr-orange': '#D4760A',
        'cr-teal': '#0D7377',
        'cr-yellow': '#F59E0B',
        'cr-red': '#DC2626',
        'cr-grey': '#9E9E9E',
        'cr-surface': '#F7F8FA',
        'cr-border': '#E2E8F0',
        'cr-text': '#1A202C',
        'cr-text-muted': '#718096',
      },
    },
  },
  plugins: [forms],
} satisfies Config;
