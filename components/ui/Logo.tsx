import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  variant?: 'default' | 'auth' | 'admin';
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  linkTo?: string;
}

/**
 * Reusable Logo component with the golden M icon
 * Matches the design from Navbar, AuthLayout, and AdminLayout
 */
const Logo: React.FC<LogoProps> = ({
  variant = 'default',
  showText = true,
  size = 'md',
  className = '',
  linkTo,
}) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      icon: 'w-8 h-8 sm:w-9 sm:h-9',
      text: 'text-sm sm:text-base',
      subtitle: 'text-[9px] sm:text-[10px]',
      gap: 'gap-2 sm:gap-3',
      iconText: 'text-base sm:text-lg',
    },
    md: {
      icon: 'w-8 h-8 sm:w-10 sm:h-10',
      text: 'text-sm sm:text-lg',
      subtitle: 'text-[8px] sm:text-[10px]',
      gap: 'gap-2 sm:gap-3',
      iconText: 'text-base sm:text-xl',
    },
    lg: {
      icon: 'w-10 h-10 sm:w-12 sm:h-12',
      text: 'text-base sm:text-xl',
      subtitle: 'text-[10px] sm:text-xs',
      gap: 'gap-3 sm:gap-4',
      iconText: 'text-lg sm:text-2xl',
    },
  };

  const config = sizeConfig[size];

  // Variant-specific subtitle text
  const subtitleText = {
    default: 'OFFICIAL PORTAL',
    auth: 'OFFICIAL PORTAL',
    admin: 'ADMIN PORTAL',
  };

  const subtitle = subtitleText[variant];

  const logoContent = (
    <div className={`flex items-center ${config.gap} ${className}`}>
      {/* Golden M Icon */}
      <div
        className={`${config.icon} rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-md text-white font-serif font-bold ${config.iconText} flex-shrink-0`}
      >
        M
      </div>
      {/* Text */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <span
            className={`font-serif font-bold text-gray-900 leading-none ${config.text} tracking-tight ${variant === 'admin' ? 'truncate' : ''}`}
          >
            MMR Burwan
          </span>
          <span
            className={`uppercase tracking-widest text-gold-600 font-medium ${config.subtitle}`}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="hover:opacity-90 transition-opacity">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
};

export default Logo;

