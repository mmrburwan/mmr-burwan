import React from 'react';
import { Application } from '../../types';
import QRCode from '../../components/ui/QRCode';
import { CheckCircle } from 'lucide-react';

interface AcknowledgementSlipTemplateProps {
    application: Application;
    userEmail?: string;
}

const AcknowledgementSlipTemplate: React.FC<AcknowledgementSlipTemplateProps> = ({ application, userEmail }) => {
    // Extract Data
    const groomName = (`${(application.userDetails as any)?.firstName || ''} ${(application.userDetails as any)?.lastName || ''}`).trim();
    const groomFather = (application.userDetails as any)?.fatherName || 'N/A';
    const groomMobile = (application.userDetails as any)?.mobileNumber || 'N/A';

    const brideName = (`${(application.partnerForm as any)?.firstName || ''} ${(application.partnerForm as any)?.lastName || ''}`).trim();
    const brideFather = (application.partnerForm as any)?.fatherName || 'N/A';
    const brideMobile = (application.partnerForm as any)?.mobileNumber || 'N/A';

    const displayEmail = userEmail || 'N/A';

    const qrData = JSON.stringify({
        applicationId: application.id,
        type: 'acknowledgement'
    });

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 print:shadow-none print:border-none max-w-4xl mx-auto">

            {/* Header */}
            <div className="text-center border-b-[1px] border-gold-400 pb-4 mb-4">
                <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">MMR BURWAN</h1>
                <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">Marriage Registration Acknowledgement</p>

                <div className="text-[12px] text-gray-700 font-serif leading-tight border-t border-gray-100 pt-2">
                    <p className="font-bold">Muhammadan Marriage Registrar & Qaazi Details:</p>
                    <p className="font-bold">Office Address: VILL. & P.O- GRAMSALIKA, P.S- BURWAN, DIST- MURSHIDABAD, WEST BENGAL, PIN-742132</p>
                    <p className="font-bold">Contact: 9732688698, 9647724532 | mmrburwan@gmail.com | mmrburwan.com</p>
                </div>
            </div>

            {/* Bengali Instructions */}
            <div className="mb-6">
                <h4 className="text-xs font-bold text-red-600 mb-2 uppercase flex items-center print:text-black">
                    <span className="mr-1.5 text-base">⚠️</span> Important Instructions
                </h4>
                <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-xs text-gray-800 leading-relaxed font-serif print:bg-transparent print:border print:border-gray-200">
                    <p className="text-[15px] font-bold">বি.দ্র. ম্যারেজ রেজিস্ট্রি অফিসে নিকাহ রেজিস্ট্রেশনের জন্য নিম্নলিখিত ডকুমেন্ট গুলো আনা বাধ্যতামূলক </p>
                    <p className="text-[13px] mb-2 font-bold"> 1. পাত্র-পাত্রী উভয়ের আধার কার্ড। </p>
                    <p className="text-[13px] mb-2 font-bold"> 2. পাত্র-পাত্রী উভয়ের দশম শ্রেণীর এডমিট কার্ড অথবা ভোটার আইডি যেটা ওয়েবসাইটে আপলোড করা হয়েছে। </p>
                    <p className="text-[13px] mb-2 font-bold"> 3. তিন কপি জয়েন্ট রঙিন পাসপোর্ট সাইজ ছবি। </p>
                </div>
            </div>

            {/* Success Badge */}
            <div className="flex items-center justify-center mb-6 bg-green-50 p-2 rounded-lg border border-green-100 print:bg-transparent print:border-none">
                <CheckCircle className="text-green-600 w-5 h-5 mr-2" />
                <span className="text-green-800 font-medium text-sm">Application Submitted Successfully</span>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 print:grid-cols-3">

                {/* Left Column: Details */}
                <div className="md:col-span-2 space-y-4 print:col-span-2">

                    {/* Application Info */}
                    <div className="bg-gray-50 p-3 rounded-lg print:border print:border-gray-200">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Application Info</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-gray-500">Application ID</p>
                                <p className="font-mono font-bold text-base text-gray-900">{application.id}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500">Date</p>
                                <p className="font-medium text-sm text-gray-900">
                                    {application.submitted_at
                                        ? new Date(application.submitted_at).toLocaleDateString()
                                        : new Date().toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Groom & Bride Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                        <div className="border border-gray-200 p-3 rounded-lg">
                            <h3 className="text-gold-600 font-bold mb-2 border-b border-gray-100 pb-1 text-xs print:text-black">Groom Details</h3>
                            <div className="space-y-1.5">
                                <div>
                                    <p className="text-[10px] text-gray-500">Name</p>
                                    <p className="font-medium text-sm">{groomName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500">Father's Name</p>
                                    <p className="font-medium text-sm">{groomFather}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500">Mobile</p>
                                    <p className="font-medium text-sm">{groomMobile}</p>
                                </div>
                            </div>
                        </div>

                        <div className="border border-gray-200 p-3 rounded-lg">
                            <h3 className="text-gold-600 font-bold mb-2 border-b border-gray-100 pb-1 text-xs print:text-black">Bride Details</h3>
                            <div className="space-y-1.5">
                                <div>
                                    <p className="text-[10px] text-gray-500">Name</p>
                                    <p className="font-medium text-sm">{brideName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500">Father's Name</p>
                                    <p className="font-medium text-sm">{brideFather}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500">Mobile</p>
                                    <p className="font-medium text-sm">{brideMobile}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info (Keeping email as fallback contact point) */}
                    <div className="border border-gray-200 p-3 rounded-lg">
                        <h3 className="text-gray-700 font-bold mb-2 text-xs uppercase">Registration Email</h3>
                        <div>
                            <p className="text-[10px] text-gray-500">Email</p>
                            <p className="font-medium text-sm">{displayEmail}</p>
                        </div>
                    </div>

                </div>

                {/* Right Column: QR Code */}
                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 print:bg-white print:border-gray-300">
                    <div className="bg-white p-2 rounded-lg shadow-sm mb-2">
                        <QRCode value={qrData} size={130} />
                    </div>
                    <p className="text-[10px] text-center text-gray-500 mb-1">Scan at Office</p>
                    <p className="text-[8px] text-center text-gray-400 font-mono break-all">{application.id}</p>
                </div>
            </div>



            {/* Footer */}
            <div className="mt-8 text-center text-[10px] text-gray-400 print:mt-auto print:pt-4 print:fixed print:bottom-4 print:left-0 print:right-0">
                <p>© MMR Burwan Official Portal. This is a computer generated slip.</p>
            </div>

        </div>
    );
};

export default AcknowledgementSlipTemplate;
