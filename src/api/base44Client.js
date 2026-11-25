import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { createLocalEntities, useLocalEntities } from './localEntities';

const { appId, serverUrl, token, functionsVersion } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  serverUrl,
  token,
  functionsVersion,
  requiresAuth: false,
  analytics: useLocalEntities ? { enabled: false } : undefined
});

if (useLocalEntities) {
  base44.entities = createLocalEntities();
}
