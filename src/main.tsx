import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/features/auth/auth-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { AppDataBoundary } from '@/app/app-data-boundary';
import { PwaUpdatePrompt } from '@/components/system/pwa-update-prompt';
import { DeploymentModeDiagnostic } from '@/components/system/deployment-mode-diagnostic';
import { router } from '@/app/router';
import '@/styles/globals.css';

const root=document.getElementById('root');
if(!root)throw new Error('Root element was not found.');

createRoot(root).render(<StrictMode><ThemeProvider><AuthProvider><AppDataBoundary><RouterProvider router={router}/><PwaUpdatePrompt/><DeploymentModeDiagnostic/><Toaster richColors position="top-center"/></AppDataBoundary></AuthProvider></ThemeProvider></StrictMode>);
