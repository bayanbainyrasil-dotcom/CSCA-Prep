import { useMemo, useState } from 'react';
import { Bookmark, BookOpen, Library, Languages, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeading } from '@/components/layout/page-heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { readBookmarks, toggleBookmark as toggleUiBookmark, type UiBookmark } from '@/features/bookmarks/storage';
import { useAuth } from '@/features/auth/auth-provider';
import { useAppStore } from '@/stores';
import type { Bookmark as StoredBookmark } from '@/domain';

const iconMap = { lesson: BookOpen, formula: Library, vocabulary: Languages, question: Target };
type DisplayBookmark = UiBookmark & { targetId: string; stored?: StoredBookmark };

function targetIdFromLocal(item: UiBookmark) {
  const prefix = `${item.type}-`;
  return item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id;
}

export default function BookmarksPage() {
  const { user } = useAuth();
  const ownerId = user?.uid ?? 'anonymous';
  const [localItems, setLocalItems] = useState<UiBookmark[]>(() => readBookmarks(ownerId));
  const stored = useAppStore((state) => state.bookmarks);
  const lessons = useAppStore((state) => state.lessons);
  const formulas = useAppStore((state) => state.formulas);
  const vocabulary = useAppStore((state) => state.vocabulary);
  const toggleStoredBookmark = useAppStore((state) => state.toggleBookmark);
  const items = useMemo<DisplayBookmark[]>(() => {
    const local = localItems.map((item) => ({ ...item, targetId: targetIdFromLocal(item) }));
    const keys = new Set(local.map((item) => `${item.type}:${item.targetId}`));
    const remote = Object.values(stored).flatMap((item): DisplayBookmark[] => {
      if (keys.has(`${item.targetType}:${item.targetId}`)) return [];
      const lesson = item.targetType === 'lesson' ? lessons.find((entry) => entry.id === item.targetId) : undefined;
      const formula = item.targetType === 'formula' ? formulas.find((entry) => entry.id === item.targetId) : undefined;
      const word = item.targetType === 'vocabulary' ? vocabulary.find((entry) => entry.id === item.targetId) : undefined;
      return [{
        id: item.id,
        type: item.targetType,
        targetId: item.targetId,
        title: lesson?.title.en ?? formula?.name.en ?? word?.english ?? (item.targetType === 'question' ? 'Saved question' : item.targetId),
        subtitle: lesson?.summary.en ?? formula?.calculates.en ?? word?.russian ?? 'Synced from another device',
        path: item.targetType === 'lesson' ? `/lesson/${encodeURIComponent(item.targetId)}` : item.targetType === 'formula' ? '/formulas' : item.targetType === 'vocabulary' ? '/vocabulary' : `/practice/session?mode=practice&question=${encodeURIComponent(item.targetId)}`,
        createdAt: item.createdAt,
        stored: item,
      }];
    });
    return [...local.map((item) => ({ ...item, stored: Object.values(stored).find((entry) => entry.targetType === item.type && entry.targetId === item.targetId) })), ...remote]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [formulas, lessons, localItems, stored, vocabulary]);

  const remove = async (item: DisplayBookmark) => {
    try {
      if (item.stored) await toggleStoredBookmark(item.type, item.targetId);
      const local = readBookmarks(ownerId).find((entry) => entry.id === item.id || (entry.type === item.type && targetIdFromLocal(entry) === item.targetId));
      if (local) toggleUiBookmark(ownerId, { id: local.id, type: local.type, title: local.title, subtitle: local.subtitle, path: local.path });
      setLocalItems(readBookmarks(ownerId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bookmark could not be removed.');
    }
  };

  return <div><PageHeading eyebrow="Bookmarks" title="Keep the ideas worth returning to." description="Saved lessons, formulas, vocabulary and questions stay available offline and synchronize after sign-in." />{items.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const Icon = iconMap[item.type]; return <Card key={`${item.type}-${item.targetId}`}><CardContent className="flex h-full flex-col p-5"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><Button variant="ghost" size="icon" onClick={() => void remove(item)} aria-label={`Remove ${item.title}`}><Trash2 className="h-4 w-4" /></Button></div><p className="data-label mt-5">{item.type}</p><h2 className="mt-1 font-display text-lg font-semibold tracking-tight">{item.title}</h2><p className="mt-1 flex-1 text-sm text-muted-foreground">{item.subtitle}</p><Button variant="outline" className="mt-5" asChild><Link to={item.path}>Open</Link></Button></CardContent></Card>; })}</div> : <Card><CardContent className="p-10 text-center"><Bookmark className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-5 font-display text-2xl font-semibold">Nothing bookmarked yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Use the bookmark icon inside lessons and the formula library.</p><Button className="mt-6" asChild><Link to="/learn">Browse lessons</Link></Button></CardContent></Card>}</div>;
}
