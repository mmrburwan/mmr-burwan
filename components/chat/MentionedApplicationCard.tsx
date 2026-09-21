import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ExternalLink, X, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Badge from '../ui/Badge';

export interface ApplicationMentionData {
  type?: string;
  id: string;
  name?: string;
  groomName?: string;
  brideName?: string;
  status?: string;
  verified?: boolean;
  certificateNumber?: string;
}

interface MentionedApplicationCardProps {
  application: ApplicationMentionData;
  mode?: 'bubble' | 'draft';
  isOwn?: boolean;
  onRemove?: () => void;
  userRole?: 'admin' | 'agent' | 'client';
}

export const MentionedApplicationCard: React.FC<MentionedApplicationCardProps> = ({
  application,
  mode = 'bubble',
  isOwn = false,
  onRemove,
  userRole,
}) => {
  const navigate = useNavigate();

  const groom = application.groomName || application.name?.split('&')?.[0]?.trim() || 'Groom';
  const bride = application.brideName || application.name?.split('&')?.[1]?.trim() || 'Bride';
  const status = application.status || 'submitted';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === 'draft') return;

    if (userRole === 'admin') {
      navigate(`/admin/applications/${application.id}`);
    } else if (userRole === 'agent') {
      navigate(`/agent/applications/${application.id}`);
    } else {
      // Default to admin route if user is on admin path, otherwise agent or client
      if (window.location.pathname.startsWith('/admin')) {
        navigate(`/admin/applications/${application.id}`);
      } else if (window.location.pathname.startsWith('/agent')) {
        navigate(`/agent/applications/${application.id}`);
      } else {
        navigate(`/admin/applications/${application.id}`);
      }
    }
  };

  // Draft mode preview bar above textarea
  if (mode === 'draft') {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-900 animate-fadeIn">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
            <FileText size={13} />
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-blue-950 truncate">
              🤵 {groom} & 👰 {bride}
            </span>
            <span className="text-[10px] text-blue-600 font-mono hidden sm:inline">
              (#{application.id.slice(0, 8)})
            </span>
            {application.verified ? (
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded-full">
                Verified
              </span>
            ) : (
              <span className="text-[9px] bg-blue-200/70 text-blue-800 font-medium px-1.5 py-0.2 rounded-full capitalize">
                {status}
              </span>
            )}
          </div>
        </div>

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0"
            title="Remove mentioned application"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  // Bubble mode (inside message)
  return (
    <div
      onClick={handleClick}
      className={`
        mt-1.5 mb-1 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none group
        ${
          isOwn
            ? 'bg-blue-700/60 hover:bg-blue-700/80 border-blue-400/40 text-white'
            : 'bg-gradient-to-r from-amber-50/60 to-orange-50/40 hover:bg-amber-100/50 border-amber-200/80 text-gray-900'
        }
      `}
      title="Click to view application details"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <FileText size={13} className={isOwn ? 'text-blue-200' : 'text-amber-700'} />
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              isOwn ? 'text-blue-200' : 'text-amber-800'
            }`}
          >
            Referenced Application
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold group-hover:translate-x-0.5 transition-transform">
          <span className={isOwn ? 'text-blue-100' : 'text-amber-900'}>View</span>
          <ExternalLink size={12} className={isOwn ? 'text-blue-200' : 'text-amber-700'} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-xs sm:text-sm truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>
            🤵 {groom} & 👰 {bride}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-80">
            <span className="font-mono truncate">ID: {application.id.slice(0, 8)}...</span>
            {application.certificateNumber && (
              <span>• Cert: {application.certificateNumber}</span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          {application.verified ? (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isOwn
                  ? 'bg-emerald-400/30 text-emerald-200 border border-emerald-400/40'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <CheckCircle size={10} />
              Verified
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                isOwn
                  ? 'bg-white/20 text-white border border-white/20'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              <Clock size={10} />
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
