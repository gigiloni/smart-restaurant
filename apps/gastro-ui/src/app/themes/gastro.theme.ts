import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const GastroTheme = definePreset(Aura, {
  components: {
    select: {
      root: {
        background: 'var(--surface-raised)',
        disabledBackground: 'var(--surface-soft)',
        color: 'var(--text)',
        disabledColor: 'var(--text-muted)',
        placeholderColor: 'var(--text-muted)',
        borderColor: 'var(--border)',
        hoverBorderColor: 'var(--text-muted)',
        focusBorderColor: 'var(--light-accent)',
        borderRadius: 'var(--radius-md)',
        paddingX: '1.1rem',
        paddingY: '0.9rem',
        focusRing: {
          width: '2px',
          style: 'solid',
          color: 'var(--light-accent)',
          offset: '2px',
        },
      },
      dropdown: { color: 'var(--text-muted)' },
      overlay: {
        background: 'var(--surface-raised)',
        color: 'var(--text)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius-md)',
        shadow: 'var(--shadow-panel)',
      },
      option: {
        color: 'var(--text)',
        focusColor: 'var(--text)',
        selectedColor: 'var(--text)',
        selectedFocusColor: 'var(--text)',
        focusBackground: 'var(--surface-hover)',
        selectedBackground: 'var(--red-accent)',
        selectedFocusBackground: 'var(--red-accent)',
        padding: '0.8rem 1rem',
        borderRadius: 'var(--radius-md)',
      },
      checkmark: { color: 'var(--text)' },
    },
    tabs: {
      tabpanel: {
        padding: '1.5rem',
      },
    },
    button: {
      root: {
        primary: {
          borderColor: 'transparent',
          hoverBorderColor: 'transparent',
          activeBorderColor: 'transparent',
          background: 'var(--red-accent)',
          hoverBackground: 'var(--red-accent)',
          activeBackground: 'var(--red-accent)',
        },
      },
    },
  },
});
