import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { procedures, procedureFormVersions } from '../../db/schema.js';
import { extractText } from '../../utils/ocr/index.js';
import { classifyDocument, type DocumentConfig } from './document-classifier.js';

interface RequiredDocsJson {
  documents: DocumentConfig[];
}

export interface ClassifyResult {
  ocrText: string;
  ocrConfidence: number;
  match: {
    code: string;
    name: string;
    score: number;
    matchedKeywords: string[];
  } | null;
  procedureCode: string;
}

export async function classifyScannedDocument(params: {
  imageBuffer: Buffer;
  procedureCode: string;
}): Promise<ClassifyResult> {
  const rows = await db
    .select({
      procedureId: procedures.id,
      currentVersion: procedures.currentFormVersion,
      requiredDocs: procedureFormVersions.requiredDocs,
    })
    .from(procedures)
    .innerJoin(
      procedureFormVersions,
      and(
        eq(procedureFormVersions.procedureId, procedures.id),
        eq(procedureFormVersions.version, procedures.currentFormVersion),
      ),
    )
    .where(eq(procedures.code, params.procedureCode))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw Object.assign(new Error(`Procedure ${params.procedureCode} not found`), { statusCode: 404 });
  }

  const docs = (row.requiredDocs as RequiredDocsJson)?.documents ?? [];
  if (docs.length === 0) {
    throw Object.assign(
      new Error(`Procedure ${params.procedureCode} chưa config required_docs`),
      { statusCode: 422 },
    );
  }

  const { text: ocrText, confidence: ocrConfidence } = await extractText(params.imageBuffer);
  const match = classifyDocument(ocrText, docs);

  return {
    ocrText,
    ocrConfidence,
    match: match ? { code: match.code, name: match.name, score: match.score, matchedKeywords: match.matchedKeywords } : null,
    procedureCode: params.procedureCode,
  };
}
