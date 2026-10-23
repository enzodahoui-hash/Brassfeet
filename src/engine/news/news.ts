import type { Career, NewsItem } from '../types';

export type NewsIcon = 'transfer' | 'injury' | 'trophy' | 'board' | 'youth' | 'money' | 'award' | 'match' | 'star' | 'retire' | 'stadium' | 'kit' | 'continental' | 'warning' | 'calendar' | 'staff';

const MAX_NEWS = 500;

export function addNews(c: Career, n: Omit<NewsItem, 'id' | 'day'> & { day?: number }): NewsItem {
  const item: NewsItem = { id: `n${c.nextId++}`, day: n.day ?? c.day, ...n };
  c.news.unshift(item);
  if (c.news.length > MAX_NEWS) c.news.length = MAX_NEWS;
  return item;
}

export function userNews(c: Career): NewsItem[] {
  return c.news.filter((n) => n.clubIds.includes(c.userClubId) || n.important);
}

export function addDecision(c: Career, d: Omit<Career['inbox'][number], 'id' | 'day'> & { day?: number }): void {
  c.inbox.unshift({ id: `d${c.nextId++}`, day: d.day ?? c.day, ...d });
  if (c.inbox.length > 120) c.inbox.length = 120;
}
