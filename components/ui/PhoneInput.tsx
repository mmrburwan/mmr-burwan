import React, { forwardRef, useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  value?: string;
  onChange?: (value: string) => void;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, helperText, leftIcon, value = '', onChange, className = '', ...props }, ref) => {
    const [phoneValue, setPhoneValue] = useState(value);

    useEffect(() => {
      setPhoneValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Only allow digits, max 10 digits
      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
      setPhoneValue(digits);
      if (onChange) {
        onChange(digits);
      }
    };

    const displayValue = phoneValue ? `+91 ${phoneValue}` : '+91 ';

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
            <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 flex items-center">
              {leftIcon}
            </div>
          )}
          {/* Non-editable prefix - positioned after icon with proper spacing */}
          <div 
            className={`absolute top-1/2 -translate-y-1/2 text-gray-700 font-medium pointer-events-none z-10 text-sm sm:text-base ${
              leftIcon ? 'left-8 sm:left-10' : 'left-2.5 sm:left-3'
            }`}
          >
            +91
          </div>
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={phoneValue}
            onChange={handleChange}
            className={`
              w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border transition-all duration-200
              ${leftIcon ? 'pl-20 sm:pl-24' : 'pl-12 sm:pl-14'}
              ${error ? 'pr-8 sm:pr-10' : ''}
              ${error 
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500' 
                : 'border-gray-200 focus:border-gold-500 focus:ring-gold-500'
              }
              ${props.disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}
              focus:outline-none focus:ring-2 focus:ring-offset-0
              placeholder:text-gray-400 placeholder:text-sm
              ${className}
            `}
            placeholder="Enter 10-digit mobile number"
            maxLength={10}
            {...props}
          />
          {error && (
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

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;

