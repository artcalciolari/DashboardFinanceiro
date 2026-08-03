import { SelectHTMLAttributes, forwardRef, ReactNode, useId } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, children, className, id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;

    return (
      <div className="w-full">
      {label && <label className="label" htmlFor={selectId}>{label}</label>}
      <select
        ref={ref}
        id={selectId}
        className={clsx(
          'input bg-white',
          error && 'border-expense',
          className
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {children}
      </select>
      {error && <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-expense">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
