import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { useSearchParams } from "@solidjs/router";
import { inflate, deflate } from "pako";

const encode = (settings: any): string => {
  const json = JSON.stringify(settings);
  const compressed = deflate(new TextEncoder().encode(json), { level: 9 });

  let binary = "";
  for (const byte of compressed) binary += String.fromCharCode(byte);

  return btoa(binary);
};

const decode = <T,>(str: string, fallback: T): T => {
  try {
    const bytes = Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(inflate(bytes)));
  } catch (e) {
    if (typeof window !== "undefined") {
      console.info("Settings could not be decoded. Return fallback.");
    }
    return fallback;
  }
};

export const useSettings = <TSettings extends object>(fallback: TSettings) => {
  const [params, setParams] = useSearchParams<{
    settings: string;
  }>();

  const [settings, setSettings] = createStore<TSettings>(
    decode(params.settings || "", fallback),
  );

  createEffect((initialRun) => {
    const newSettings = encode(settings); // must be done before the early return for the initial run so SolidJS correctly keeps track of dependencies
    if (initialRun) {
      return;
    }
    setParams(
      {
        settings: newSettings,
      },
      {
        replace: true,
      },
    );
  }, "initialRun");

  return [settings, setSettings] as const;
};
