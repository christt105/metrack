import { backdrop } from './backdrop.js';
import { collage } from './collage.js';
import type { CollageData } from './CollageData.js';
import { filters } from './filters.js';
import { statsYears } from './statsYears.js';

const dataElement = document.getElementById('site-data');
const data: { banners?: string[] } & Partial<CollageData> = dataElement
  ? JSON.parse(dataElement.textContent)
  : {};

backdrop(data.banners || []);
filters();
statsYears();
collage(data);
