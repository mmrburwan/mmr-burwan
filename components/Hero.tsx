import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, PlayCircle, Phone, FileText, Users, UserMinus, Search } from 'lucide-react';
import ActionCard from './ActionCard';
import VerifyDocumentModal from './VerifyDocumentModal';

const Hero: React.FC = () => {
  const navigate = useNavigate();
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  
  return (
    <section className="relative min-h-screen flex items-center pt-28 pb-12 lg:pt-32 px-6 overflow-hidden bg-rose-50/30">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -z-10 w-[800px] h-[800px] bg-gold-100/30 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/4 animate-pulse-slow"></div>
      <div className="absolute bottom-0 left-0 -z-10 w-[600px] h-[600px] bg-rose-100/30 rounded-full blur-[100px] -translate-x-1/4 translate-y-1/4"></div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light pointer-events-none"></div>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        
        {/* Left Column: Content */}
        <div className="lg:col-span-6 flex flex-col items-start text-left z-10">
          <div className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-rose-100 shadow-sm mb-8 hover:scale-105 transition-transform cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gold-500"></span>
              </span>
              <span className="text-xs font-semibold tracking-wide uppercase text-gray-600">Official Government Service</span>
            </div>
          </div>
          
          <h1 className="font-serif text-3xl lg:text-5xl leading-[1.1] text-gray-900 mb-8 tracking-tight animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Digital marriage <br />
            <span className="relative inline-block">
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-gold-600 to-gold-400 italic pr-2">
                registration
              </span>
              <span className="absolute bottom-2 left-0 w-full h-3 bg-gold-100/50 -z-0 transform -skew-x-12"></span>
            </span>
            simplified.
          </h1>
          
          <p className="text-base lg:text-lg text-gray-600 mb-10 max-w-lg leading-relaxed animate-fade-up" style={{ animationDelay: '0.3s' }}>
            Apply from home. A respectful, secure, and modern approach to Nikah registration for the digital age.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <button 
              onClick={() => navigate('/auth/register')}
              className="group relative px-8 py-4 bg-gray-900 text-white rounded-full overflow-hidden shadow-xl shadow-gray-900/20 hover:shadow-2xl hover:shadow-gold-500/20 transition-all duration-300 ease-out hover:-translate-y-1"
            >
              <span className="relative z-10 font-medium flex items-center gap-2 text-lg">
                Get Started 
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-gold-600 to-gold-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
            
            <button 
              onClick={() => {
                const element = document.getElementById('how-it-works');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="group px-8 py-4 bg-white border border-white text-gray-700 rounded-full hover:bg-rose-50 hover:text-gold-700 transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow-md hover:scale-105"
            >
              <PlayCircle size={20} className="text-gold-500 group-hover:text-gold-600" />
              <span className="font-medium text-lg">How it works</span>
            </button>
          </div>
          
          {/* Stats */}
          <div className="mt-12 pt-8 border-t border-gray-200/60 w-full flex items-center justify-between lg:justify-start lg:gap-16 animate-fade-up" style={{ animationDelay: '0.5s' }}>
              <div>
                 <p className="text-3xl font-serif font-bold text-gray-900">12k+</p>
                 <p className="text-sm text-gray-500 uppercase tracking-wider font-medium">Registrations</p>
              </div>
              <div>
                 <p className="text-3xl font-serif font-bold text-gray-900">100%</p>
                 <p className="text-sm text-gray-500 uppercase tracking-wider font-medium">Secure Data</p>
              </div>
              <div>
                 <p className="text-3xl font-serif font-bold text-gray-900">24h</p>
                 <p className="text-sm text-gray-500 uppercase tracking-wider font-medium">Processing</p>
              </div>
          </div>
        </div>

        {/* Right Column: Bento Grid */}
        <div className="lg:col-span-6 relative flex flex-col h-full justify-start items-center lg:items-start gap-6 animate-fade-in pt-8 lg:pt-0" style={{ animationDelay: '0.4s' }}>
          
          {/* Bento Grid */}
          <div className="grid grid-cols-3 gap-4 w-full relative z-20">
             {/* Main Action - Spans 3 cols */}
             <div className="col-span-3 transform transition-all duration-500 hover:z-10">
                <ActionCard 
                   icon={<FileText size={28} />}
                   title="Marriage Registration"
                   subtitle="Login • Upload • Download Certificate"
                   active={true}
                   color="gold"
                   className="min-h-[120px]"
                   onClick={() => navigate('/auth/register')}
                />
             </div>
             
             {/* Divorce Registration */}
             <div className="col-span-1 transform transition-all duration-500 hover:z-10">
               <ActionCard 
                   icon={<UserMinus size={24} />}
                   title="Divorce Registration"
                   subtitle="Talaq / Khula"
                   active={true}
                   color="indigo"
                   className="min-h-[140px]"
                   onClick={() => navigate('/help')}
                />
             </div>

             {/* Contact Support */}
             <div className="col-span-1 transform transition-all duration-500 hover:z-10">
               <ActionCard 
                   icon={<Phone size={24} />}
                   title="Contact Support"
                   subtitle="24/7 Helpline"
                   active={true}
                   color="rose"
                   className="min-h-[140px]"
                   onClick={() => navigate('/chat')}
                />
             </div>

             {/* Verify Certificate */}
             <div className="col-span-1 transform transition-all duration-500 hover:z-10">
               <ActionCard 
                   icon={<Search size={24} />}
                   title="Verify Certificate"
                   subtitle="Check Validity"
                   active={true}
                   color="indigo"
                   className="min-h-[140px]"
                   onClick={() => setIsVerifyModalOpen(true)}
                />
             </div>
          </div>
        </div>

      </div>

      {/* Verify Document Modal */}
      <VerifyDocumentModal 
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
      />
    </section>
  );
};

export default Hero;