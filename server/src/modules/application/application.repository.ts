import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { applicationFiles } from '../../db/schema.js';

export interface ApplicationFileRow {
  id: number;
  documentCode: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
}

export async function listFilesByAppId(appId: number): Promise<ApplicationFileRow[]> {
  return db
    .select({
      id: applicationFiles.id,
      documentCode: applicationFiles.documentCode,
      fileName: applicationFiles.fileName,
      mimeType: applicationFiles.mimeType,
      fileSize: applicationFiles.fileSize,
      uploadedAt: applicationFiles.uploadedAt,
    })
    .from(applicationFiles)
    .where(eq(applicationFiles.applicationId, appId));
}
