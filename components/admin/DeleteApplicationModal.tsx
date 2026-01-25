import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    groomName?: string;
    brideName?: string;
    applicationId: string;
}

const DeleteApplicationModal: React.FC<DeleteApplicationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    groomName,
    brideName,
    applicationId,
}) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
            console.error('Failed to delete application:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Delete Application"
            size="sm"
        >
            <div className="space-y-4 sm:space-y-6">
                {/* Warning Icon & Message */}
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-red-50 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Confirm Deletion</h3>
                        <p className="text-xs sm:text-sm text-gray-500">
                            Are you sure you want to delete this application? This action <span className="text-red-600 font-medium">cannot be undone</span>.
                        </p>
                    </div>
                </div>

                {/* Application Details */}
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100">
                    <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide mb-2">Application Details</p>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] sm:text-sm">
                            <span className="text-gray-600">ID:</span>
                            <span className="font-mono text-gray-900 font-medium">{applicationId}</span>
                        </div>
                        {(groomName || brideName) && (
                            <div className="flex justify-between items-center text-[11px] sm:text-sm">
                                <span className="text-gray-600">Couple:</span>
                                <span className="font-medium text-gray-900">{groomName || 'N/A'} & {brideName || 'N/A'}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-[11px] sm:text-sm">
                            <span className="text-gray-600">Status:</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800 border border-gray-200 uppercase">
                                Draft
                            </span>
                        </div>
                    </div>
                </div>

                <p className="text-[10px] sm:text-xs text-gray-500 italic text-center">
                    Note: Only the application data will be removed. The user account associated with this application will remain intact.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-200">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 !text-xs sm:!text-sm hover:bg-gray-100"
                        size="sm"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        isLoading={isDeleting}
                        disabled={isDeleting}
                        className="flex-1 !text-xs sm:!text-sm !bg-red-600 hover:!bg-red-700 !border-red-600 shadow-sm"
                        size="sm"
                    >
                        <Trash2 size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span>Delete Application</span>
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteApplicationModal;
