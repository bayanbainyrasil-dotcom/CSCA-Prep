export const FIREBASE_CLIENT_VARIABLES = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export const FIREBASE_APP_CHECK_VARIABLE = 'VITE_FIREBASE_APP_CHECK_SITE_KEY' as const;

export type DeploymentMode = 'local-demo' | 'firebase';

export interface DeploymentConfiguration {
  mode: DeploymentMode;
  firebaseConfigured: boolean;
  appCheckConfigured: boolean;
  missingVariables: string[];
  vercelEnvironment: string | null;
}

function hasValue(environment: Record<string, string | undefined>, name: string): boolean {
  return typeof environment[name] === 'string' && environment[name]!.trim().length > 0;
}

export function resolveDeploymentConfiguration(
  environment: Record<string, string | undefined>,
  options: {
    productionBuild: boolean;
    vercelEnvironment?: string | null;
  },
): DeploymentConfiguration {
  const declaredMode = environment.VITE_DEPLOYMENT_MODE;
  if (declaredMode && declaredMode !== 'local-demo' && declaredMode !== 'firebase') {
    throw new Error('VITE_DEPLOYMENT_MODE must be either "local-demo" or "firebase".');
  }

  const vercelEnvironment = options.vercelEnvironment?.trim() || null;
  const mode: DeploymentMode = declaredMode === 'firebase' || declaredMode === 'local-demo'
    ? declaredMode
    : vercelEnvironment ? 'firebase' : 'local-demo';
  if (vercelEnvironment && mode !== 'firebase') {
    throw new Error(
      `Vercel ${vercelEnvironment} deployments must use VITE_DEPLOYMENT_MODE=firebase; GitHub Pages is the demo host.`,
    );
  }

  const appCheckConfigured = hasValue(environment, FIREBASE_APP_CHECK_VARIABLE);
  const missingVariables: string[] = FIREBASE_CLIENT_VARIABLES.filter((name) => !hasValue(environment, name));
  if (options.productionBuild && !appCheckConfigured) missingVariables.push(FIREBASE_APP_CHECK_VARIABLE);
  const firebaseConfigured = missingVariables.length === 0;

  if (mode === 'firebase' && !firebaseConfigured) {
    throw new Error(
      `Firebase deployment is missing required client variables: ${missingVariables.join(', ')}. Configure them in the deployment environment; production cannot fall back to local demo mode.`,
    );
  }

  return {
    mode,
    firebaseConfigured: mode === 'firebase' && firebaseConfigured,
    appCheckConfigured,
    missingVariables,
    vercelEnvironment,
  };
}
