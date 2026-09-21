import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import { Document, Application } from '../types';

export const documentService = {
  async uploadDocument(
    applicationId: string,
    file: File,
    type: Document['type'],
    belongsTo?: 'user' | 'partner' | 'joint',
    targetDocumentId?: string
  ): Promise<Document> {
    let existingDoc: { id: string; file_path?: string } | null = null;

    if (targetDocumentId) {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_path')
        .eq('id', targetDocumentId)
        .maybeSingle();
      if (!error && data) {
        existingDoc = data;
      }
    }

    if (!existingDoc) {
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

      if (existingDocs && existingDocs.length > 0) {
        existingDoc = existingDocs[0];
      }
    }

    // If document already exists, update it instead of creating a duplicate
    if (existingDoc) {
      
      // Delete old file from storage
      if (existingDoc.file_path) {
        try {
          await storage.from('documents').remove([existingDoc.file_path]);
        } catch (storageError) {
          console.error('Failed to delete old file from storage:', storageError);
        }
      }

      // Upload new file
      const fileExt = file.name.split('.').pop();
      const fileName = `${applicationId}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await storage.from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        const msg = (uploadError as Error).message;
        throw new Error(msg.startsWith('Storage upload failed') ? msg : `Storage upload failed: ${msg}`);
      }

      // Get public URL from actual storage provider
      const documentUrl = uploadData?.publicUrl || storage.from('documents').getPublicUrl(filePath).data.publicUrl;

      // Update existing document record
      // Reset status to 'pending' and mark as re-uploaded when updating
      const { data, error } = await supabase
        .from('documents')
        .update({
          name: file.name,
          url: documentUrl,
          file_path: filePath,
          size: file.size,
          mime_type: file.type,
          uploaded_at: new Date().toISOString(),
          status: 'pending', // Reset status to pending when re-uploaded
          is_reuploaded: true, // Mark as re-uploaded
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
        isReuploaded: data.is_reuploaded || false,
      };
    }

    // No existing document, create new one
    // Upload file to R2 Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${applicationId}/${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data: uploadData, error: uploadError } = await storage.from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      const msg = (uploadError as Error).message;
      throw new Error(msg.startsWith('Storage upload failed') ? msg : `Storage upload failed: ${msg}`);
    }

    // Get public URL from actual storage provider
    const documentUrl = uploadData?.publicUrl || storage.from('documents').getPublicUrl(filePath).data.publicUrl;

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
        await storage.from('documents').remove([filePath]);
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
      .select('url, file_path')
      .eq('id', documentId)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Prefer stored file_path if available, otherwise extract from URL
    let filePath: string | undefined = (document as any).file_path;

    if (!filePath) {
      try {
        const url = new URL(document.url);
        const pathname = url.pathname;

        if (pathname.includes('/storage/v1/object/public/documents/')) {
          // Old Supabase storage URL
          filePath = pathname.split('/storage/v1/object/public/documents/')[1];
        } else if (pathname.includes('/documents/')) {
          // R2 public URL or any URL with /documents/ in path
          filePath = pathname.split('/documents/')[1];
        }
      } catch {
        // URL parsing failed — try string-based extraction
        if (document.url.includes('/documents/')) {
          filePath = document.url.split('/documents/').pop()?.split('?')[0];
        }
      }
    }

    // Delete from storage
    if (filePath) {
      const { error: storageError } = await storage.from('documents')
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
        await storage.from('documents').remove([existingDoc.file_path]);
      } catch (storageError) {
        console.error('Failed to delete old file from storage:', storageError);
        // Continue even if old file deletion fails
      }
    }

    // Upload new file to R2 Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${existingDoc.application_id}/${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data: uploadData, error: uploadError } = await storage.from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      const msg = (uploadError as Error).message;
      throw new Error(msg.startsWith('Storage upload failed') ? msg : `Storage upload failed: ${msg}`);
    }

    // Get public URL from actual storage provider
    const documentUrl = uploadData?.publicUrl || storage.from('documents').getPublicUrl(filePath).data.publicUrl;

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
        await storage.from('documents').remove([filePath]);
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

    if (error || !document) {
      throw new Error('Document not found');
    }

    // 1. If stored URL is already an active Cloudflare R2 public URL (r2.dev), return it directly
    if (document.url && (document.url.includes('.r2.dev') || document.url.includes('pub-'))) {
      return document.url;
    }

    const DEFAULT_R2_DOCS_URL = 'https://pub-8c46b651293349a4b01ccd365dbc6d5c.r2.dev';

    // 2. Resolve the relative file path
    let filePath: string = (document as any).file_path || '';
    if (!filePath && document.url) {
      if (document.url.includes('.r2.cloudflarestorage.com/')) {
        filePath = document.url.split('.r2.cloudflarestorage.com/')[1].split('?')[0];
      } else if (document.url.includes('/documents/')) {
        filePath = document.url.split('/documents/')[1].split('?')[0];
      } else if (document.url.includes('/storage/v1/object/public/documents/')) {
        filePath = document.url.split('/storage/v1/object/public/documents/')[1].split('?')[0];
      } else {
        try {
          const urlObj = new URL(document.url);
          filePath = urlObj.pathname.replace(/^\/+/, '');
          if (filePath.startsWith('documents/')) {
            filePath = filePath.substring('documents/'.length);
          }
        } catch {
          // ignore
        }
      }
    }

    filePath = filePath ? filePath.replace(/^\/+/, '') : '';

    if (filePath) {
      // 3. If file is on Supabase Storage (url contains supabase.co), generate valid Supabase signed URL:
      if (document.url && document.url.includes('supabase.co')) {
        try {
          const { data: sbData, error: sbError } = await supabase.storage
            .from('documents')
            .createSignedUrl(filePath, 3600);

          if (!sbError && sbData?.signedUrl) {
            const finalUrl = sbData.signedUrl.startsWith('http')
              ? sbData.signedUrl
              : `${(import.meta as any).env.VITE_SUPABASE_URL}/storage/v1${sbData.signedUrl.startsWith('/') ? '' : '/'}${sbData.signedUrl}`;
            return finalUrl;
          }
        } catch (sbErr) {
          console.warn('Failed to generate Supabase signed URL:', sbErr);
        }
      }

      // 4. Construct the direct public CDN URL (R2)
      const r2BaseUrl = (import.meta as any).env.VITE_R2_DOCUMENTS_PUBLIC_URL || DEFAULT_R2_DOCS_URL;
      if (r2BaseUrl && (!document.url || !document.url.includes('supabase.co'))) {
        return `${r2BaseUrl.replace(/\/$/, '')}/${filePath}`;
      }
    }

    // 5. Final fallback: sanitize any r2.cloudflarestorage.com URL to public CDN
    if (document.url && document.url.includes('r2.cloudflarestorage.com')) {
      const cleanPath = document.url.split('.r2.cloudflarestorage.com/')[1]?.split('?')[0];
      if (cleanPath) {
        return `${DEFAULT_R2_DOCS_URL}/${cleanPath.replace(/^\/+/, '')}`;
      }
    }

    return document.url;
  },
};
