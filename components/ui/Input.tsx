import React, { forwardRef, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, showPasswordToggle, type, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            {label}
            {props.required && <span className="text-rose-600 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={`
              w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border transition-all duration-200
              ${leftIcon ? 'pl-8 sm:pl-10' : ''}
              ${(rightIcon || (isPassword && showPasswordToggle)) ? 'pr-8 sm:pr-10' : ''}
              ${error 
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500' 
                : 'border-gray-200 focus:border-gold-500 focus:ring-gold-500'
              }
              ${props.disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}
              focus:outline-none focus:ring-2 focus:ring-offset-0
              placeholder:text-gray-400 placeholder:text-sm
              ${className}
            `}
            {...props}
          />
          {isPassword && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} className="sm:w-5 sm:h-5" /> : <Eye size={18} className="sm:w-5 sm:h-5" />}
            </button>
          )}
          {rightIcon && !(isPassword && showPasswordToggle) && (
            <div className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
          {error && !isPassword && (
            <div className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-rose-500">
              <AlertCircle size={18} className="sm:w-5 sm:h-5" />
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs sm:text-sm text-rose-600 flex items-center gap-1">
            <AlertCircle size={12} className="sm:w-3.5 sm:h-3.5" />
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs sm:text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

