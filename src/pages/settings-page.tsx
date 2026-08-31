import { useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { Check, Download, LoaderCircle, Moon, RotateCcw, Save, Sun } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FieldLabel, Input } from '@/components/ui/field';
import { getDeviceId } from '@/app/app-data-provider';
import { persistLocalProfile, useAuth } from '@/features/auth/auth-provider';
import { useTheme } from '@/features/theme/theme-provider';
import { dateKeyInTimezone } from '@/lib/date';
import { functions } from '@/lib/firebase';
import { clearLocalUserData, getCscaDatabase, LocalFirstRepository } from '@/lib/persistence';
import { useAppStore } from '@/stores';

const SettingsStateSchema = z.object({
  targetDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  language: z.enum(['en', 'ru', 'en-ru']),
  dailyMinutes: z.number().int().min(10).max(360),
  sound: z.boolean(),
  animations: z.boolean(),
  reminders: z.boolean(),
  difficulty: z.number().int().min(1).max(5),
}).strict();
type SettingsState = z.infer<typeof SettingsStateSchema>;

const exportCollections = ['profile', 'progress', 'topicMastery', 'attempts', 'studySessions', 'dailyPlans', 'mistakes', 'bookmarks', 'notes', 'examAttempts', 'vocabularyProgress', 'formulaProgress', 'diagnostics', 'syncState'] as const;
const ExportPageSchema = z.object({ collection: z.string(), documents: z.array(z.unknown()), nextCursor: z.string().nullable() });
const settingsKey = (ownerId: string) => `csca-settings-ui-v2:${ownerId}`;

function initialSettings(user: ReturnType<typeof useAuth>['user']): SettingsState {
  try {
    const local = localStorage.getItem(settingsKey(user?.uid ?? 'anonymous'));
    if (local) {
      const parsed = SettingsStateSchema.safeParse(JSON.parse(local) as unknown);
      if (parsed.success) return parsed.data;
    }
  } catch { /* use the authenticated profile below */ }
  const remote = user?.settings ?? {};
  return SettingsStateSchema.parse({
    targetDate: user?.targetDate ?? '',
    language: user?.preferredLanguage === 'en' || user?.preferredLanguage === 'ru' ? user.preferredLanguage : 'en-ru',
    dailyMinutes: typeof remote.dailyStudyMinutes === 'number' ? remote.dailyStudyMinutes : 90,
    sound: typeof remote.soundEffects === 'boolean' ? remote.soundEffects : false,
    animations: typeof remote.animations === 'boolean' ? remote.animations : true,
    reminders: typeof remote.studyReminders === 'boolean' ? remote.studyReminders : false,
    difficulty: typeof remote.preferredDifficulty === 'number' ? remote.preferredDifficulty : 2,
  });
}

function downloadJson(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, isDemo } = useAuth();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setProfile = useAppStore((state) => state.setProfile);
  const [settings, setSettings] = useState<SettingsState>(() => initialSettings(user));
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      if (!user) throw new Error('Your profile is still loading. Please try again.');
      let next = SettingsStateSchema.parse(settings);
      const today = dateKeyInTimezone(new Date(), user.timezone);
      if (!next.targetDate || next.targetDate < today) throw new Error('Choose today or a future CSCA date from your exam registration.');
      if (next.reminders && 'Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          next = { ...next, reminders: false };
          setSettings(next);
          toast.info('Reminders remain off because notification access was not granted.');
        }
      }
      localStorage.setItem(settingsKey(user.uid), JSON.stringify(next));
      const profile = useAppStore.getState().profile;
      if (!profile) throw new Error('Your profile is still loading. Please try again.');
      setProfile({ ...profile, targetDate: next.targetDate, preferredLanguage: next.language });
      await updateSettings({
        theme,
        dailyStudyMinutes: next.dailyMinutes,
        explanationLanguage: next.language,
        soundEffects: next.sound,
        animations: next.animations,
        studyReminders: next.reminders,
        preferredDifficulty: next.difficulty,
      });
      const savedProfile = useAppStore.getState().profile;
      if (isDemo && savedProfile) persistLocalProfile(savedProfile);
      toast.success('Settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    if (!user || exporting) return;
    setExporting(true);
    try {
      let data: unknown;
      if (functions && !isDemo) {
        const call = httpsCallable(functions, 'exportMyData');
        const collections: Record<string, unknown[]> = {};
        for (const collectionName of exportCollections) {
          let cursor: string | undefined;
          const documents: unknown[] = [];
          for (let page = 0; page < 100; page += 1) {
            const response = await call({ collection: collectionName, pageSize: 250, ...(cursor ? { cursor } : {}) });
            const parsed = ExportPageSchema.parse(response.data);
            documents.push(...parsed.documents);
            if (!parsed.nextCursor || parsed.documents.length < 250) break;
            cursor = parsed.nextCursor;
          }
          collections[collectionName] = documents;
        }
        data = { exportedAt: new Date().toISOString(), source: 'firebase', collections };
      } else {
        const repository = new LocalFirstRepository(getCscaDatabase(), user.uid, getDeviceId());
        data = { ...(await repository.exportValidatedData()), source: 'on-device', settings };
      }
      downloadJson(data, `csca-prep-export-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success('Export created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export could not be created.');
    } finally {
      setExporting(false);
    }
  };

  const reset = async () => {
    if (!user || resetting) return;
    setResetting(true);
    const pauseSync = useAppStore.getState().pauseSync;
    const resumeSync = useAppStore.getState().resumeSync;
    try {
      await pauseSync();
      if (functions && !isDemo) {
        const call = httpsCallable(functions, 'resetMyProgress');
        await call({ confirmation: 'RESET' });
      }
      await clearLocalUserData(user.uid);
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key && (
          key.startsWith(`csca-note-ui-v1:${user.uid}:`) ||
          key === `csca-bookmarks-ui-v1:${user.uid}` ||
          key === `csca-mistakes-ui-v1:${user.uid}` ||
          key.includes(`:${user.uid}:`) && /^csca-(?:mock|diagnostic|today)/.test(key)
        )) localStorage.removeItem(key);
      }
      const profile = useAppStore.getState().profile;
      useAppStore.getState().hydrate({
        ...(profile ? { profile } : {}),
        attempts: [],
        masteries: [],
        mistakes: [],
        bookmarks: [],
        notes: [],
        dailyPlan: null,
        activeMock: null,
        activePractice: null,
      });
      setResetOpen(false);
      toast.success('Progress reset; profile and settings were preserved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Progress could not be reset.');
    } finally {
      resumeSync();
      setResetting(false);
    }
  };

  return <div>
    <PageHeading eyebrow="Settings" title="Shape the system around your exam." description={isDemo ? 'Preferences and progress are saved on this device.' : 'Preferences sync across your signed-in devices.'} actions={<Badge variant={isDemo ? 'outline' : 'success'}>{isDemo ? 'On this device' : 'Cloud profile'}</Badge>} />
    <div className="content-grid"><div className="space-y-4 lg:col-span-8">
      <Card><CardContent className="p-5 sm:p-6"><h2 className="font-display text-xl font-semibold">Study plan</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><FieldLabel htmlFor="target-date">Target CSCA date</FieldLabel><Input id="target-date" type="date" min={user ? dateKeyInTimezone(new Date(), user.timezone) : undefined} value={settings.targetDate} onChange={(event) => update('targetDate', event.target.value)} /><p className="mt-2 text-xs text-muted-foreground">Use the date shown on your exam registration.</p></div><div><FieldLabel htmlFor="daily-minutes">Daily study target</FieldLabel><select id="daily-minutes" value={settings.dailyMinutes} onChange={(event) => update('dailyMinutes', Number(event.target.value))} className="tap-target w-full rounded-xl border bg-card px-3.5 text-sm"><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option></select></div><div><FieldLabel htmlFor="language">Explanation language</FieldLabel><select id="language" value={settings.language} onChange={(event) => update('language', event.target.value as SettingsState['language'])} className="tap-target w-full rounded-xl border bg-card px-3.5 text-sm"><option value="en-ru">English + Russian</option><option value="en">English</option><option value="ru">Russian</option></select></div><div><FieldLabel htmlFor="difficulty">Preferred difficulty · {settings.difficulty}/5</FieldLabel><input id="difficulty" className="mt-3 w-full accent-primary" type="range" min="1" max="5" value={settings.difficulty} onChange={(event) => update('difficulty', Number(event.target.value))} /></div></div></CardContent></Card>
      <Card><CardContent className="p-5 sm:p-6"><h2 className="font-display text-xl font-semibold">Experience</h2><div className="mt-5 space-y-1">{([['sound', 'Sound effects', 'Subtle answer feedback'], ['animations', 'Animations', 'Fast page and progress motion'], ['reminders', 'Study reminders', 'Only after notification permission']] as const).map(([key, label, description]) => <div key={key} className="flex items-center gap-4 rounded-xl p-3 hover:bg-secondary/50"><div className="flex-1"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div><Switch.Root aria-label={label} checked={settings[key]} onCheckedChange={(value) => update(key, value)} className="relative h-7 w-12 rounded-full bg-secondary data-[state=checked]:bg-primary"><Switch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6" /></Switch.Root></div>)}</div></CardContent></Card>
      <Card><CardContent className="p-5 sm:p-6"><h2 className="font-display text-xl font-semibold">Data</h2><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" disabled={exporting} onClick={() => void exportData()}>{exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? 'Exporting…' : 'Export my data'}</Button><Button variant="danger" onClick={() => setResetOpen(true)}><RotateCcw className="h-4 w-4" />Reset progress</Button></div></CardContent></Card>
    </div><aside className="lg:col-span-4"><Card className="sticky top-24"><CardContent className="p-5 sm:p-6"><h2 className="font-display text-xl font-semibold">Appearance</h2><div className="mt-4 grid grid-cols-3 gap-2">{([['system', 'System', Check], ['light', 'Light', Sun], ['dark', 'Dark', Moon]] as const).map(([value, label, Icon]) => <button key={value} onClick={() => setTheme(value)} className={`rounded-xl border p-3 text-center text-xs font-bold ${theme === value ? 'border-primary bg-primary/[0.06] text-primary' : 'text-muted-foreground'}`}><Icon className="mx-auto mb-2 h-4 w-4" />{label}</button>)}</div><Button className="mt-6 w-full" onClick={() => void save()} disabled={saving}><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save settings'}</Button></CardContent></Card></aside></div>
    <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogContent title="Reset all learning progress?" description="Lessons, attempts, mastery, mistakes and mock history will be deleted. Your account stays active."><p className="text-sm leading-relaxed text-muted-foreground">Export your data first if you may need it later. This action cannot be undone.</p><div className="mt-6 flex justify-end gap-2"><Button variant="outline" disabled={resetting} onClick={() => setResetOpen(false)}>Cancel</Button><Button variant="danger" disabled={resetting} onClick={() => void reset()}>{resetting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}{resetting ? 'Resetting…' : 'Reset progress'}</Button></div></DialogContent></Dialog>
  </div>;
}
