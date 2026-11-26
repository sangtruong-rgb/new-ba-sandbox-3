// FormUI: the field and the button every form of the batch uses.
import type { KeyboardEvent, ReactNode } from 'react';
import s from './Field.module.css';

type InputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';

export type FieldProps = {
  id: string;
  label: ReactNode;
  type?: string;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: InputMode;
  value: string;
  onChange(value: string): void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: ReactNode;
  invalid?: boolean;
};

export function Field({
  id,
  label,
  type = 'text',
  multiline,
  rows,
  placeholder,
  autoComplete,
  inputMode,
  value,
  onChange,
  onKeyDown,
  error,
  invalid,
}: FieldProps) {
  const hasError = error !== undefined && error !== null && error !== false && error !== '';
  const bad = hasError || !!invalid;
  const errorId = `${id}-error`;
  const common = {
    id,
    className: s.control,
    value,
    placeholder,
    autoComplete,
    inputMode,
    onKeyDown,
    'aria-invalid': bad ? true : undefined,
    'aria-describedby': hasError ? errorId : undefined,
  };
  return (
    <div className={bad ? `${s.field} ${s.bad}` : s.field}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      {hasError ? (
        <p className={s.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type ButtonProps = {
  variant: 'primary' | 'quiet' | 'link';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

export function Button({ variant, type = 'button', disabled, onClick, children }: ButtonProps) {
  return (
    <button type={type} className={`${s.button} ${s[variant]}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
