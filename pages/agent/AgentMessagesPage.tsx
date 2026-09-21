import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { messageService } from '../../services/messages';
import { useNotification } from '../../contexts/NotificationContext';
import { Message, Conversation } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import {
  MessageSquare,
  Send,
  Check,
  CheckCheck,
  Clock,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  User,
  Briefcase,
  AlertCircle,
  HelpCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import { safeFormatDateObject, safeFormatDate } from '../../utils/dateUtils';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  MentionedApplicationCard,
  ApplicationMentionData,
} from '../../components/chat/MentionedApplicationCard';
import { MentionApplicationModal } from '../../components/chat/MentionApplicationModal';

const QUICK_PROMPTS = [
  '📌 Checking status on recently submitted application',
  '📄 Document clarification: re-uploaded required proofs',
  '🔒 Requesting certificate download access for client',
  '⏱️ Urgent: applicant requested fast-track appointment verification',
];

const AgentMessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useNotification();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Mention Application State
  const [selectedApplication, setSelectedApplication] = useState<ApplicationMentionData | null>(null);
  const [isMentionModalOpen, setIsMentionModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize or fetch conversation with admin
  const loadConversationAndMessages = useCallback(async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);

      // Get or create conversation for this agent
      const conv = await messageService.getOrCreateConversation(user.id);
      setConversation(conv);

      // Load all messages for this conversation
      const msgs = await messageService.getMessages(conv.id);
      setMessages(msgs);

      // Mark messages as read by agent
      if (conv.unreadCount > 0) {
        await messageService.markAsRead(conv.id, user.id);
      }
    } catch (error: any) {
      console.error('Failed to load agent conversation:', error);
      showToast('Failed to load messages with admin', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, showToast]);

  useEffect(() => {
    loadConversationAndMessages();
  }, [loadConversationAndMessages]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!conversation?.id || !user?.id) return;

    const channel = messageService.subscribeToMessages(conversation.id, (newMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) {
          return prev.map((m) => (m.id === newMessage.id ? newMessage : m));
        }
        return [...prev, newMessage];
      });

      // If message is from admin, mark as read
      if (newMessage.senderId !== user.id) {
        messageService.markAsRead(conversation.id, user.id);
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    messageChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [conversation?.id, user?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [messages.length]);

  // Handle send message with optional application attachment
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || messageText).trim();
    if ((!textToSend && !selectedApplication) || !user || !conversation || isSending) return;

    const appToAttach = selectedApplication;
    setMessageText('');
    setSelectedApplication(null);
    setIsSending(true);

    try {
      const senderDisplayName = user.name ? `${user.name} (Agent)` : 'Agent';
      const attachments = appToAttach
        ? [
            {
              type: 'application',
              id: appToAttach.id,
              name:
                appToAttach.name ||
                `${appToAttach.groomName || ''} & ${appToAttach.brideName || ''}`.trim(),
              groomName: appToAttach.groomName,
              brideName: appToAttach.brideName,
              status: appToAttach.status,
              verified: appToAttach.verified,
              certificateNumber: appToAttach.certificateNumber,
              url: `/agent/applications/${appToAttach.id}`,
            },
          ]
        : undefined;

      const messageContent =
        textToSend ||
        `Referenced Application: ${appToAttach?.groomName || ''} & ${appToAttach?.brideName || ''}`;

      await messageService.sendMessage(
        conversation.id,
        user.id,
        senderDisplayName,
        messageContent,
        attachments
      );

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      showToast(error.message || 'Failed to send message to admin', 'error');
      setMessageText(textToSend); // Restore text on failure
      setSelectedApplication(appToAttach); // Restore mention on failure
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return safeFormatDateObject(date, 'hh:mm a');
    } catch {
      return '';
    }
  };

  const formatMessageDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return safeFormatDateObject(date, 'dd MMM yyyy');
    } catch {
      return '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/agent/dashboard')}
            className="!text-xs sm:!text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} className="mr-1 sm:mr-1.5" />
            Dashboard
          </Button>
          <div className="h-4 w-px bg-gray-200" />
          <h1 className="font-serif text-lg sm:text-2xl font-bold text-gray-900">
            Admin Communication
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadConversationAndMessages}
          className="!text-xs gap-1.5"
          disabled={isLoading}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Main Chat Interface Container */}
      <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
        {/* Chat Room Banner / Admin Profile Info */}
        <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-50/80 via-white to-gold-50/40 border-b border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <ShieldCheck size={20} />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm sm:text-base text-gray-900">
                  Marriage Registrar Admin Desk
                </h2>
                <Badge variant="info" className="!text-[10px] hidden sm:inline-flex">
                  Burwan MMR
                </Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                Official line for application verifications, queries & urgent approvals
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 bg-white/80 px-3 py-1.5 rounded-lg border border-gray-200">
            <Clock size={13} className="text-gray-400" />
            <span>Response within office hours</span>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-slate-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-xs sm:text-sm text-gray-500">Connecting to admin message channel...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto py-8">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-4 shadow-sm">
                <MessageSquare size={28} />
              </div>
              <h3 className="font-serif font-bold text-gray-900 text-base sm:text-lg mb-1">
                Direct Line with Marriage Registrar Admin
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
                Welcome to your agent communication desk. Send questions, mention applications for review, or clarify client documents directly with the admin.
              </p>

              {/* Suggestions */}
              <div className="w-full text-left space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                  Quick Topics to Inquire:
                </p>
                <div className="space-y-1.5">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full text-left text-xs bg-white hover:bg-blue-50 hover:border-blue-300 border border-gray-200 text-gray-700 px-3 py-2 rounded-xl transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <span className="truncate">{prompt}</span>
                      <Send
                        size={12}
                        className="text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all ml-2 flex-shrink-0"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isOwn = msg.senderId === user?.id;
                const prevMsg = index > 0 ? messages[index - 1] : null;

                // Date separator
                const showDateHeader =
                  !prevMsg ||
                  new Date(msg.timestamp).toDateString() !==
                    new Date(prevMsg.timestamp).toDateString();

                return (
                  <React.Fragment key={msg.id}>
                    {showDateHeader && (
                      <div className="flex items-center justify-center my-3">
                        <span className="bg-slate-200/80 text-gray-600 text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {formatMessageDate(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex gap-2 sm:gap-3 ${
                        isOwn ? 'flex-row-reverse' : 'flex-row'
                      } items-end`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {isOwn ? (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shadow-xs">
                            {user?.name?.charAt(0).toUpperCase() || 'A'}
                          </div>
                        ) : (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center text-white text-[11px] font-bold shadow-xs">
                            <ShieldCheck size={14} />
                          </div>
                        )}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`flex flex-col ${
                          isOwn ? 'items-end' : 'items-start'
                        } max-w-[85%] sm:max-w-[75%]`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[10px] sm:text-[11px] font-medium text-gray-500">
                            {isOwn ? 'You (Field Agent)' : 'Registrar Admin'}
                          </span>
                        </div>

                        <div
                          className={`rounded-2xl px-3.5 py-2.5 shadow-xs transition-all ${
                            isOwn
                              ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-xs'
                              : 'bg-white border border-slate-200 text-gray-900 rounded-bl-xs'
                          }`}
                        >
                          <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed font-normal">
                            {msg.content}
                          </p>

                          {/* Mentioned Application Card inside message bubble */}
                          {msg.attachments?.map((att, attIdx) => {
                            if (att.type === 'application') {
                              return (
                                <MentionedApplicationCard
                                  key={attIdx}
                                  application={att}
                                  mode="bubble"
                                  isOwn={isOwn}
                                  userRole="agent"
                                />
                              );
                            }
                            return null;
                          })}

                          <div
                            className={`flex items-center gap-1 mt-1 text-[9px] sm:text-[10px] ${
                              isOwn ? 'text-blue-100 justify-end' : 'text-gray-400 justify-start'
                            }`}
                          >
                            <span>{formatMessageTime(msg.timestamp)}</span>
                            {isOwn && (
                              <CheckCheck size={12} className="text-blue-200 inline" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick Suggestion Pill Chips (when there are existing messages) */}
        {messages.length > 0 && (
          <div className="px-3 py-1.5 bg-gray-50/90 border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap pl-1">
              Quick Inquire:
            </span>
            {QUICK_PROMPTS.slice(0, 2).map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="text-[10px] whitespace-nowrap bg-white hover:bg-blue-50 hover:border-blue-300 border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full transition-colors flex-shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Message Input Toolbar with Mention Application Support */}
        <div className="p-2.5 sm:p-3 bg-white border-t border-gray-200 flex-shrink-0">
          {/* Draft Mention Card Preview */}
          {selectedApplication && (
            <div className="mb-2">
              <MentionedApplicationCard
                application={selectedApplication}
                mode="draft"
                onRemove={() => setSelectedApplication(null)}
              />
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            {/* Mention Application Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMentionModalOpen(true)}
              className="!px-2.5 !py-2.5 !rounded-xl text-gray-600 hover:text-blue-600 hover:bg-blue-50 border-gray-200 flex items-center gap-1.5 flex-shrink-0"
              title="Mention an application"
            >
              <FileText size={16} className="text-blue-600" />
              <span className="text-xs hidden sm:inline font-medium">Mention App</span>
            </Button>

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Type your message to Marriage Registrar Admin... (Enter to send)"
                className="w-full resize-none rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none max-h-32 transition-all"
                style={{ minHeight: '42px' }}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={(!messageText.trim() && !selectedApplication) || isSending}
              className="!px-4 !py-2.5 !rounded-xl !bg-blue-600 hover:!bg-blue-700 text-white flex-shrink-0 flex items-center gap-1.5"
            >
              {isSending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline text-xs font-semibold">Send</span>
                  <Send size={15} />
                </>
              )}
            </Button>
          </form>
          <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-gray-400">
            <span>Press Enter to send, Shift + Enter for new line</span>
            <span>Attach an application to reference questions or requests</span>
          </div>
        </div>
      </Card>

      {/* Mention Application Modal */}
      {user?.id && (
        <MentionApplicationModal
          isOpen={isMentionModalOpen}
          onClose={() => setIsMentionModalOpen(false)}
          onSelect={(app) => {
            const groomName = app.userDetails?.firstName
              ? `${app.userDetails.firstName} ${app.userDetails.lastName || ''}`.trim()
              : undefined;
            const brideName = app.partnerForm?.firstName
              ? `${app.partnerForm.firstName} ${app.partnerForm.lastName || ''}`.trim()
              : undefined;

            setSelectedApplication({
              type: 'application',
              id: app.id,
              name: `${groomName || 'Groom'} & ${brideName || 'Bride'}`,
              groomName,
              brideName,
              status: app.status,
              verified: app.verified,
              certificateNumber: app.certificateNumber,
            });
          }}
          agentId={user.id}
          role="agent"
        />
      )}
    </div>
  );
};

export default AgentMessagesPage;
