import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { applicationFiles, applications } from '../../db/schema.js';

export interface FileWithApplication {
  fileUrl: string;
  mimeType: string;
  checksum: string;
  fileSize: number;
  applicationId: number;
  sessionId: number;
  citizenId: number | null;
}

export async function findFileWithApplication(fileId: number): Promise<FileWithApplication | null> {
  const rows = await db
    .select({
      fileUrl: applicationFiles.fileUrl,
      mimeType: applicationFiles.mimeType,
      checksum: applicationFiles.checksum,
      fileSize: applicationFiles.fileSize,
      applicationId: applicationFiles.applicationId,
      sessionId: applications.sessionId,
      citizenId: applications.citizenId,
    })
    .from(applicationFiles)
    .innerJoin(applications, eq(applications.id, applicationFiles.applicationId))
    .where(eq(applicationFiles.id, fileId))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertApplicationFile(params: {
  applicationId: number;
  documentCode: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
}): Promise<{ id: number }> {
  const [inserted] = await db
    .insert(applicationFiles)
    .values({
      applicationId: params.applicationId,
      documentCode: params.documentCode,
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      fileType: 'image',
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      checksum: params.checksum,
      ocrEncrypted: true,
    })
    .returning({ id: applicationFiles.id });
  if (!inserted) throw new Error('insertApplicationFile: insert failed');
  return inserted;
}
