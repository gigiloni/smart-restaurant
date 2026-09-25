import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const GastroTheme = definePreset(Aura, {
  components: {
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
