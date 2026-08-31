import { resolveDeploymentConfiguration } from './deployment-config';

const environment = {
  VITE_DEPLOYMENT_MODE: import.meta.env.VITE_DEPLOYMENT_MODE,
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_APP_CHECK_SITE_KEY: import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY,
};

export const deploymentConfiguration = resolveDeploymentConfiguration(environment, {
  productionBuild: import.meta.env.PROD,
});

export const deploymentDiagnostic = Object.freeze({
  buildMode: import.meta.env.MODE,
  deploymentMode: deploymentConfiguration.mode,
  firebase: deploymentConfiguration.firebaseConfigured ? 'enabled' : 'disabled',
  appCheck: deploymentConfiguration.appCheckConfigured ? 'configured' : 'not-configured',
  emulators: import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' ? 'enabled' : 'disabled',
});

if (import.meta.env.DEV) {
  console.info(
    `[CSCA deployment] mode=${deploymentDiagnostic.deploymentMode}; Firebase=${deploymentDiagnostic.firebase}; App Check=${deploymentDiagnostic.appCheck}; emulators=${deploymentDiagnostic.emulators}`,
  );
}
