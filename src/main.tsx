import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { matchRoutes } from 'react-router-dom';
import {
  initializeFaro,
  createReactRouterV6DataOptions,
  ReactIntegration,
  getWebInstrumentations,
} from '@grafana/faro-react';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import './index.css';
import { App } from './App';



createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
if (import.meta.env.PROD) {
  initializeFaro({
    url: 'https://faro-collector-prod-ap-southeast-1.grafana.net/collect/d730ce3555958ea089459acd1cd6886b',
    app: {
      name: 'stock-dashboard',
      version: '1.0.0',
      environment: 'production',
    },

    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation(),
      new ReactIntegration({
        router: createReactRouterV6DataOptions({
          matchRoutes,
        }),
      }),
    ],
  });
}
