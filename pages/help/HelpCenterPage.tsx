import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { HelpCircle, MessageSquare, Mail, Phone, ChevronDown, ArrowLeft } from 'lucide-react';

const HelpCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    // Redirect unauthenticated users to public help page
    if (!isLoading && !isAuthenticated) {
      navigate('/help', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const faqs = [
    {
      question: 'How do I start my marriage registration?',
      answer: 'Sign up for an account, complete the onboarding process, and then start your application from the dashboard.',
    },
    {
      question: 'What documents do I need?',
      answer: 'You will need: National ID (front and back), passport-sized photos (2 copies), birth certificate, and previous marriage certificate if applicable.',
    },
    {
      question: 'How long does the process take?',
      answer: 'Typically, the registration process takes 7-14 business days after submission of all required documents.',
    },
    {
      question: 'Can I reschedule my appointment?',
      answer: 'Yes, you can reschedule your appointment from the Appointments page up to 24 hours before your scheduled time.',
    },
  ];

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 sm:pt-8 pb-6 sm:pb-8">
        {/* Header with Back Button */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="mb-2 sm:mb-3"
          >
            <ArrowLeft size={16} className="mr-1.5" />
            Back to Dashboard
          </Button>
          <div className="text-center">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Help Center</h1>
            <p className="text-xs sm:text-sm text-gray-600">Find answers to common questions</p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <Card key={index} className="overflow-hidden">
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-3 sm:px-5 py-3 sm:py-4 text-left flex items-center justify-between gap-2 sm:gap-3 hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold-200 focus:ring-offset-2 rounded-xl"
                  aria-expanded={isOpen}
                  aria-controls={`answer-${index}`}
                >
                  <div className="flex items-start gap-2 sm:gap-3 flex-1">
                    <div className="flex-shrink-0">
                      <HelpCircle size={16} className="sm:w-5 sm:h-5 text-gold-600 mt-0.5" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base pr-2">
                      {faq.question}
                    </h3>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 text-gold-600 transition-transform duration-300 sm:w-5 sm:h-5 ${
                      isOpen ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  id={`answer-${index}`}
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-3 sm:px-5 pb-3 sm:pb-4 pl-8 sm:pl-12">
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Support Contact Section */}
        <Card className="p-4 sm:p-6 text-center">
          <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3">Still need help?</h3>
          <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">Get in touch with our support team</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
            <Button variant="primary" size="sm" onClick={() => navigate('/chat')}>
              <MessageSquare size={14} className="mr-1.5 sm:w-4 sm:h-4" />
              Start Chat
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => window.location.href = 'mailto:support@mmr.gov.in?subject=Support Request'}
            >
              <Mail size={14} className="mr-1.5 sm:w-4 sm:h-4" />
              Email Support
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => window.location.href = 'tel:18001234567'}
            >
              <Phone size={14} className="mr-1.5 sm:w-4 sm:h-4" />
              Call Us
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HelpCenterPage;

