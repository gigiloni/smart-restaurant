/** Bring the stacked mobile editor into view after selecting a record. */
export function focusEditor(id: string): void {
  if (window.innerWidth > 1100) return;
  requestAnimationFrame(() => {
    const editor = document.getElementById(id);
    const header = document.querySelector('.site-header');
    if (editor && header)
      editor.style.scrollMarginTop = `${header.getBoundingClientRect().height + 16}px`;
    editor?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
    editor?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  });
}
