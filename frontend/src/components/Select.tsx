import * as React from "react";

type Option = { value: string | number; label: string };

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Option[];
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {label}
          </label>
        )}

        <select
          ref={ref}
          {...props}
          className={[
            "w-full rounded-lg border px-3 py-2 text-sm",
            "bg-white dark:bg-gray-900",
            "text-gray-900 dark:text-gray-100",
            "border-gray-300 dark:border-gray-700",
            "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
            error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "",
            className,
          ].join(" ")}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
