import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { AlertCircle, ChevronDown, Search, X } from 'lucide-react';

interface SearchableSelectProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  allowCustom?: boolean; // Allow manual entry of values not in the list
}

const SearchableSelect = forwardRef<HTMLInputElement, SearchableSelectProps>(
  ({
    label,
    error,
    helperText,
    options,
    value,
    onChange,
    onBlur,
    name,
    allowCustom = true,
    disabled = false,
    required = false,
    className = '',
    ...props
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Filter options based on search term
    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Check if current value exists in options
    const currentValueExists = options.some(opt => opt.value === value);
    const currentLabel = options.find(opt => opt.value === value)?.label || value;

    // Handle click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    // Handle keyboard navigation
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightedIndex(prev =>
              prev < filteredOptions.length - 1 ? prev + 1 : prev
            );
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
            break;
          case 'Enter':
            e.preventDefault();
            if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
              handleSelect(filteredOptions[highlightedIndex].value);
            }
            break;
          case 'Escape':
            e.preventDefault();
            setIsOpen(false);
            setSearchTerm('');
            setHighlightedIndex(-1);
            break;
        }
      };

      if (isOpen) {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }
    }, [isOpen, filteredOptions, highlightedIndex]);

    // Scroll highlighted item into view
    useEffect(() => {
      if (listRef.current && highlightedIndex >= 0) {
        const highlightedItem = listRef.current.children[highlightedIndex] as HTMLElement;
        if (highlightedItem) {
          highlightedItem.scrollIntoView({ block: 'nearest' });
        }
      }
    }, [highlightedIndex]);

    const handleSelect = (selectedValue: string) => {
      onChange(selectedValue);
      setIsOpen(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setSearchTerm(newValue);
      setIsOpen(true);
      setHighlightedIndex(-1);

      // If allowCustom is true, update the value directly
      if (allowCustom) {
        onChange(newValue);
      }
    };

    const handleInputFocus = () => {
      setIsOpen(true);
      setSearchTerm(value && currentValueExists ? currentLabel : value);
    };

    const handleInputBlur = () => {
      // Delay to allow option click to register
      setTimeout(() => {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        if (onBlur) {
          onBlur();
        }
      }, 200);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      setSearchTerm('');
      setIsOpen(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    const displayValue = isOpen
      ? searchTerm
      : (value && currentValueExists ? currentLabel : value);

    return (
      <div className="w-full" ref={containerRef}>
        {label && (
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            {label}
            {required && <span className="text-rose-600 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <div className="relative">
            <div className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
              <Search size={14} className="sm:w-4 sm:h-4" />
            </div>
            <input
              ref={(node) => {
                if (typeof ref === 'function') {
                  ref(node);
                } else if (ref) {
                  ref.current = node;
                }
                inputRef.current = node;
              }}
              type="text"
              name={name}
              value={displayValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={disabled}
              className={`
                w-full pl-7 sm:pl-10 pr-7 sm:pr-10 py-2 sm:py-3 text-xs sm:text-base rounded-lg sm:rounded-xl border transition-all duration-200
                ${error
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                  : 'border-gray-200 focus:border-gold-500 focus:ring-gold-500'
                }
                ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}
                focus:outline-none focus:ring-2 focus:ring-offset-0
                placeholder:text-gray-400 placeholder:text-xs sm:placeholder:text-sm
                ${className}
              `}
              placeholder={props.placeholder || 'Search or type...'}
              autoComplete="off"
            />
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-7 sm:right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors z-10 p-1 touch-manipulation"
                aria-label="Clear"
              >
                <X size={14} className="sm:w-4 sm:h-4" />
              </button>
            )}
            <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 z-10">
              <ChevronDown
                size={16}
                className={`sm:w-5 sm:h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </div>

          {/* Dropdown List - Mobile Optimized */}
          {isOpen && !disabled && (
            <div
              className="absolute z-50 w-full mt-0.5 sm:mt-1 bg-white border border-gray-200 rounded-lg sm:rounded-xl shadow-lg max-h-[40vh] sm:max-h-60 overflow-auto overscroll-contain"
              style={{
                // Ensure dropdown doesn't go off-screen on mobile
                maxHeight: 'min(40vh, 200px)',
              }}
            >
              {filteredOptions.length > 0 ? (
                <ul ref={listRef} className="py-0.5 sm:py-1">
                  {filteredOptions.map((option, index) => (
                    <li
                      key={option.value}
                      onClick={(e) => {
                        e.preventDefault(); // Prevent input blur
                        handleSelect(option.value);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                      }}
                      onTouchStart={() => setHighlightedIndex(index)}
                      className={`
                        px-2.5 sm:px-4 py-2 sm:py-2.5 cursor-pointer text-xs sm:text-base transition-colors touch-manipulation
                        min-h-[44px] sm:min-h-0 flex items-center
                        active:bg-gray-100
                        ${index === highlightedIndex
                          ? 'bg-gold-50 text-gold-900'
                          : 'text-gray-900 hover:bg-gray-50'
                        }
                      `}
                    >
                      <span className="truncate">{option.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-500 text-center">
                  {allowCustom ? (
                    <span>Type to enter custom value</span>
                  ) : (
                    <span>No options found</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs sm:text-sm text-rose-600 flex items-center gap-1">
            <AlertCircle size={12} className="sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs sm:text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

SearchableSelect.displayName = 'SearchableSelect';

export default SearchableSelect;

