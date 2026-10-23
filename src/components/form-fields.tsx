import type { ReactNode } from "react";
import { hintClass, inputClass, labelClass, selectClass, textareaClass } from "@/components/ui";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );
}

export function TextInput({
  name,
  id,
  defaultValue,
  placeholder,
  type = "text",
  required,
  maxLength,
  disabled,
}: {
  name: string;
  id?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <input
      id={id ?? name}
      name={name}
      type={type}
      defaultValue={defaultValue ?? undefined}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      disabled={disabled}
      className={inputClass}
    />
  );
}

export function TextArea({
  name,
  id,
  defaultValue,
  placeholder,
  rows = 4,
  required,
  maxLength,
}: {
  name: string;
  id?: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <textarea
      id={id ?? name}
      name={name}
      defaultValue={defaultValue ?? undefined}
      placeholder={placeholder}
      rows={rows}
      required={required}
      maxLength={maxLength}
      className={textareaClass}
    />
  );
}

export function Select({
  name,
  id,
  defaultValue,
  options,
  required,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <select
      id={id ?? name}
      name={name}
      defaultValue={defaultValue}
      required={required}
      className={selectClass}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  name,
  id,
  defaultValue,
  label,
  defaultChecked,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        id={id ?? name}
        name={name}
        type="checkbox"
        value={defaultValue ?? "on"}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
      />
      {label}
    </label>
  );
}
