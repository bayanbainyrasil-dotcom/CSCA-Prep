import { z } from 'zod';

const BookmarkSchema = z.object({ id: z.string(), type: z.enum(['lesson','formula','question','vocabulary']), title: z.string(), subtitle: z.string(), path: z.string().startsWith('/'), createdAt: z.string() }).strict();
const ListSchema = z.array(BookmarkSchema).max(500);
export type UiBookmark = z.infer<typeof BookmarkSchema>;
const keyFor = (ownerId: string) => `csca-bookmarks-ui-v1:${ownerId}`;

export function readBookmarks(ownerId: string): UiBookmark[] {
  try { const raw=localStorage.getItem(keyFor(ownerId)); if(!raw) return []; const parsed=ListSchema.safeParse(JSON.parse(raw) as unknown); return parsed.success?parsed.data:[]; } catch { return []; }
}

export function toggleBookmark(ownerId: string, bookmark: Omit<UiBookmark,'createdAt'>): boolean {
  const current=readBookmarks(ownerId);
  const exists=current.some((item)=>item.id===bookmark.id);
  const next=exists?current.filter((item)=>item.id!==bookmark.id):[{...bookmark,createdAt:new Date().toISOString()},...current];
  localStorage.setItem(keyFor(ownerId),JSON.stringify(next));
  return !exists;
}

export function isBookmarked(ownerId: string, id:string){ return readBookmarks(ownerId).some((item)=>item.id===id); }
