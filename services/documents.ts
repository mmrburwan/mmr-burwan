import { supabase } from '../lib/supabase';
import { Document, Application } from '../types';

export const documentService = {
  async uploadDocument(
    applicationId: string,
    file: File,
    type: Document['type'],
    belongsTo?: 'user' | 'partner'
  ): Promise<Document> {
    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${applicationId}/${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const documentUrl = urlData.publicUrl;

    // Insert document record
    const { data, error } = await supabase
      .from('documents')
      .insert({
        application_id: applicationId,
        type: type,
        name: file.name,
        url: documentUrl,
        file_path: filePath, // Store file path for easier retrieval
        status: 'pending',
        size: file.size,
        mime_type: file.type,
        belongs_to: belongsTo,
      })
      .select()
      .single();

    if (error) {
      // If document insert fails, try to delete uploaded file
      await supabase.storage.from('documents').remove([filePath]);
      throw new Error(error.message);
    }

    return {
      id: data.id,
      applicationId: data.application_id,
      type: data.type,
      name: data.name,
      url: data.url,
      status: data.status,
      uploadedAt: data.uploaded_at,
      size: data.size,
      mimeType: data.mime_type,
      belongsTo: data.belongs_to,
    };
  },

  async getDocuments(applicationId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('application_id', applicationId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data.map((doc) => ({
      id: doc.id,
      applicationId: doc.application_id,
      type: doc.type,
      name: doc.name,
      url: doc.url,
      status: doc.status,
      uploadedAt: doc.uploaded_at,
      size: doc.size,
      mimeType: doc.mime_type,
      belongsTo: doc.belongs_to,
    }));
  },

  async deleteDocument(documentId: string): Promise<void> {
    // Get document to find file path
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('url')
      .eq('id', documentId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Extract file path from URL
    const url = new URL(document.url);
    const filePath = url.pathname.split('/documents/')[1];

    // Delete from storage
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Failed to delete file from storage:', storageError);
      }
    }

    // Delete document record
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async approveDocument(documentId: string): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'approved' })
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      applicationId: data.application_id,
      type: data.type,
      name: data.name,
      url: data.url,
      status: data.status,
      uploadedAt: data.uploaded_at,
      size: data.size,
      mimeType: data.mime_type,
      belongsTo: data.belongs_to,
    };
  },

  async rejectDocument(documentId: string): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .update({ status: 'rejected' })
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      applicationId: data.application_id,
      type: data.type,
      name: data.name,
      url: data.url,
      status: data.status,
      uploadedAt: data.uploaded_at,
      size: data.size,
      mimeType: data.mime_type,
      belongsTo: data.belongs_to,
    };
  },

  async getSignedUrl(documentId: string): Promise<string> {
    const { data: document, error } = await supabase
      .from('documents')
      .select('url, file_path')
      .eq('id', documentId)
      .single();

    if (error) {
      throw new Error('Document not found');
    }

    // First try to use stored file_path if available
    if ((document as any).file_path) {
      try {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('documents')
          .createSignedUrl((document as any).file_path, 3600);

        if (!signedUrlError && signedUrlData) {
          return signedUrlData.signedUrl;
        }
      } catch (e) {
        console.error('Failed to create signed URL with stored file_path:', e);
      }
    }

    // Fallback: Try to extract file path from URL
    try {
      const url = new URL(document.url);
      // Extract path after /storage/v1/object/public/documents/ or /documents/
      let filePath = url.pathname;
      
      // Handle different URL formats
      if (filePath.includes('/documents/')) {
        filePath = filePath.split('/documents/')[1];
      } else if (filePath.includes('/storage/v1/object/public/documents/')) {
        filePath = filePath.split('/storage/v1/object/public/documents/')[1];
      } else if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }

      // Remove query parameters if any
      filePath = filePath.split('?')[0];

      if (filePath) {
        // Get signed URL (valid for 1 hour)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 3600);

        if (!signedUrlError && signedUrlData) {
          return signedUrlData.signedUrl;
        }
      }
    } catch (urlError) {
      // If URL parsing fails, try to extract path from the stored URL string directly
      console.error('Error parsing document URL:', urlError);
      
      const urlString = document.url;
      let filePath = urlString;
      
      if (urlString.includes('/documents/')) {
        filePath = urlString.split('/documents/')[1].split('?')[0];
      } else if (urlString.includes('documents/')) {
        filePath = urlString.split('documents/')[1].split('?')[0];
      }

      if (filePath && filePath !== urlString) {
        try {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('documents')
            .createSignedUrl(filePath, 3600);

          if (!signedUrlError && signedUrlData) {
            return signedUrlData.signedUrl;
          }
        } catch (e) {
          console.error('Failed to create signed URL with extracted path:', e);
        }
      }
    }

    // Final fallback: return original URL
    return document.url;
  },
};
