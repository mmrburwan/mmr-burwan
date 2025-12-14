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
 * Calculates age from a date string
 * @param dateString - Date of birth string
 * @returns Age in years, or 0 if invalid
 */
export const calculateAge = (dateString: string): number => {
  if (!dateString) return 0;
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return 0;
    return differenceInYears(new Date(), date);
  } catch (error) {
    return 0;
  }
};

