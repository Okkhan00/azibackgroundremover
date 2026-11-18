import { useEffect } from 'react';
import { Home as HomeIcon, Info, Layers, Palette, Scissors, Settings as SettingsIcon, History as HistoryIcon } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative } from './lib/platform';
import { navigate, useRoute, type Route } from './lib/router';
import { Footer, Logo, Toasts } from './components/ui';
import HomePage from './pages/Home';
import RemoverPage from './pages/Remover';
import BatchPage from './pages/Batch';
import EditorPage from './pages/Editor';
import HistoryPage from './pages/History';
import SettingsPage from './pages/Settings';
import AboutPage from './pages/About';
import { APP_NAME } from './lib/meta';

const NAV: { route: Route; label: string; icon: typeof HomeIcon; primary: boolean }[] = [
  { route: 'home', label: 'Home', icon: HomeIcon, primary: true },
  { route: 'remover', label: 'Remover', icon: Scissors, primary: true },
  { route: 'batch', label: 'Batch', icon: Layers, primary: true },
  { route: 'editor', label: 'Editor', icon: Palette, primary: true },
  { route: 'history', label: 'History', icon: HistoryIcon, primary: true },
  { route: 'settings', label: 'Settings', icon: SettingsIcon, primary: false },
  { route: 'about', label: 'About', icon: Info, primary: false },
];

export default function App() {
  const route = useRoute();

  // Native shell: status bar styling, splash screen, Android back button.
  useEffect(() => {
    if (!isNative()) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    StatusBar.setBackgroundColor({ color: '#0a0e1f' }).catch(() => undefined);
    SplashScreen.hide().catch(() => undefined);
    const sub = CapApp.addListener('backButton', () => {
      if (window.location.hash && window.location.hash !== '#/' && window.location.hash !== '#') {
        if (window.history.length > 1) window.history.back();
        else navigate('home');
      } else {
        CapApp.exitApp().catch(() => undefined);
      }
    });
    return () => {
      sub.then((s) => s.remove()).catch(() => undefined);
    };
  }, []);

  const Page = { home: HomePage, remover: RemoverPage, batch: BatchPage, editor: EditorPage, history: HistoryPage, settings: SettingsPage, about: AboutPage }[route];

  return (
    <div className="flex min-h-full">
      <Toasts />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/8 bg-navy-950/60 p-4 backdrop-blur md:flex">
        <button className="mb-6 flex items-center gap-3 text-left" onClick={() => navigate('home')} aria-label="Go to home">
          <Logo size={42} />
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold">AIZAZ BG Remover</span>
            <span className="gold-text text-xs font-semibold tracking-widest">PRO · AZI CREATION</span>
          </span>
        </button>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <button
              key={r}
              onClick={() => navigate(r)}
              aria-current={route === r ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                route === r ? 'bg-royal-600/25 text-white' : 'text-white/65 hover:bg-white/6'
              }`}
            >
              <Icon size={19} className={route === r ? 'text-gold-400' : ''} /> {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto text-center text-[11px] tracking-[0.25em]">
          <span className="gold-text font-semibold">AZI CREATION</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/8 bg-navy-950/80 px-4 py-2.5 backdrop-blur safe-top md:hidden">
          <button className="flex items-center gap-2.5" onClick={() => navigate('home')} aria-label="Go to home">
            <Logo size={32} />
            <span className="text-left leading-tight">
              <span className="block font-display text-sm font-semibold">{APP_NAME}</span>
              <span className="gold-text block text-[10px] font-semibold tracking-[0.2em]">AZI CREATION</span>
            </span>
          </button>
          <div className="flex gap-1">
            <button className="btn btn-ghost !min-h-10 !px-2.5" onClick={() => navigate('settings')} aria-label="Settings">
              <SettingsIcon size={19} />
            </button>
            <button className="btn btn-ghost !min-h-10 !px-2.5" onClick={() => navigate('about')} aria-label="About">
              <Info size={19} />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
          <Page />
          <Footer />
        </main>

        {/* Mobile bottom navigation: thumb-reachable */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-navy-950/90 backdrop-blur safe-bottom md:hidden" aria-label="Main">
          <ul className="mx-auto flex max-w-xl">
            {NAV.filter((n) => n.primary).map(({ route: r, label, icon: Icon }) => (
              <li key={r} className="flex-1">
                <button
                  onClick={() => navigate(r)}
                  aria-current={route === r ? 'page' : undefined}
                  className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${route === r ? 'text-gold-300' : 'text-white/55'}`}
                >
                  <Icon size={21} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

