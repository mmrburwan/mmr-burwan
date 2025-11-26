import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { messageService } from '../../services/messages';
import { applicationService } from '../../services/application';
import { useNotification } from '../../contexts/NotificationContext';
import { Message, Conversation } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { MessageSquare, Send, Check, CheckCheck, Clock, Search, User, ArrowLeft } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';
import { RealtimeChannel } from '@supabase/supabase-js';

type ConversationWithUser = Conversation & { userName?: string; userEmail?: string };

const AdminChatPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ConversationWithUser[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const conversationChannelRef = useRef<RealtimeChannel | null>(null);

  // Check if userId is provided in URL params
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId && user) {
      // Get or create conversation with this user
      messageService.getOrCreateConversation(userId, user.id).then((conv) => {
        setSelectedConversation(conv.id);
        // Update conversations list
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === conv.id);
          if (exists) return prev;
          return [conv as ConversationWithUser, ...prev];
        });
      });
    }
  }, [searchParams, user]);

  // Load conversations
  useEffect(() => {
    if (!user) return;

    const loadConversations = async () => {
      try {
        setIsLoading(true);
        const convs = await messageService.getAllConversationsForAdmin();
        console.log('Loaded conversations for admin:', convs);
        setConversations(convs);
        setFilteredConversations(convs);
        
        // If userId param exists, select that conversation
        const userId = searchParams.get('userId');
        if (userId) {
          const conv = convs.find((c) => c.userId === userId);
          if (conv) {
            setSelectedConversation(conv.id);
          }
        } else if (convs.length > 0 && !selectedConversation) {
          // Select the most recent conversation
          setSelectedConversation(convs[0].id);
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
        showToast('Failed to load conversations. Please refresh the page.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();

    // Subscribe to conversation updates
    const convChannel = messageService.subscribeToAllConversations((updatedConv) => {
      console.log('Conversation updated via realtime:', updatedConv);
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === updatedConv.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = updatedConv;
          const sorted = updated.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          setFilteredConversations(sorted);
          return sorted;
        } else {
          // New conversation - add it
          const newList = [updatedConv, ...prev].sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          setFilteredConversations(newList);
          return newList;
        }
      });
    });
    conversationChannelRef.current = convChannel;

    return () => {
      convChannel.unsubscribe();
    };
  }, [user, showToast, searchParams]);

  // Filter conversations based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const filtered = conversations.filter((conv) =>
      conv.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.lastMessage?.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredConversations(filtered);
  }, [searchTerm, conversations]);

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
      console.log('New message received via realtime:', newMessage);
      setMessages((prev) => {
        // Check if message already exists
        const existingIndex = prev.findIndex((m) => m.id === newMessage.id);
        if (existingIndex >= 0) {
          // Update existing message
          const updated = [...prev];
          updated[existingIndex] = newMessage;
          return updated;
        }
        // Add new message and sort by timestamp
        return [...prev, newMessage].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      // Update conversation's last message
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConversation
            ? { ...conv, lastMessage: newMessage, updatedAt: newMessage.timestamp }
            : conv
        )
      );

      // Mark as read if it's from the user (not admin)
      if (newMessage.senderId !== user.id) {
        messageService.markAsRead(selectedConversation, user.id);
      }

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
      if (!selectedConversation) {
        showToast('Please select a conversation', 'error');
        setIsSending(false);
        return;
      }

      // Get the current conversation to ensure we have the user ID
      const currentConv = conversations.find(c => c.id === selectedConversation);
      if (!currentConv) {
        showToast('Conversation not found', 'error');
        setIsSending(false);
        return;
      }

      // Send message as admin
      const adminName = user.name || user.email || 'Admin';
      await messageService.sendMessage(
        selectedConversation,
        user.id,
        adminName,
        textToSend
      );
      
      // Update conversation's last message immediately for better UX
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConversation
            ? { 
                ...conv, 
                lastMessage: {
                  id: `temp-${Date.now()}`,
                  conversationId: selectedConversation,
                  senderId: user.id,
                  senderName: adminName,
                  content: textToSend,
                  status: 'sent',
                  timestamp: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
              }
            : conv
        )
      );
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      showToast(error.message || 'Failed to send message', 'error');
      setMessageText(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck size={14} className="text-blue-500" />;
      case 'delivered':
        return <CheckCheck size={14} className="text-gray-400" />;
      case 'sent':
        return <Check size={14} className="text-gray-400" />;
      default:
        return <Clock size={14} className="text-gray-300" />;
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
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="flex-shrink-0"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
        </div>
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Messages</h1>
        <p className="text-gray-600">Chat with users and manage conversations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Conversations List */}
        <Card className="p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gold-50 to-rose-50">
            <h3 className="font-semibold text-gray-900 mb-3">All Conversations</h3>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-500 mx-auto mb-4"></div>
                <p className="text-sm text-gray-500">Loading conversations...</p>
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv.id);
                    navigate(`/admin/chat?userId=${conv.userId}`, { replace: true });
                  }}
                  className={`
                    w-full p-4 text-left hover:bg-gray-50 transition-all duration-200
                    ${selectedConversation === conv.id ? 'bg-gold-50 border-l-4 border-gold-500' : ''}
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {conv.userName?.charAt(0).toUpperCase() || <User size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {conv.userName || 'User'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{conv.userEmail}</p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="info" className="flex-shrink-0">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className="text-sm text-gray-600 truncate mb-1 ml-10">
                          {conv.lastMessage.content}
                        </p>
                      )}
                      {conv.lastMessage && (
                        <p className="text-xs text-gray-400 ml-10">
                          {formatTime(conv.lastMessage.timestamp)}
                        </p>
                      )}
                      {!conv.lastMessage && (
                        <p className="text-sm text-gray-400 italic ml-10">No messages yet</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">No conversations found</p>
              </div>
            )}
          </div>
        </Card>

        {/* Chat Window */}
        <div className="lg:col-span-2">
          <Card className="p-0 flex flex-col h-full">
            {selectedConversation && currentConversation ? (
              <>
                <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gold-50 to-rose-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold-500 flex items-center justify-center text-white font-semibold">
                      {currentConversation.userName?.charAt(0).toUpperCase() || <User size={20} />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {currentConversation.userName || 'User'}
                      </h3>
                      <p className="text-xs text-gray-500">{currentConversation.userEmail}</p>
                    </div>
                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            // Find the user's application
                            const application = await applicationService.getApplication(currentConversation.userId);
                            
                            if (application) {
                              // Navigate to application details page
                              navigate(`/admin/applications/${application.id}`);
                            } else {
                              // Show friendly message if no application exists
                              showToast(
                                `${currentConversation.userName || 'User'} has not submitted an application yet.`,
                                'info'
                              );
                            }
                          } catch (error: any) {
                            console.error('Failed to load application:', error);
                            showToast('Failed to load application. Please try again.', 'error');
                          }
                        }}
                      >
                        View Application
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                  {messages.length > 0 ? (
                    messages.map((msg, index) => {
                      const isOwn = msg.senderId === user?.id;
                      const showAvatar = index === 0 || messages[index - 1].senderId !== msg.senderId;
                      const showTime = index === messages.length - 1 || 
                        new Date(msg.timestamp).getTime() - new Date(messages[index + 1].timestamp).getTime() > 300000;

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          {showAvatar && !isOwn && (
                            <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                              {msg.senderName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {showAvatar && isOwn && (
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                              A
                            </div>
                          )}
                          {!showAvatar && <div className="w-8 flex-shrink-0" />}
                          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                            {showAvatar && (
                              <p className="text-xs text-gray-500 mb-1 px-2">{msg.senderName}</p>
                            )}
                            <div
                              className={`
                                rounded-2xl px-4 py-2.5 shadow-sm
                                ${isOwn
                                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                                  : 'bg-white text-gray-900 border border-gray-200'
                                }
                              `}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                              {showTime && (
                                <div className={`flex items-center gap-1 mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  <span className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                                    {formatTime(msg.timestamp)}
                                  </span>
                                  {isOwn && getStatusIcon(msg.status)}
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
                        <MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No messages yet. Start the conversation!</p>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-gray-200 bg-white">
                  <div className="flex gap-2">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type your message..."
                      className="flex-1"
                      disabled={!user || isSending}
                    />
                    <Button 
                      variant="primary" 
                      onClick={handleSend}
                      disabled={!messageText.trim() || !user || isSending}
                      isLoading={isSending}
                      className="px-6"
                    >
                      <Send size={18} />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare size={64} className="text-gray-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">Select a conversation</h3>
                  <p className="text-gray-500">Choose a conversation from the list to start chatting</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminChatPage;

