import { supabase } from '../lib/supabase';
import { Notification } from '../types';

export const notificationService = {
  /**
   * Get all notifications for a user
   */
  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return (data || []).map((n) => ({
      id: n.id,
      userId: n.user_id,
      applicationId: n.application_id,
      documentId: n.document_id,
      type: n.type as Notification['type'],
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.created_at,
    }));
  },

  /**
   * Get unread notifications count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      throw new Error(`Failed to fetch unread count: ${error.message}`);
    }

    return count || 0;
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  },

  /**
   * Create a new notification (typically used by admin service)
   * Uses a database function to bypass RLS policies
   */
  async createNotification(data: {
    userId: string;
    applicationId?: string;
    documentId?: string;
    type: Notification['type'];
    title: string;
    message: string;
  }): Promise<Notification> {
    // Use the database function to bypass RLS
    const { data: notificationId, error: functionError } = await supabase.rpc('create_notification', {
      p_user_id: data.userId,
      p_type: data.type,
      p_title: data.title,
      p_message: data.message,
      p_application_id: data.applicationId || null,
      p_document_id: data.documentId || null,
    });

    if (functionError) {
      console.error('Error calling create_notification function:', functionError);
      // Fallback to direct insert if function fails
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert({
          user_id: data.userId,
          application_id: data.applicationId || null,
          document_id: data.documentId || null,
          type: data.type,
          title: data.title,
          message: data.message,
          read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating notification (fallback):', error);
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      return {
        id: notification.id,
        userId: notification.user_id,
        applicationId: notification.application_id,
        documentId: notification.document_id,
        type: notification.type as Notification['type'],
        title: notification.title,
        message: notification.message,
        read: notification.read,
        createdAt: notification.created_at,
      };
    }

    // Check if we got a valid notification ID from the RPC
    if (!notificationId) {
      console.error('RPC create_notification returned null ID');
      // Create a minimal notification object since the insert succeeded but we can't fetch it
      return {
        id: 'unknown',
        userId: data.userId,
        applicationId: data.applicationId,
        documentId: data.documentId,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        createdAt: new Date().toISOString(),
      };
    }

    // Fetch the created notification using maybeSingle to avoid 406 errors
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching created notification:', fetchError);
      // Return a minimal notification instead of throwing
      return {
        id: notificationId,
        userId: data.userId,
        applicationId: data.applicationId,
        documentId: data.documentId,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        createdAt: new Date().toISOString(),
      };
    }

    if (!notification) {
      console.warn('Notification was created but could not be fetched (RLS?)');
      return {
        id: notificationId,
        userId: data.userId,
        applicationId: data.applicationId,
        documentId: data.documentId,
        type: data.type,
        title: data.title,
        message: data.message,
        read: false,
        createdAt: new Date().toISOString(),
      };
    }

    return {
      id: notification.id,
      userId: notification.user_id,
      applicationId: notification.application_id,
      documentId: notification.document_id,
      type: notification.type as Notification['type'],
      title: notification.title,
      message: notification.message,
      read: notification.read,
      createdAt: notification.created_at,
    };
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  },
};

