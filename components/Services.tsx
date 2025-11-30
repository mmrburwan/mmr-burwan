import React from 'react';
import { useNavigate } from 'react-router-dom';
import ActionCard from './ActionCard';
import { FileText, UserMinus, Search } from 'lucide-react';

const Services: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <section id="services" className="py-24 px-6 bg-rose-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl text-gray-900">Our Services</h2>
          <p className="text-gray-500 mt-4">Comprehensive digital solutions for your marital records.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="h-64">
                 <ActionCard 
                   icon={<FileText size={28} />}
                   title="Marriage Registration"
                   subtitle="Login • Upload • Download"
                   color="gold"
                   active={true}
                   onClick={() => navigate('/auth/register')}
                />
            </div>
            <div className="h-64">
                 <ActionCard 
                   icon={<UserMinus size={28} />}
                   title="Divorce Registration"
                   subtitle="Talaq / Khula Registration"
                   color="rose"
                   onClick={() => navigate('/help')}
                />
            </div>
            <div className="h-64">
                 <ActionCard 
                   icon={<Search size={28} />}
                   title="Certificate Verification"
                   subtitle="Check Validity"
                   color="indigo"
                   onClick={() => navigate('/verify')}
                />
            </div>
        </div>
      </div>
    </section>
  );
};

export default Services;