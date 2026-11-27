export function statsYears(): void {
  const select = document.querySelector<HTMLSelectElement>('#stats-year-select');
  if (!select) return;
  const apply = () => {
    document.querySelectorAll<HTMLElement>('[data-stats-year]').forEach((block) => {
      block.hidden = block.getAttribute('data-stats-year') !== select.value;
    });
  };
  select.addEventListener('change', apply);
  apply();
}
