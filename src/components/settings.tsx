import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import { useSearchParams } from "@solidjs/router";
import { inflate, deflate } from "pako";
import { Buffer } from "buffer";

const encode = (settings: any): string => {
  return Buffer.from(deflate(JSON.stringify(settings), { level: 9 })).toString(
    "base64",
  );
};

const decode = <T,>(str: string, fallback: T): T => {
  try {
    return JSON.parse(inflate(Buffer.from(str, "base64"), { to: "string" }));
  } catch (e) {
    console.info(
      "Settings could not be encoded. Return empty settings object.",
    );
    return fallback;
  }
};

export const useSettings = <TSettings extends object>(fallback?: TSettings) => {
  const [params, setParams] = useSearchParams<{
    settings: string;
  }>();

  const [settings, setSettings] = createStore<TSettings>(
    decode(params.settings || "", fallback!),
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
