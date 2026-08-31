import { describe, expect, it } from 'vitest';
import {
  FIREBASE_APP_CHECK_VARIABLE,
  FIREBASE_CLIENT_VARIABLES,
  resolveDeploymentConfiguration,
} from './deployment-config';

const completeFirebaseEnvironment = Object.fromEntries(
  [...FIREBASE_CLIENT_VARIABLES, FIREBASE_APP_CHECK_VARIABLE].map((name) => [name, `configured-${name}`]),
);

describe('deployment configuration', () => {
  it('keeps ordinary local builds in explicit local demo mode', () => {
    expect(resolveDeploymentConfiguration({}, { productionBuild: true })).toMatchObject({
      mode: 'local-demo',
      firebaseConfigured: false,
      vercelEnvironment: null,
    });
  });

  it('never lets a Vercel production build silently become a demo', () => {
    expect(() => resolveDeploymentConfiguration({}, {
      productionBuild: true,
      vercelEnvironment: 'production',
    })).toThrow(/production cannot fall back to local demo mode/i);
  });

  it('rejects an explicit demo mode on every Vercel environment', () => {
    expect(() => resolveDeploymentConfiguration({
      VITE_DEPLOYMENT_MODE: 'local-demo',
    }, {
      productionBuild: true,
      vercelEnvironment: 'preview',
    })).toThrow(/Vercel preview deployments must use/i);
  });

  it('accepts a complete Firebase production configuration without exposing values', () => {
    const result = resolveDeploymentConfiguration({
      ...completeFirebaseEnvironment,
      VITE_DEPLOYMENT_MODE: 'firebase',
    }, {
      productionBuild: true,
      vercelEnvironment: 'production',
    });
    expect(result).toEqual({
      mode: 'firebase',
      firebaseConfigured: true,
      appCheckConfigured: true,
      missingVariables: [],
      vercelEnvironment: 'production',
    });
    expect(JSON.stringify(result)).not.toContain('configured-');
  });
});
