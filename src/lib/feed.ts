import type { FeedItem } from "../config/feeds";

export interface FeedEntryLike {
  title?: string;
  link?: string;
  published?: string;
}

/** One feed's entries → the menu's flat shape, newest first, capped, tagged with the source site's name. */
export function toFeedItems(entries: FeedEntryLike[] | undefined, source: string, max: number): FeedItem[] {
  return (entries ?? [])
    .flatMap((entry) =>
      entry.title && entry.link
        ? [{ title: entry.title, url: entry.link, date: (entry.published ?? "").slice(0, 10), source }]
        : [],
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, max);
}
