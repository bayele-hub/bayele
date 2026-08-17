import type { Config } from 'tailwindcss';

/**
 * Bayele design tokens — derived from the brand logo: a bold blue "b" with an
 * orange dot on white. Light, trustworthy, fintech-marketplace. The orange dot is
 * the signature motif reused across the product (the "." in Bayele, live status,
 * step markers). See SKILL.md §6.
 */
const preset = {
  theme: {
    extend: {
      colors: {
        ink: '#0B1B2B',        // deep navy text
        muted: '#5A6B7B',      // secondary text
        line: '#E6EBF1',       // hairlines / borders
        surface: '#F7F9FC',    // soft card / section background
        brand: {
          DEFAULT: '#1268B8',  // logo blue
          600: '#0E5AA3',
          700: '#0B4E92',
          50: '#EAF2FB',
          100: '#D3E4F7',
          fg: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#F7940A',  // logo orange dot — the signature
          soft: '#FEF1DF',
        },
        momo: { mtn: '#FFCC00', orange: '#FF6A00', wave: '#1DC6E8' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      spacing: { tap: '3rem' }, // 48px min tap target (invariant #10)
      boxShadow: {
        card: '0 1px 2px rgba(11,27,43,0.04), 0 8px 24px -12px rgba(11,27,43,0.12)',
        cardHover: '0 2px 4px rgba(11,27,43,0.06), 0 16px 40px -16px rgba(18,104,184,0.28)',
      },
    },
  },
  plugins: [],
} satisfies Partial<Config>;

export default preset;
