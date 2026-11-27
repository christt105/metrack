export function backdrop(banners: string[]): void {
  const target = document.getElementById('profile-backdrop');
  if (!target || banners.length === 0) return;
  const image = new Image();
  image.alt = '';
  image.decoding = 'async';
  image.addEventListener('load', () => {
    target.classList.add('is-loaded');
  });
  image.src = banners[Math.floor(Math.random() * banners.length)]!;
  target.appendChild(image);
}
