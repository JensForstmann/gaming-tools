import { Component, For, JSXElement, Show } from "solid-js";

export const TextInput: Component<{
  label?: string;
  value?: string;
  setValue?: (value: string) => void;
  disabled?: boolean;
}> = (props) => {
  return (
    <label class="flex flex-col">
      <Show when={props.label !== undefined}>
        <span class="label-text px-1 py-2">{props.label}</span>
      </Show>
      <input
        type="text"
        value={props.value}
        onInput={(e) => props.setValue?.(e.currentTarget.value)}
        class={"input input-bordered"}
        disabled={props.disabled}
      />
    </label>
  );
};

export const TextAreaInput: Component<{
  label?: string;
  value?: string;
  setValue?: (value: string) => void;
  class?: string;
}> = (props) => {
  return (
    <label class="flex flex-col">
      <Show when={props.label !== undefined}>
        <span class="label-text px-1 py-2">{props.label}</span>
      </Show>
      <textarea
        value={props.value}
        onInput={(e) => props.setValue?.(e.currentTarget.value)}
        class={"textarea textarea-bordered h-24 w-full " + (props.class ?? "")}
      />
    </label>
  );
};

export const NumberInput: Component<{
  label?: string;
  value?: number;
  setValue?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}> = (props) => {
  return (
    <label class="flex flex-col">
      <Show when={props.label !== undefined}>
        <span class="label-text px-1 py-2">{props.label}</span>
      </Show>
      <input
        type="number"
        value={props.value}
        onInput={(e) => props.setValue?.(parseFloat(e.currentTarget.value))}
        class="input input-bordered"
        min={props.min}
        max={props.max}
        step={props.step}
      />
    </label>
  );
};

export const CheckboxInput: Component<{
  label?: string;
  value?: boolean;
  setValue?: (checked: boolean) => void;
  disabled?: boolean;
  class?: string;
}> = (props) => {
  return (
    <label class="flex flex-col justify-between">
      <Show when={props.label !== undefined}>
        <span class="label-text px-1 py-2">{props.label}</span>
      </Show>
      <input
        type="checkbox"
        checked={props.value}
        onInput={(e) => props.setValue?.(e.currentTarget.checked)}
        class={"checkbox mb-2 " + (props.class ?? "")}
        disabled={props.disabled}
      />
    </label>
  );
};

type SelectInputProps<T> = {
  label?: string;
  currentValue?: T;
  entries?: Array<{
    value: T;
    label: JSXElement;
  }>;
  class?: string;
  setValue?: (value: T) => void;
};

export const SelectInput = <T extends string>(props: SelectInputProps<T>) => {
  return (
    <label class="flex flex-col">
      <Show when={props.label !== undefined}>
        <span class="label-text px-1 py-2">{props.label}</span>
      </Show>
      <select
        class={"select " + (props.class ?? "")}
        onInput={(e) => props.setValue?.(e.currentTarget.value as T)}
      >
        <For each={props.entries}>
          {(entry) => (
            <option
              value={entry.value}
              selected={entry.value === props.currentValue}
            >
              {entry.label}
            </option>
          )}
        </For>
      </select>
    </label>
  );
};
