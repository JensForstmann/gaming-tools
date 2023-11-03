// @refresh reload
import { createEffect, createSignal, onMount, Suspense } from "solid-js";
import {
  A,
  Body,
  ErrorBoundary,
  FileRoutes,
  Head,
  Html,
  Meta,
  Routes,
  Scripts,
  Title,
} from "solid-start";
import "./root.css";

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

export default function Root() {
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
  };

  onMount(() => {
    document.documentElement.dataset.theme = currentTheme();
  });

  return (
    <Html lang="en" data-theme={currentTheme()}>
      <Head>
        <Title>Gaming Tools</Title>
        <Meta charset="utf-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1" />
        <script defer src="/_vercel/insights/script.js"></script>
      </Head>
      <Body>
        <Suspense>
          <ErrorBoundary>
            <div class="m-8">
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
            <Routes>
              <FileRoutes />
            </Routes>
          </ErrorBoundary>
        </Suspense>
        <Scripts />
      </Body>
    </Html>
  );
}
