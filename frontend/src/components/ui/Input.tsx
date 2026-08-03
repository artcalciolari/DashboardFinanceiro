import { InputHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full">
      {label && <label className="label" htmlFor={inputId}>{label}</label>}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          'input',
          error && 'border-expense',
          className
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-expense">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
