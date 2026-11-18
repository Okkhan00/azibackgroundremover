import { useEffect, useState } from 'react';

export type Route = 'home' | 'remover' | 'batch' | 'editor' | 'history' | 'settings' | 'about';
const ROUTES: Route[] = ['home', 'remover', 'batch', 'editor', 'history', 'settings', 'about'];

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(h) ? h : 'home';
}

export function navigate(r: Route) {
  window.location.hash = r === 'home' ? '' : `/${r}`;
}

/** Hash routing: works on any static host and inside the Android WebView with no server rewrites. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
