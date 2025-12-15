import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, User } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-2 sm:py-3' : 'bg-transparent py-3 sm:py-5'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Logo Area */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-md text-white font-serif font-bold text-base sm:text-xl">
            M
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-bold text-gray-900 leading-none text-sm sm:text-lg tracking-tight">MMR Burwan</span>
            <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-gold-600 font-medium">{t('navigation.officialPortal')}</span>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm font-medium text-gray-600 hover:text-gold-600 transition-colors">{t('navigation.home')}</Link>
          <a href="#services" className="text-sm font-medium text-gray-600 hover:text-gold-600 transition-colors">{t('navigation.services')}</a>
          <Link to="/verify" className="text-sm font-medium text-gray-600 hover:text-gold-600 transition-colors">{t('navigation.verify')}</Link>
          <Link to="/help" className="text-sm font-medium text-gray-600 hover:text-gold-600 transition-colors">{t('navigation.help')}</Link>
          <Link to="/contact" className="text-sm font-medium text-gray-600 hover:text-gold-600 transition-colors">{t('navigation.contact')}</Link>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher />
          <button
            onClick={() => navigate('/auth/login')}
            className="text-sm font-medium text-gold-700 hover:text-gold-900 px-3 py-2 transition-colors"
          >
            {t('buttons.login')}
          </button>
          <button
            onClick={() => navigate('/auth/register')}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <User size={16} />
            {t('buttons.register')}
          </button>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-gray-700 p-1"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-t border-gray-100 p-4 sm:p-6 shadow-lg flex flex-col gap-3 sm:gap-4 animate-fade-in">
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-sm sm:text-base font-medium text-gray-800 py-1">{t('navigation.home')}</Link>
          <a href="#services" onClick={() => setMobileMenuOpen(false)} className="text-sm sm:text-base font-medium text-gray-800 py-1">{t('navigation.services')}</a>
          <Link to="/verify" onClick={() => setMobileMenuOpen(false)} className="text-sm sm:text-base font-medium text-gray-800 py-1">{t('navigation.verify')}</Link>
          <Link to="/help" onClick={() => setMobileMenuOpen(false)} className="text-sm sm:text-base font-medium text-gray-800 py-1">{t('navigation.help')}</Link>
          <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="text-sm sm:text-base font-medium text-gray-800 py-1">{t('navigation.contact')}</Link>
          <hr className="border-gray-100" />
          <div className="flex flex-col gap-2">
            <div className="w-full">
              <LanguageSwitcher />
            </div>
            <button
              onClick={() => {
                navigate('/auth/login');
                setMobileMenuOpen(false);
              }}
              className="w-full bg-white border border-gray-200 text-gray-800 py-2.5 sm:py-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {t('buttons.login')}
            </button>
            <button
              onClick={() => {
                navigate('/auth/register');
                setMobileMenuOpen(false);
              }}
              className="w-full bg-gold-500 text-white py-2.5 sm:py-3 rounded-lg text-sm font-medium hover:bg-gold-600 transition-colors"
            >
              {t('buttons.register')}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;