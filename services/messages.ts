import { supabase } from '../lib/supabase';
import { Message, Conversation } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

export const messageService = {
  async getOrCreateConversation(userId: string, adminId?: string): Promise<Conversation> {
    // Try to find existing conversation
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId);

    if (adminId) {
      query = query.eq('admin_id', adminId);
    } else {
      // If no adminId specified, look for conversations with null admin_id
      query = query.is('admin_id', null);
    }

    // Get the most recent conversation if multiple exist
    const { data: existingList, error: fetchError } = await query
      .order('updated_at', { ascending: false })
      .limit(1);

    const existing = existingList && existingList.length > 0 ? existingList[0] : null;

    if (existing && !fetchError) {
      // Get last message
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', existing.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: existing.id,
        userId: existing.user_id,
        adminId: existing.admin_id,
        lastMessage: lastMessage ? this.mapMessage(lastMessage) : undefined,
        unreadCount: existing.unread_count || 0,
        updatedAt: existing.updated_at,
      };
    }

    // Create new conversation
    const { data: newConversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        admin_id: adminId || null,
        unread_count: 0,
      })
      .select()
      .single();

    if (createError) {
      // If insert fails due to unique constraint violation, fetch the existing one
      if (createError.code === '23505' || createError.message.includes('duplicate')) {
        const { data: existingConv } = await query
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingConv) {
          return {
            id: existingConv.id,
            userId: existingConv.user_id,
            adminId: existingConv.admin_id,
            unreadCount: existingConv.unread_count || 0,
            updatedAt: existingConv.updated_at,
          };
        }
      }
      throw new Error(createError.message);
    }

    return {
      id: newConversation.id,
      userId: newConversation.user_id,
      adminId: newConversation.admin_id,
      unreadCount: 0,
      updatedAt: newConversation.updated_at,
    };
  },

  async getConversations(userId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_id.eq.${userId},admin_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Get last message for each conversation
    const conversationsWithMessages = await Promise.all(
      data.map(async (conv) => {
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: conv.id,
          userId: conv.user_id,
          adminId: conv.admin_id,
          lastMessage: lastMessage ? this.mapMessage(lastMessage) : undefined,
          unreadCount: conv.unread_count || 0,
          updatedAt: conv.updated_at,
        };
      })
    );

    return conversationsWithMessages;
  },

  // Get all conversations for admin (with user info)
  async getAllConversationsForAdmin(): Promise<(Conversation & { userName?: string; userEmail?: string })[]> {
    try {
      // Fetch all conversations (including those with null admin_id)
      // RLS policy should allow admins to see all conversations
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch conversations: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.log('No conversations found in database');
        return [];
      }

      console.log(`Found ${data.length} conversations in database`);

      // Get last message and user info for each conversation
      const conversationsWithMessages = await Promise.all(
        data.map(async (conv: any) => {
          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get user profile info
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', conv.user_id)
            .maybeSingle();

          // Initialize user info
          let userName = 'User';
          let userEmail = '';

          // Try to get name from profile first
          if (profile) {
            userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
          }

          // Get user info from messages - look for the first message from this user
          const { data: userMessage } = await supabase
            .from('messages')
            .select('sender_name')
            .eq('sender_id', conv.user_id)
            .order('timestamp', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (userMessage?.sender_name) {
            // Check if sender_name contains email (format: "Name email@example.com")
            const nameParts = userMessage.sender_name.split(' ');
            const emailPart = nameParts.find(part => part.includes('@'));

            if (emailPart) {
              userEmail = emailPart;
              // Remove email from name parts
              userName = nameParts.filter(part => !part.includes('@')).join(' ').trim() || 'User';
            } else {
              // No email in sender_name, use it as name if we don't have profile
              if (!profile || userName === 'User') {
                userName = userMessage.sender_name;
              }
            }
          }

          // If we still don't have email, try to extract from any message
          if (!userEmail) {
            const { data: anyUserMessage } = await supabase
              .from('messages')
              .select('sender_name')
              .eq('conversation_id', conv.id)
              .eq('sender_id', conv.user_id)
              .limit(1)
              .maybeSingle();

            if (anyUserMessage?.sender_name) {
              const nameParts = anyUserMessage.sender_name.split(' ');
              const emailPart = nameParts.find(part => part.includes('@'));
              if (emailPart) {
                userEmail = emailPart;
              }
            }
          }

          return {
            id: conv.id,
            userId: conv.user_id,
            adminId: conv.admin_id,
            lastMessage: lastMessage ? this.mapMessage(lastMessage) : undefined,
            unreadCount: conv.unread_count || 0,
            updatedAt: conv.updated_at,
            userName: userName || 'User',
            userEmail: userEmail || '',
          };
        })
      );

      // Sort by updated_at (most recent first)
      conversationsWithMessages.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      console.log(`Returning ${conversationsWithMessages.length} conversations with user info`);
      return conversationsWithMessages;
    } catch (error: any) {
      console.error('Error in getAllConversationsForAdmin:', error);
      throw error;
    }
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((msg) => this.mapMessage(msg));
  },

  async sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    content: string,
    attachments?: Array<{ name: string; url: string; type: string }>
  ): Promise<Message> {
    // Insert the message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        content,
        attachments: attachments || null,
        status: 'sent',
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Update conversation's updated_at timestamp and increment unread_count if message is from user
    // This ensures conversations appear in the right order and unread counts are tracked
    const { data: conversation } = await supabase
      .from('conversations')
      .select('user_id, admin_id')
      .eq('id', conversationId)
      .single();

    if (conversation) {
      // Update the conversation's updated_at timestamp
      // This ensures conversations appear in the right order in the admin panel
      await supabase
        .from('conversations')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    }

    return this.mapMessage(data);
  },

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    // Reset unread count (status is no longer used for read tracking)
    await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  },

  // Real-time subscription for messages
  subscribeToMessages(
    conversationId: string,
    callback: (message: Message) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(this.mapMessage(payload.new));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(this.mapMessage(payload.new));
        }
      )
      .subscribe();

    return channel;
  },

  // Real-time subscription for conversation updates
  subscribeToConversations(
    userId: string,
    callback: (conversation: Conversation) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const conv = payload.new as any;
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          callback({
            id: conv.id,
            userId: conv.user_id,
            adminId: conv.admin_id,
            lastMessage: lastMessage ? this.mapMessage(lastMessage) : undefined,
            unreadCount: conv.unread_count || 0,
            updatedAt: conv.updated_at,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `admin_id=eq.${userId}`,
        },
        async (payload) => {
          const conv = payload.new as any;
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          callback({
            id: conv.id,
            userId: conv.user_id,
            adminId: conv.admin_id,
            lastMessage: lastMessage ? this.mapMessage(lastMessage) : undefined,
            unreadCount: conv.unread_count || 0,
            updatedAt: conv.updated_at,
          });
        }
      )
      .subscribe();

    return channel;
  },

  // Real-time subscription for all conversations (admin view)
  subscribeToAllConversations(
    callback: (conversation: Conversation & { userName?: string; userEmail?: string }) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel('all_conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        async (payload) => {
          const conv = payload.new as any;
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get user profile info
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', conv.user_id)
            .maybeSingle();

          let userName = 'User';
          if (profile) {
            userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
          }

          callback({
            id: conv.id,
            userId: conv.user_id,
            adminId: conv.admin_id,
            lastMessage: lastMessage ? this.mapMessage(lastMessage) : undefined,
            unreadCount: conv.unread_count || 0,
            updatedAt: conv.updated_at,
            userName,
            userEmail: '',
          });
        }
      )
      .subscribe();

    return channel;
  },

  // Helper to map database row to Message type
  mapMessage(data: any): Message {
    return {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      senderName: data.sender_name,
      content: data.content,
      attachments: data.attachments,
      status: data.status,
      timestamp: data.timestamp,
    };
  },
};
