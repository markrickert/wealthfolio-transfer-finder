import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AddonContext, AddonEnableFunction } from '@wealthfolio/addon-sdk';
import { TransferScannerPage } from './pages/TransferScannerPage';

// The host owns a single React root per addon and mounts the route `component`
// itself (`createElement(Component, { location })`) with no access to the addon
// context. Capture it at enable time so the route wrapper can hand it down.
// (Do NOT call createRoot yourself — the host manages the lifecycle.)
let addonCtx: AddonContext | undefined;

// Route component. The sidebar entry + route are declared in manifest.json
// (`contributes.routes` + `contributes.links`), so the host renders navigation
// without booting the addon; this component only runs when the route is first
// visited. The QueryClientProvider shares one cache across route navigations.
const AddonRoute = () => (
  <QueryClientProvider client={addonCtx!.api.query.getClient() as QueryClient}>
    <TransferScannerPage ctx={addonCtx!} />
  </QueryClientProvider>
);

const enable: AddonEnableFunction = (ctx) => {
  addonCtx = ctx;

  // The route `id` MUST match `contributes.routes[].id` in manifest.json.
  // The host derives this root path from the manifest addon id.
  ctx.router.add({
    id: 'wealthfolio-transfers',
    path: '/addons/wealthfolio-transfers',
    component: AddonRoute,
  });

  // The host owns the React root, so there is nothing to unmount here.
  ctx.onDisable(() => {
    addonCtx = undefined;
  });
};

export default enable;
