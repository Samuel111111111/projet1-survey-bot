import * as React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  rightElement?: React.ReactNode;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, rightElement, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {label}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            {...props}
            className={[
              "w-full rounded-lg border px-3 py-2 text-sm",
              "bg-white dark:bg-gray-900",
              "text-gray-900 dark:text-gray-100",
              "border-gray-300 dark:border-gray-700",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
              error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "",
              rightElement ? "pr-10" : "",
              className,
            ].join(" ")}
          />

          {rightElement && (
            <div className="absolute inset-y-0 right-2 flex items-center select-none">
              {rightElement}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
