import { RATING_LEVELS, type RatingIcon } from '@metrack/domain';
import { entryStatus } from './entryStatus.js';
import { formatDate } from './formatDate.js';
import { formatInteger } from './formatInteger.js';
import { markdownText } from './markdown/markdownText.js';
import type { PublicEntry } from './PublicEntry.js';
import type { SiteMessages } from './messages/SiteMessages.js';
import { themeType } from './themeType.js';

const RATING_EMOJI: Record<RatingIcon, string> = {
  crown: '👑',
  heart: '💚',
  thumbsUp: '👍',
  smile: '🙂',
  thumbsDown: '👎',
  dizzy: '😵',
  skull: '💀',
};

function rating(entry: PublicEntry, messages: SiteMessages): string | null {
  if (entry.rating === null) return null;
  const level = RATING_LEVELS.find((item) => item.rating === entry.rating);
  return level === undefined
    ? String(entry.rating)
    : `${RATING_EMOJI[level.icon]} ${messages.ratingLabels[level.icon]}`;
}

function achievements(entry: PublicEntry, messages: SiteMessages): string | null {
  if (entry.allAchievements) return `🏆 ${messages.card.allAchievements}`;
  if (entry.achievements === null) return null;
  const { unlocked, total } = entry.achievements;
  return `🏆 ${messages.detail.achievements} ${formatInteger(unlocked, messages)} / ${formatInteger(total, messages)}`;
}

/** The same facts the page header shows (type, status, rating, finish date, achievements) as one line of plain text. */
export function shareFacts(entry: PublicEntry, messages: SiteMessages): string {
  const type = themeType(entry.kind);
  const status = entryStatus(entry);
  const parts = [
    messages.typeLabels[type],
    entry.kind === 'series' ? null : (messages.statusLabels[status] ?? status),
    rating(entry, messages),
    entry.finishedAt === null ? null : formatDate(entry.finishedAt, messages),
    achievements(entry, messages),
  ];
  return parts.filter((part): part is string => part !== null && part !== '').join(' · ');
}

/** The text chats show under the title of a shared item: its facts, then the review as plain text, or else the synopsis. */
export function shareDescription(entry: PublicEntry, messages: SiteMessages): string {
  const review = entry.review === null ? '' : markdownText(entry.review);
  const text = review !== '' ? review : (entry.overview?.trim() ?? '');
  const facts = shareFacts(entry, messages);
  return text === '' ? facts : `${facts}\n${text}`;
}
