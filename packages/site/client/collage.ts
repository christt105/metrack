import type { IndexItem } from '../src/renderIndex.js';
import type { CollageData } from './CollageData.js';

const TILE_WIDTH = 300;
const TILE_HEIGHT = 450;

export function collage(siteData: Partial<CollageData>): void {
  const grid = document.getElementById('collage-grid');
  if (!grid) return;
  const data = siteData as CollageData;
  const from = document.querySelector<HTMLInputElement>('#collage-from')!;
  const to = document.querySelector<HTMLInputElement>('#collage-to')!;
  const columns = document.querySelector<HTMLInputElement>('#collage-columns')!;
  const columnsValue = document.getElementById('collage-columns-value')!;
  const count = document.getElementById('collage-count')!;
  const download = document.querySelector<HTMLButtonElement>('#collage-download')!;
  const downloadLabel = document.getElementById('collage-download-label')!;
  const controls = document.querySelector<HTMLDetailsElement>('#collage-controls')!;
  let items: IndexItem[] = [];
  let shownColumns = 1;

  function day(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + String(date.getDate()).padStart(2, '0');
  }

  function corsSource(src: string) {
    const url = new URL(src, location.href);
    if (url.origin === location.origin) return url.href;
    url.searchParams.set('collage', '1');
    return url.href;
  }

  const render = () => {
    const types = Array.from(
      document.querySelectorAll<HTMLInputElement>('.collage-controls input[name="type"]:checked'),
      (input) => input.value,
    );
    if (types.indexOf('tv') !== -1) types.push('season');
    const start = from.value || '0000-00-00';
    const end = to.value || '9999-99-99';
    const chosen = items.filter((item) => {
      if (!item.date || types.indexOf(item.type) === -1) return false;
      const date = item.date.slice(0, 10);
      return date >= start && date <= end;
    });
    const wanted = Number(columns.value);
    shownColumns = chosen.length > 0 ? Math.min(wanted, chosen.length) : wanted;
    columnsValue.textContent = String(wanted);
    count.textContent = String(chosen.length);
    grid.style.setProperty('--columns', String(shownColumns));
    grid.replaceChildren(
      ...chosen.map((item) => {
        const image = new Image(TILE_WIDTH, TILE_HEIGHT);
        image.crossOrigin = 'anonymous';
        image.alt = item.title;
        image.decoding = 'async';
        image.src = corsSource(item.image);
        return image;
      }),
    );
    download.disabled = chosen.length === 0;
  };

  function drawTile(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
  ) {
    context.fillStyle = '#1f2725';
    context.fillRect(x, y, TILE_WIDTH, TILE_HEIGHT);
    if (!image.complete || image.naturalWidth === 0) return;
    const scale = Math.max(TILE_WIDTH / image.naturalWidth, TILE_HEIGHT / image.naturalHeight);
    const width = TILE_WIDTH / scale;
    const height = TILE_HEIGHT / scale;
    const left = (image.naturalWidth - width) / 2;
    const top = (image.naturalHeight - height) / 2;
    context.drawImage(image, left, top, width, height, x, y, TILE_WIDTH, TILE_HEIGHT);
  }

  function settle(image: HTMLImageElement): Promise<void> {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  }

  function finish(text: string) {
    downloadLabel.textContent = text;
    setTimeout(
      () => {
        downloadLabel.textContent = data.download;
        download.disabled = false;
      },
      text === data.download ? 0 : 2000,
    );
  }

  download.addEventListener('click', () => {
    const images = Array.from(grid.querySelectorAll('img'));
    if (images.length === 0) return;
    download.disabled = true;
    downloadLabel.textContent = data.generating;
    Promise.all(images.map(settle))
      .then(() => {
        const canvas = document.createElement('canvas');
        canvas.width = shownColumns * TILE_WIDTH;
        canvas.height = Math.ceil(images.length / shownColumns) * TILE_HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no canvas');
        images.forEach((image, index) => {
          const x = (index % shownColumns) * TILE_WIDTH;
          const y = Math.floor(index / shownColumns) * TILE_HEIGHT;
          drawTile(context, image, x, y);
        });
        canvas.toBlob((blob) => {
          if (!blob) {
            finish(data.tooLarge);
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = 'collage_' + day(new Date()) + '.png';
          link.href = url;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 1000);
          finish(data.download);
        }, 'image/png');
      })
      .catch(() => {
        finish(data.failed);
      });
  });

  if (window.matchMedia('(max-width: 759px)').matches) {
    columns.value = '3';
    controls.open = false;
  }
  const today = new Date();
  from.value = today.getFullYear() + '-01-01';
  to.value = day(today);
  [from, to, columns].forEach((input) => {
    input.addEventListener('input', render);
  });
  document.querySelectorAll('.collage-controls input[name="type"]').forEach((input) => {
    input.addEventListener('change', render);
  });
  fetch(data.index)
    .then((response) => response.json() as Promise<IndexItem[]>)
    .then((index) => {
      items = index;
      render();
    })
    .catch(() => {
      count.textContent = '0';
    });
}
