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
      <div className="max-w-4xl mx-auto px-6 pt-8 pb-8">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to Dashboard
          </Button>
          <div className="text-center">
            <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Help Center</h1>
            <p className="text-gray-600">Find answers to common questions</p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="space-y-4 mb-8">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <Card key={index} className="overflow-hidden">
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gold-200 focus:ring-offset-2 rounded-xl"
                  aria-expanded={isOpen}
                  aria-controls={`answer-${index}`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-shrink-0">
                      <HelpCircle size={20} className="text-gold-600 mt-0.5" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg pr-4">
                      {faq.question}
                    </h3>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`flex-shrink-0 text-gold-600 transition-transform duration-300 ${
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
                  <div className="px-6 pb-5 pl-14">
                    <div className="pt-2 pb-2">
                      <p className="text-gray-600 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Support Contact Section */}
        <Card className="p-8 text-center">
          <h3 className="font-semibold text-gray-900 mb-4">Still need help?</h3>
          <p className="text-gray-600 mb-6">Get in touch with our support team</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" onClick={() => navigate('/chat')}>
              <MessageSquare size={18} className="mr-2" />
              Start Chat
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = 'mailto:support@mmr.gov.in?subject=Support Request'}
            >
              <Mail size={18} className="mr-2" />
              Email Support
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = 'tel:18001234567'}
            >
              <Phone size={18} className="mr-2" />
              Call Us
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HelpCenterPage;

