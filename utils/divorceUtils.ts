/**
 * Divorce utility functions and constants for MMR Burwan
 */

export const DIVORCE_TYPES = [
  'TALAQ (HUSBAND: REGISTER B)',
  'KHULA- TALAQ (MUTUAL: REGISTER C)',
  'TALAQ-I-TAFWEEZ (WIFE: REGISTER D)',
  'OTHERS',
] as const;

export type DivorceTypeOption = (typeof DIVORCE_TYPES)[number];

/**
 * Check if the given divorce type represents Triple Talaq (Register B)
 */
export const isTripleTalaq = (type?: string | null): boolean => {
  if (!type) return false;
  const upper = type.toUpperCase().trim();
  return (
    upper.includes('REGISTER B') ||
    upper === 'TALAQ' ||
    upper === 'TRIPLE TALAQ' ||
    upper.includes('HUSBAND: REGISTER B')
  );
};

/**
 * Format any divorce type string to one of the 4 standard display types
 */
export const formatDivorceTypeDisplay = (type?: string | null): string => {
  if (!type) return 'TALAQ (HUSBAND: REGISTER B)';
  const upper = type.toUpperCase().trim();
  if (upper.includes('REGISTER B') || upper === 'TALAQ' || upper === 'TRIPLE TALAQ') {
    return 'TALAQ (HUSBAND: REGISTER B)';
  }
  if (
    upper.includes('REGISTER C') ||
    upper === 'KHULA' ||
    upper === 'MUTUAL' ||
    upper === 'MUBARAT' ||
    upper.includes('KHULA- TALAQ')
  ) {
    return 'KHULA- TALAQ (MUTUAL: REGISTER C)';
  }
  if (
    upper.includes('REGISTER D') ||
    upper.includes('TAFWEEZ') ||
    upper.includes('TAFWID') ||
    upper.includes('TALAQ-I-TAFWEEZ')
  ) {
    return 'TALAQ-I-TAFWEEZ (WIFE: REGISTER D)';
  }
  if (upper === 'OTHER' || upper === 'OTHERS') {
    return 'OTHERS';
  }
  return type.toUpperCase();
};

/**
 * Extract 3 talaq dates or single divorce date from an application or certificate object
 */
export const getDivorceDates = (app?: {
  divorceDate?: string;
  talaqDate1?: string;
  talaqDate2?: string;
  talaqDate3?: string;
  declarations?: any;
  divorceType?: string;
} | null) => {
  if (!app) {
    return {
      date1: '',
      date2: '',
      date3: '',
      singleDate: '',
      isTriple: false,
    };
  }

  const isTriple = isTripleTalaq(app.divorceType);
  const decl = app.declarations || {};

  const date1 = app.talaqDate1 || decl.talaqDate1 || app.divorceDate || '';
  const date2 = app.talaqDate2 || decl.talaqDate2 || (isTriple ? app.divorceDate : '') || '';
  const date3 = app.talaqDate3 || decl.talaqDate3 || (isTriple ? app.divorceDate : '') || '';
  const singleDate = app.divorceDate || date1;

  return {
    date1,
    date2,
    date3,
    singleDate,
    isTriple: isTriple || Boolean(date2 || date3),
  };
};
