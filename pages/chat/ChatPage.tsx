import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { messageService } from '../../services/messages';
import { useNotification } from '../../contexts/NotificationContext';
import { Message, Conversation } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { MessageSquare, Send, Check, RotateCw, X, ArrowLeft } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';
import { RealtimeChannel } from '@supabase/supabase-js';

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const conversationChannelRef = useRef<RealtimeChannel | null>(null);

  // Load conversations
  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      try {
        let convs = await messageService.getConversations(user.id);
        
        // Remove duplicates - keep only the most recent one for each user_id/admin_id combination
        const uniqueConvs = convs.reduce((acc, conv) => {
          const key = `${conv.userId}-${conv.adminId || 'null'}`;
          const existing = acc.find(c => `${c.userId}-${c.adminId || 'null'}` === key);
          if (!existing) {
            acc.push(conv);
          } else {
            // Keep the one with the latest updatedAt
            const existingIndex = acc.indexOf(existing);
            if (new Date(conv.updatedAt) > new Date(existing.updatedAt)) {
              acc[existingIndex] = conv;
            }
          }
          return acc;
        }, [] as Conversation[]);
        
        // Sort by updated_at
        uniqueConvs.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        
        if (uniqueConvs.length === 0) {
          const newConv = await messageService.getOrCreateConversation(user.id);
          uniqueConvs.push(newConv);
        }
        
        setConversations(uniqueConvs);
        if (!selectedConversation && uniqueConvs.length > 0) {
          setSelectedConversation(uniqueConvs[0].id);
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
        showToast('Failed to load conversations', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();

    // Subscribe to conversation updates
    const convChannel = messageService.subscribeToConversations(user.id, (updatedConv) => {
      setConversations((prev) => {
        // Remove duplicates first
        const unique = prev.reduce((acc, conv) => {
          const key = `${conv.userId}-${conv.adminId || 'null'}`;
          const existing = acc.find(c => `${c.userId}-${c.adminId || 'null'}` === key);
          if (!existing) {
            acc.push(conv);
          } else {
            const existingIndex = acc.indexOf(existing);
            if (new Date(conv.updatedAt) > new Date(existing.updatedAt)) {
              acc[existingIndex] = conv;
            }
          }
          return acc;
        }, [] as Conversation[]);
        
        const index = unique.findIndex((c) => c.id === updatedConv.id);
        if (index >= 0) {
          unique[index] = updatedConv;
        } else {
          // Check if this is a duplicate before adding
          const isDuplicate = unique.some(c => 
            c.userId === updatedConv.userId && 
            c.adminId === updatedConv.adminId
          );
          if (!isDuplicate) {
            unique.push(updatedConv);
          }
        }
        
        // Sort by updated_at
        return unique.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    });
    conversationChannelRef.current = convChannel;

    return () => {
      convChannel.unsubscribe();
    };
  }, [user, showToast, selectedConversation]);

  // Load messages and subscribe to realtime updates
  useEffect(() => {
    if (!selectedConversation || !user) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const msgs = await messageService.getMessages(selectedConversation);
        setMessages(msgs);
        await messageService.markAsRead(selectedConversation, user.id);
        
        // Update conversation unread count
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation ? { ...conv, unreadCount: 0 } : conv
          )
        );
      } catch (error) {
        console.error('Failed to load messages:', error);
        setMessages([]);
      }
    };

    loadMessages();

    // Subscribe to new messages
    const msgChannel = messageService.subscribeToMessages(selectedConversation, (newMessage) => {
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some((m) => m.id === newMessage.id)) {
          // Update existing message
          return prev.map((m) => (m.id === newMessage.id ? newMessage : m));
        }
        // Add new message
        return [...prev, newMessage];
      });

      // Mark as read if it's not from current user (for unread count only)
      if (newMessage.senderId !== user.id) {
        messageService.markAsRead(selectedConversation, user.id);
      }
      
      // Remove failed temporary messages with same content when a new message arrives
      setMessages((prev) => {
        const filtered = prev.filter((m) => {
          // Keep failed messages that don't match the new message content
          if (m.status === 'failed' && m.content === newMessage.content) {
            return false;
          }
          return true;
        });
        return filtered;
      });

      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    messageChannelRef.current = msgChannel;

    return () => {
      msgChannel.unsubscribe();
    };
  }, [selectedConversation, user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !user || isSending) return;

    const textToSend = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      let convId = selectedConversation;
      if (!convId) {
        const newConv = await messageService.getOrCreateConversation(user.id);
        convId = newConv.id;
        setSelectedConversation(convId);
        setConversations([newConv]);
      }

      // Include email in sender_name so admin can see it
      const senderName = user.name ? `${user.name} ${user.email}` : user.email;
      await messageService.sendMessage(convId, user.id, senderName, textToSend);
      
      // Message will be added via realtime subscription
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      showToast(error.message || 'Failed to send message', 'error');
      setMessageText(textToSend);
      
      // Add failed message to UI immediately
      const failedMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId: selectedConversation || '',
        senderId: user.id,
        senderName: user.name || user.email,
        content: textToSend,
        status: 'failed',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, failedMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = async (messageId: string, content: string) => {
    if (!user || !selectedConversation || isSending) return;
    
    setIsSending(true);
    
    // Remove the failed message from UI
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    
    try {
      await messageService.sendMessage(selectedConversation, user.id, user.name || user.email, content);
      // Message will be added via realtime subscription
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error('Failed to resend message:', error);
      showToast(error.message || 'Failed to resend message', 'error');
      
      // Add failed message back to UI
      const failedMessage: Message = {
        id: messageId.startsWith('temp-') ? messageId : `temp-${Date.now()}`,
        conversationId: selectedConversation,
        senderId: user.id,
        senderName: user.name || user.email,
        content: content,
        status: 'failed',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, failedMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return safeFormatDateObject(date, 'HH:mm');
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return safeFormatDateObject(date, 'EEE');
    } else {
      return safeFormatDateObject(date, 'MMM d');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  const currentConversation = conversations.find((c) => c.id === selectedConversation);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-3 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0 !px-2 sm:!px-3"
          >
            <ArrowLeft size={16} className="sm:w-[18px] sm:h-[18px] mr-1 sm:mr-2" />
            <span className="text-xs sm:text-sm">Back</span>
          </Button>
        </div>
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-0.5 sm:mb-1">Messages</h1>
        <p className="text-xs sm:text-sm text-gray-600">Chat with registrar office</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 h-[calc(100vh-160px)] sm:h-[calc(100vh-200px)]">
        {/* Conversations List - Hidden on mobile when conversation is selected */}
        <Card className={`p-0 overflow-hidden flex flex-col shadow-lg ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-gradient-to-r from-gold-50 via-rose-50 to-gold-50">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900">Conversations</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length > 0 ? (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`
                    w-full p-3 sm:p-4 text-left hover:bg-gradient-to-r hover:from-gold-50/50 hover:to-rose-50/50 transition-all duration-200 border-b border-gray-100
                    ${selectedConversation === conv.id ? 'bg-gradient-to-r from-gold-50 to-rose-50 border-l-4 border-gold-500 shadow-sm' : ''}
                  `}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0 shadow-md">
                      {conv.adminId ? 'R' : 'S'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                        <span className="font-semibold text-xs sm:text-sm text-gray-900">
                          {conv.adminId ? 'Registrar' : 'Support'}
                        </span>
                        {conv.unreadCount > 0 && (
                          <Badge variant="info" className="flex-shrink-0 ml-2">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {conv.lastMessage ? (
                        <>
                          <p className="text-[10px] sm:text-xs text-gray-600 truncate mb-0.5">
                            {conv.lastMessage.content}
                          </p>
                          <p className="text-[9px] sm:text-xs text-gray-400">
                            {formatTime(conv.lastMessage.timestamp)}
                          </p>
                        </>
                      ) : (
                        <p className="text-[10px] sm:text-xs text-gray-400 italic">No messages</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-5 sm:p-8 text-center">
                <MessageSquare size={36} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">No conversations</p>
                <Button variant="outline" size="sm" className="!text-xs sm:!text-sm" onClick={async () => { if (user) { try { const newConv = await messageService.getOrCreateConversation(user.id); setConversations([newConv]); setSelectedConversation(newConv.id); } catch (error) { showToast('Failed to create conversation', 'error'); } } }}>
                  Start Chat
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Chat Window */}
        <div className={`lg:col-span-2 ${selectedConversation ? 'block' : 'hidden lg:block'}`}>
          <Card className="p-0 flex flex-col h-full shadow-lg">
            {selectedConversation ? (
              <>
                <div className="p-3 sm:p-4 border-b border-gray-200 bg-gradient-to-r from-gold-50 via-rose-50 to-gold-50">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedConversation(null)}
                      className="lg:hidden !p-1.5"
                    >
                      <ArrowLeft size={16} />
                    </Button>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-semibold text-xs sm:text-sm shadow-md">
                      {currentConversation?.adminId ? 'R' : 'S'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base text-gray-900">
                        {currentConversation?.adminId ? 'Registrar' : 'Support'}
                      </h3>
                      <p className="text-[9px] sm:text-xs text-gray-500">Usually replies in a few hours</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 bg-gradient-to-b from-gray-50 to-white">
                  {messages.length > 0 ? (
                    messages.map((msg, index) => {
                      const isOwn = msg.senderId === user?.id;
                      const showAvatar = index === 0 || messages[index - 1].senderId !== msg.senderId;
                      const showTime = index === messages.length - 1 || new Date(msg.timestamp).getTime() - new Date(messages[index + 1].timestamp).getTime() > 300000;

                      return (
                        <div key={msg.id} className={`flex gap-2 sm:gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end`}>
                          {showAvatar && !isOwn && (
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-white font-semibold text-[10px] sm:text-xs flex-shrink-0 shadow-md">
                              {msg.senderName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {showAvatar && isOwn && (
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-[10px] sm:text-xs flex-shrink-0 shadow-md">
                              {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                          )}
                          {!showAvatar && <div className="w-7 sm:w-8 flex-shrink-0" />}
                          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[75%]`}>
                            {showAvatar && (
                              <p className="text-[9px] sm:text-xs text-gray-500 mb-1 px-1.5 sm:px-2 font-medium truncate max-w-full">{msg.senderName.split(' ')[0]}</p>
                            )}
                            <div className={`rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-md transition-all ${isOwn ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                              <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                              {showTime && (
                                <div className={`flex items-center gap-1 mt-1 sm:mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  <span className={`text-[9px] sm:text-xs ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>{formatTime(msg.timestamp)}</span>
                                  {isOwn && (msg.status === 'sent' ? <Check size={10} className="sm:w-3 sm:h-3 text-blue-200" /> : msg.status === 'failed' ? <button onClick={() => handleRetry(msg.id, msg.content)} className="flex items-center gap-0.5 text-red-500 text-[9px] sm:text-xs"><X size={10} className="sm:w-3 sm:h-3" /><span>Retry</span></button> : null)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-gold-100 to-rose-100 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                          <MessageSquare size={28} className="sm:w-8 sm:h-8 text-gold-600" />
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">No messages</h3>
                        <p className="text-xs sm:text-sm text-gray-500">Start the conversation!</p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-2 sm:p-3 border-t border-gray-200 bg-white">
                  <div className="flex gap-2 sm:gap-3">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type message..."
                      className="flex-1"
                      disabled={!user || isSending}
                    />
                    <Button variant="primary" size="sm" onClick={handleSend} disabled={!messageText.trim() || !user || isSending} isLoading={isSending} className="!px-3 sm:!px-4 shadow-md">
                      <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-gradient-to-b from-gray-50 to-white">
                <div className="text-center p-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gold-100 to-rose-100 flex items-center justify-center mx-auto mb-4 sm:mb-5">
                    <MessageSquare size={32} className="sm:w-10 sm:h-10 text-gold-600" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 sm:mb-2">Select a conversation</h3>
                  <p className="text-xs sm:text-sm text-gray-500">Choose from the list to start</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
