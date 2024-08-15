import { A, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createSignal, onMount, Suspense } from "solid-js";
import "./app.css";
import { MetaProvider, Title } from "@solidjs/meta";

const Themes = ["light", "dark"] as const;
type Theme = (typeof Themes)[number];

const systemWantsDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const systemPreferredTheme = (): Theme =>
  systemWantsDark() ? "dark" : "light";

const getThemeFromLocalStorage = (): Theme => {
  if (typeof localStorage === "undefined" || typeof window === "undefined") {
    return "light"; // SSR in light mode
  }
  const data = localStorage?.getItem("theme") ?? null;
  if (Themes.includes(data as Theme)) {
    return data as Theme;
  }
  return systemPreferredTheme();
};

const [currentTheme, setCurrentTheme] = createSignal<Theme>(
  getThemeFromLocalStorage(),
);

const setTheme = (theme: Theme | null) => {
  if (theme === null) {
    localStorage.removeItem("theme");
    setCurrentTheme(systemPreferredTheme());
  } else {
    localStorage.setItem("theme", theme);
    setCurrentTheme(theme);
  }
  document.documentElement.dataset.theme = currentTheme();
};

function Nav() {
  return (
    <div class="p-8">
      <nav class="navbar shadow-xl rounded-box bg-primary text-primary-content">
        <div class="navbar-start">
          <span class="text-xl mx-4">Gaming Tools</span>
        </div>
        <div class="navbar-center space-x-4">
          <A class="link-hover" href="/">
            Home
          </A>
          <A class="link-hover" href="/about">
            About
          </A>
          <A class="link-hover" href="/factorio">
            Factorio
          </A>
        </div>
        <div class="navbar-end">
          <div class="dropdown dropdown-end">
            <label tabindex="0" class="btn btn-ghost normal-case">
              Theme
            </label>
            <div
              tabindex="0"
              class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52"
            >
              <div class="grid grid-cols-1 gap-3 p-3 text-neutral">
                <div
                  class="btn normal-case"
                  onClick={() => setTheme(null)}
                >
                  Default
                </div>
                <div
                  class="btn normal-case"
                  onClick={() => setTheme("light")}
                >
                  Light
                </div>
                <div
                  class="btn normal-case"
                  onClick={() => setTheme("dark")}
                >
                  Dark
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  onMount(() => {
    document.documentElement.dataset.theme = currentTheme();
  });
  return (
    <Router
      root={props => (
        <MetaProvider>
          <Title>Gaming Tools</Title>
          <Nav />
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
