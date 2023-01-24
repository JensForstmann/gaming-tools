import { Component, createSignal } from "solid-js";

export const TextInput: Component<{
    label?: string;
    value?: string;
    setValue?: (value: string) => void;
}> = (props) => {
    return (
        <label class="flex flex-col">
            <span class="dui-label-text px-1 py-2">{props.label}</span>
            <input
                type="text"
                value={props.value}
                onInput={(e) => props.setValue?.(e.currentTarget.value)}
                class={"dui-input dui-input-bordered"}
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
            <span class="dui-label-text px-1 py-2">{props.label}</span>
            <input
                type="number"
                value={props.value}
                onInput={(e) => props.setValue?.(parseFloat(e.currentTarget.value))}
                class="dui-input dui-input-bordered"
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
}> = (props) => {
    return (
        <label class="flex flex-col justify-between">
            <span class="dui-label-text px-1 py-2">{props.label}</span>
            <input
                type="checkbox"
                checked={props.value}
                onInput={(e) => props.setValue?.(e.currentTarget.checked)}
                class="dui-checkbox mb-3"
            />
        </label>
    );
};
