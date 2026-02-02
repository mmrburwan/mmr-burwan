/**
 * Formats an Aadhaar number with spaces after every 4 digits
 * Example: 720618372946 -> 7206 1837 2946
 */
export const formatAadhaar = (aadhaar: string | undefined): string => {
    if (!aadhaar || aadhaar === 'N/A') return 'N/A';
    const cleaned = aadhaar.replace(/\s/g, '');
    if (cleaned.length === 12) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`;
    }
    return aadhaar;
};

/**
 * Handles live Aadhaar input formatting with spaces
 * To be used in onChange handlers
 */
export const handleAadhaarInput = (value: string): string => {
    // Remove any non-digits
    const cleaned = value.replace(/\D/g, '');

    // Limit to 12 digits
    const truncated = cleaned.slice(0, 12);

    // Add spaces after every 4 digits
    const parts = [];
    for (let i = 0; i < truncated.length; i += 4) {
        parts.push(truncated.slice(i, i + 4));
    }

    return parts.join(' ');
};
