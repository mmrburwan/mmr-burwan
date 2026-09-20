import { format, parseISO, isValid, differenceInYears } from 'date-fns';

/**
 * Safely formats a date string using date-fns
 * @param dateString - Date string to format (ISO format or date string)
 * @param formatString - Format pattern (e.g., 'MMMM d, yyyy')
 * @param fallback - Fallback string if date is invalid (defaults to the original date string)
 * @returns Formatted date string or fallback
 */
export const safeFormatDate = (
  dateString: string | null | undefined,
  formatString: string,
  fallback?: string
): string => {
  if (!dateString) {
    return fallback || 'Invalid date';
  }

  try {
    // Try parsing as ISO first
    const parsedDate = parseISO(dateString);
    if (isValid(parsedDate)) {
      return format(parsedDate, formatString);
    }

    // If ISO parsing fails, try new Date()
    const dateObj = new Date(dateString);
    if (isValid(dateObj)) {
      return format(dateObj, formatString);
    }

    // If both fail, return fallback or original string
    return fallback || dateString;
  } catch (error) {
    console.warn('Date formatting error:', error, 'for date:', dateString);
    return fallback || dateString;
  }
};

/**
 * Safely formats a Date object using date-fns
 * @param date - Date object to format
 * @param formatString - Format pattern (e.g., 'MMMM d, yyyy')
 * @param fallback - Fallback string if date is invalid
 * @returns Formatted date string or fallback
 */
export const safeFormatDateObject = (
  date: Date | null | undefined,
  formatString: string,
  fallback?: string
): string => {
  if (!date) {
    return fallback || 'Invalid date';
  }

  try {
    if (isValid(date)) {
      return format(date, formatString);
    }
    return fallback || 'Invalid date';
  } catch (error) {
    console.warn('Date formatting error:', error, 'for date:', date);
    return fallback || 'Invalid date';
  }
};

/**
 * Safely parses an ISO date string
 * @param dateString - ISO date string to parse
 * @returns Date object or null if invalid
 */
export const safeParseISO = (dateString: string | null | undefined): Date | null => {
  if (!dateString) {
    return null;
  }

  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Date parsing error:', error, 'for date:', dateString);
    return null;
  }
};

/**
 * Calculates age from a date string relative to a reference date
 * @param dateString - Date of birth string
 * @param referenceDate - Date to calculate age against (defaults to current date)
 * @returns Age in years, or 0 if invalid
 */
export const calculateAge = (dateString: string, referenceDate: Date = new Date()): number => {
  if (!dateString) return 0;
  try {
    const dob = new Date(dateString);
    if (!isValid(dob)) return 0;

    // Ensure referenceDate is valid
    if (!isValid(referenceDate)) return 0;

    return differenceInYears(referenceDate, dob);
  } catch (error) {
    return 0;
  }
};

export interface DetailedAgeResult {
  years: number;
  months: number;
  days: number;
  text: string;
}

/**
 * Calculates detailed age (years and months) from a date of birth relative to a reference date (e.g. marriage date or today)
 */
export const calculateDetailedAge = (
  dobString: string | null | undefined,
  referenceDate: Date | string = new Date()
): DetailedAgeResult | null => {
  if (!dobString) return null;
  try {
    const parseDateParts = (input: Date | string): { y: number; m: number; d: number } | null => {
      if (input instanceof Date) {
        if (isNaN(input.getTime())) return null;
        return { y: input.getFullYear(), m: input.getMonth() + 1, d: input.getDate() };
      }
      if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return null;
        const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (match) {
          return {
            y: parseInt(match[1], 10),
            m: parseInt(match[2], 10),
            d: parseInt(match[3], 10),
          };
        }
        const d = new Date(trimmed);
        if (isNaN(d.getTime())) return null;
        return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
      }
      return null;
    };

    const dobParts = parseDateParts(dobString);
    const refParts = parseDateParts(referenceDate || new Date());

    if (!dobParts || !refParts) return null;

    let years = refParts.y - dobParts.y;
    let months = refParts.m - dobParts.m;
    let days = refParts.d - dobParts.d;

    if (days < 0) {
      months -= 1;
      const prevMonthDays = new Date(refParts.y, refParts.m - 1, 0).getDate();
      days += prevMonthDays;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years < 0) return null;

    const parts: string[] = [];
    if (years > 0 || (months === 0 && days === 0)) {
      parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
    }
    if (months > 0 || years > 0) {
      parts.push(`${months} ${months === 1 ? 'Month' : 'Months'}`);
    }
    parts.push(`${days} ${days === 1 ? 'Day' : 'Days'}`);

    return {
      years,
      months,
      days,
      text: parts.join(', '),
    };
  } catch (error) {
    return null;
  }
};


