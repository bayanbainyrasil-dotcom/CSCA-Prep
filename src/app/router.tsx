import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/app/app-shell';
import { ProtectedRoute } from '@/app/protected-route';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard=lazy(()=>import('@/pages/dashboard-page'));
const Today=lazy(()=>import('@/pages/today-page'));
const Roadmap=lazy(()=>import('@/pages/roadmap-page'));
const Subject=lazy(()=>import('@/pages/subject-page'));
const Learn=lazy(()=>import('@/pages/learn-page'));
const Lesson=lazy(()=>import('@/pages/lesson-page'));
const Practice=lazy(()=>import('@/pages/practice-page'));
const PracticeSession=lazy(()=>import('@/pages/practice-session-page'));
const Diagnostic=lazy(()=>import('@/pages/diagnostic-page'));
const Mock=lazy(()=>import('@/pages/mock-page'));
const MockExam=lazy(()=>import('@/pages/mock-exam-page'));
const MockResults=lazy(()=>import('@/pages/mock-results-page'));
const Vocabulary=lazy(()=>import('@/pages/vocabulary-page'));
const Formulas=lazy(()=>import('@/pages/formulas-page'));
const MentalMath=lazy(()=>import('@/pages/mental-math-page'));
const Mistakes=lazy(()=>import('@/pages/mistakes-page'));
const Progress=lazy(()=>import('@/pages/progress-page'));
const Bookmarks=lazy(()=>import('@/pages/bookmarks-page'));
const Settings=lazy(()=>import('@/pages/settings-page'));
const Admin=lazy(()=>import('@/pages/admin-page'));
const More=lazy(()=>import('@/pages/more-page'));
const Offline=lazy(()=>import('@/pages/offline-page'));
const NotFound=lazy(()=>import('@/pages/not-found-page'));
const Login=lazy(()=>import('@/pages/login-page'));
const Onboarding=lazy(()=>import('@/pages/onboarding-page'));

function Page({children}:{children:ReactNode}){return <Suspense fallback={<div className="space-y-4"><Skeleton className="h-16 w-2/3"/><Skeleton className="h-80 w-full"/></div>}>{children}</Suspense>;}

export const router=createBrowserRouter([
  {path:'/login',element:<Page><Login/></Page>},
  {element:<ProtectedRoute/>,children:[
    {path:'/onboarding',element:<Page><Onboarding/></Page>},
    {path:'/mock/:subject/active',element:<Page><MockExam/></Page>},
    {element:<AppShell/>,children:[
      {index:true,element:<Page><Dashboard/></Page>},
      {path:'today',element:<Page><Today/></Page>},
      {path:'roadmap',element:<Page><Roadmap/></Page>},
      {path:'learn',element:<Page><Learn/></Page>},
      {path:'mathematics',element:<Page><Subject subject="mathematics"/></Page>},
      {path:'physics',element:<Page><Subject subject="physics"/></Page>},
      {path:'lesson/:lessonId',element:<Page><Lesson/></Page>},
      {path:'practice',element:<Page><Practice/></Page>},
      {path:'practice/session',element:<Page><PracticeSession/></Page>},
      {path:'diagnostic',element:<Page><Diagnostic/></Page>},
      {path:'mock',element:<Page><Mock/></Page>},
      {path:'mock/:subject/results',element:<Page><MockResults/></Page>},
      {path:'vocabulary',element:<Page><Vocabulary/></Page>},
      {path:'formulas',element:<Page><Formulas/></Page>},
      {path:'mental-math',element:<Page><MentalMath/></Page>},
      {path:'mistakes',element:<Page><Mistakes/></Page>},
      {path:'progress',element:<Page><Progress/></Page>},
      {path:'bookmarks',element:<Page><Bookmarks/></Page>},
      {path:'settings',element:<Page><Settings/></Page>},
      {path:'admin',element:<Page><Admin/></Page>},
      {path:'more',element:<Page><More/></Page>},
      {path:'offline',element:<Page><Offline/></Page>},
      {path:'*',element:<Page><NotFound/></Page>},
    ]},
  ]},
], { basename: import.meta.env.BASE_URL });
