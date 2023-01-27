// @refresh reload
import { createSignal, Suspense } from "solid-js";
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

export default function Root() {
  const [currentTheme, setCurrentTheme] = createSignal<string | null>(
    (typeof localStorage === "undefined" || typeof window === "undefined")
      ? null
      : localStorage.getItem("theme")
  );

  const setTheme = (theme: string | null) => {
    if (theme === null) {
      localStorage.removeItem("theme");
      setCurrentTheme(null);
    } else {
      localStorage.setItem("theme", theme);
      setCurrentTheme(theme);
    }
  };

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
              <nav class="dui-navbar shadow-xl rounded-box bg-primary text-primary-content">
                <div class="dui-navbar-start">
                  <span class="text-xl mx-4">Gaming Tools</span>
                </div>
                <div class="dui-navbar-center space-x-4">
                  <A class="dui-link-hover" href="/">Home</A>
                  <A class="dui-link-hover" href="/about">About</A>
                  <A class="dui-link-hover" href="/factorio">Factorio</A>
                </div>
                <div class="dui-navbar-end">
                  <div class="dui-dropdown dui-dropdown-end">
                    <label tabindex="0" class="dui-btn dui-btn-ghost normal-case">Theme</label>
                    <div tabindex="0" class="dui-dropdown-content dui-menu p-2 shadow bg-base-100 rounded-box w-52">
                      <div class="grid grid-cols-1 gap-3 p-3 text-neutral">
                        <div class="dui-btn normal-case" onClick={() => setTheme(null)}>Default</div>
                        <div class="dui-btn normal-case" onClick={() => setTheme("light")}>Light</div>
                        <div class="dui-btn normal-case" onClick={() => setTheme("dark")}>Dark</div>
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
