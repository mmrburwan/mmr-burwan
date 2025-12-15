import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { MapPin, Phone, Mail, Globe, ArrowLeft, AlertTriangle } from 'lucide-react';

const ContactPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-16 sm:pt-20 pb-6 sm:pb-8">
            <div className="mb-4 sm:mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                    className="mb-3 sm:mb-4"
                >
                    <ArrowLeft size={16} className="mr-1.5" />
                    Back
                </Button>
                <div className="text-center">
                    <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                        Contact Us
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-600">
                        Muhammadan Marriage Registrar & Qaazi Details
                    </p>
                </div>
            </div>

            {/* Office Details Card */}
            <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="font-semibold text-lg sm:text-xl text-gray-900 mb-4 sm:mb-6 text-center">
                    Office Information
                </h2>

                <div className="space-y-4 sm:space-y-5">
                    {/* Address */}
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gold-50 rounded-lg flex items-center justify-center">
                            <MapPin size={20} className="sm:w-6 sm:h-6 text-gold-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                                Office Address
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                                VILL. & P.O- GRAMSALIKA<br />
                                P.S- BURWAN<br />
                                DIST- MURSHIDABAD<br />
                                WEST BENGAL, PIN-742132
                            </p>
                        </div>
                    </div>

                    {/* Phone Numbers */}
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gold-50 rounded-lg flex items-center justify-center">
                            <Phone size={20} className="sm:w-6 sm:h-6 text-gold-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                                Contact Numbers
                            </h3>
                            <div className="space-y-1">
                                <a
                                    href="tel:9732688698"
                                    className="block text-xs sm:text-sm text-gold-600 hover:text-gold-700 transition-colors"
                                >
                                    9732688698
                                </a>
                                <a
                                    href="tel:9647724532"
                                    className="block text-xs sm:text-sm text-gold-600 hover:text-gold-700 transition-colors"
                                >
                                    9647724532
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Email */}
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gold-50 rounded-lg flex items-center justify-center">
                            <Mail size={20} className="sm:w-6 sm:h-6 text-gold-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                                Email Address
                            </h3>
                            <a
                                href="mailto:mmrburwan@gmail.com"
                                className="text-xs sm:text-sm text-gold-600 hover:text-gold-700 transition-colors"
                            >
                                mmrburwan@gmail.com
                            </a>
                        </div>
                    </div>

                    {/* Website */}
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gold-50 rounded-lg flex items-center justify-center">
                            <Globe size={20} className="sm:w-6 sm:h-6 text-gold-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                                Website
                            </h3>
                            <a
                                href="https://mmrburwan.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs sm:text-sm text-gold-600 hover:text-gold-700 transition-colors"
                            >
                                mmrburwan.com
                            </a>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Important Instructions Card */}
            <Card className="p-4 sm:p-6 bg-amber-50 border-amber-200">
                <div className="flex items-start gap-3 mb-3 sm:mb-4">
                    <AlertTriangle size={20} className="sm:w-6 sm:h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                    <h2 className="font-semibold text-base sm:text-lg text-amber-900">
                        গুরুত্বপূর্ণ নির্দেশাবলী / Important Instructions
                    </h2>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    <p className="text-xs sm:text-sm text-amber-900 font-medium">
                        বি.দ্র. ম্যারেজ রেজিস্ট্রি অফিসে নিকাহ রেজিস্ট্রেশনের জন্য নিম্নে লিখিত ডকুমেন্ট গুলা আনা বাধ্যতামূলক
                    </p>

                    <div className="space-y-2 sm:space-y-3 pl-2 sm:pl-3">
                        <div className="flex items-start gap-2 sm:gap-3">
                            <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                                1
                            </span>
                            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed flex-1">
                                পাত্র-পাত্রী উভয়ের আধার কার্ড।
                            </p>
                        </div>

                        <div className="flex items-start gap-2 sm:gap-3">
                            <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                                2
                            </span>
                            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed flex-1">
                                পাত্র-পাত্রী উভয়ের দশম শ্রেণীর এডমিট কার্ড অথবা ভোটার আইডি যেটা ওয়েবসাইটে আপলোড করা হয়েছে।
                            </p>
                        </div>

                        <div className="flex items-start gap-2 sm:gap-3">
                            <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                                3
                            </span>
                            <p className="text-xs sm:text-sm text-amber-900 leading-relaxed flex-1">
                                তিন কপি জয়েন্ট রঙিন পাসপোর্ট সাইজ ছবি।
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Quick Actions */}
            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => navigate('/auth/register')}
                >
                    Start Registration
                </Button>
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate('/help')}
                >
                    Get Help
                </Button>
            </div>
        </div>
    );
};

export default ContactPage;
