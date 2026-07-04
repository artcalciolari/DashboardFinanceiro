import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          'input',
          error && 'border-expense',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-expense">{error}</p>}
    </div>
  )
);

Input.displayName = 'Input';
export default Input;
