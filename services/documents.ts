import { supabase } from '../lib/supabase';
import { Document, Application } from '../types';

export const documentService = {
  async uploadDocument(
    applicationId: string,
    file: File,
    type: Document['type'],
    belongsTo?: 'user' | 'partner' | 'joint'
  ): Promise<Document> {
    // Check if document of same type and belongsTo already exists
    const { data: existingDocs, error: checkError } = await supabase
      .from('documents')
      .select('id, file_path')
      .eq('application_id', applicationId)
      .eq('type', type)
      .eq('belongs_to', belongsTo || 'user');

    if (checkError) {
      console.error('Error checking for existing document:', checkError);
    }

    // If document already exists, update it instead of creating a duplicate
    if (existingDocs && existingDocs.length > 0) {
      const existingDoc = existingDocs[0];
      
      // Delete old file from storage
      if (existingDoc.file_path) {
        try {
          await supabase.storage.from('documents').remove([existingDoc.file_path]);
        } catch (storageError) {
          console.error('Failed to delete old file from storage:', storageError);
        }
      }

      // Upload new file
      const fileExt = file.name.split('.').pop();
      const fileName = `${applicationId}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const documentUrl = urlData.publicUrl;

      // Update existing document record
      const { data, error } = await supabase
        .from('documents')
        .update({
          name: file.name,
          url: documentUrl,
          file_path: filePath,
          size: file.size,
          mime_type: file.type,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', existingDoc.id)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        throw new Error(`Database update failed: ${error.message}`);
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
        isReuploaded: false,
      };
    }

    // No existing document, create new one
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
      console.error('Storage upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
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
      console.error('Database insert error:', error);
      // If document insert fails, try to delete uploaded file
      try {
        await supabase.storage.from('documents').remove([filePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }
      throw new Error(`Database insert failed: ${error.message}`);
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
      isReuploaded: false, // New uploads are never re-uploads
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
      isReuploaded: doc.is_reuploaded || false,
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
      isReuploaded: data.is_reuploaded || false,
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
      isReuploaded: data.is_reuploaded || false,
    };
  },

  /**
   * Replace a rejected document with a new file
   * This updates the existing document record instead of creating a new one
   */
  async replaceRejectedDocument(documentId: string, file: File): Promise<Document> {
    // Get the existing document to preserve type and belongs_to
    const { data: existingDoc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !existingDoc) {
      throw new Error('Document not found');
    }

    if (existingDoc.status !== 'rejected') {
      throw new Error('Can only replace rejected documents');
    }

    // Delete old file from storage if file_path exists
    if (existingDoc.file_path) {
      try {
        await supabase.storage.from('documents').remove([existingDoc.file_path]);
      } catch (storageError) {
        console.error('Failed to delete old file from storage:', storageError);
        // Continue even if old file deletion fails
      }
    }

    // Upload new file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${existingDoc.application_id}/${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const documentUrl = urlData.publicUrl;

    // Update the existing document record with new file info and reset status to pending
    // Mark as re-uploaded since this is a replacement for a rejected document
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        name: file.name,
        url: documentUrl,
        file_path: filePath,
        status: 'pending',
        size: file.size,
        mime_type: file.type,
        uploaded_at: new Date().toISOString(),
        is_reuploaded: true,
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Database update error:', updateError);
      // If update fails, try to delete uploaded file
      try {
        await supabase.storage.from('documents').remove([filePath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    // Fetch the updated document separately to avoid JSON coercion issues
    const { data: updatedDoc, error: fetchUpdatedError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchUpdatedError || !updatedDoc) {
      console.error('Failed to fetch updated document:', fetchUpdatedError);
      throw new Error('Failed to retrieve updated document');
    }

    return {
      id: updatedDoc.id,
      applicationId: updatedDoc.application_id,
      type: updatedDoc.type,
      name: updatedDoc.name,
      url: updatedDoc.url,
      status: updatedDoc.status,
      uploadedAt: updatedDoc.uploaded_at,
      size: updatedDoc.size,
      mimeType: updatedDoc.mime_type,
      belongsTo: updatedDoc.belongs_to,
      isReuploaded: updatedDoc.is_reuploaded || false,
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
