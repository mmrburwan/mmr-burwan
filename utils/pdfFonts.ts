import { Font } from '@react-pdf/renderer';

const getFontUrl = (path: string): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
};

let fontsRegistered = false;

export const registerCertificateFonts = () => {
  if (fontsRegistered) return;

  try {
    // Register Times font family
    Font.register({
      family: 'Times',
      fonts: [
        { src: getFontUrl('/fonts/times.ttf'), fontWeight: 'normal', fontStyle: 'normal' },
        { src: getFontUrl('/fonts/timesbd.ttf'), fontWeight: 'bold', fontStyle: 'normal' },
        { src: getFontUrl('/fonts/timesi.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
        { src: getFontUrl('/fonts/timesbi.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
      ],
    });

    // Register Arial font family
    Font.register({
      family: 'Arial',
      fonts: [
        { src: getFontUrl('/fonts/arial.ttf'), fontWeight: 'normal' },
        { src: getFontUrl('/fonts/arialbd.ttf'), fontWeight: 'bold' },
      ],
    });

    // Register Calibri font family
    Font.register({
      family: 'Calibri',
      fonts: [
        { src: getFontUrl('/fonts/calibri.ttf'), fontWeight: 'normal' },
        { src: getFontUrl('/fonts/calibrib.ttf'), fontWeight: 'bold' },
      ],
    });

    // Register Old English font
    Font.register({
      family: 'OldEnglish',
      src: getFontUrl('/fonts/OLDENGL.TTF'),
    });

    // Register Script MT Bold font
    Font.register({
      family: 'ScriptMTBold',
      src: getFontUrl('/fonts/SCRIPTBL.TTF'),
    });

    // Prevent words from splitting/hyphenating across lines in the certificate
    Font.registerHyphenationCallback((word) => [word]);

    fontsRegistered = true;
  } catch (error) {
    console.error('Error registering certificate fonts:', error);
  }
};

// Auto-register when imported
registerCertificateFonts();

