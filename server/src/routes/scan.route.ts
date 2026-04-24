/**
 * POST /scan/classify
 *
 * Nhận ảnh (multipart) + procedureCode → OCR + classify → trả document type.
 *
 * Flow:
 *  1. Parse multipart → lấy ảnh buffer
 *  2. Extract text bằng Tesseract (OCR)
 *  3. Lookup required_docs của procedure + version hiện tại
 *  4. Classify: match text với keywords → document_code
 *  5. Return {documentCode, score, matchedKeywords, ocrText}
 *
 * KHÔNG lưu ảnh/text vào DB ở đây — caller quyết định upload MinIO sau.
 */
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { procedures, procedureFormVersions } from '../db/schema.js';
import { extractText } from '../services/ocr/index.js';
import {
  classifyDocument,
  type DocumentConfig,
} from '../services/document-classifier.js';

interface RequiredDocsJson {
  documents: DocumentConfig[];
}

export default async function scanRoute(app: FastifyInstance) {
  app.post('/scan/classify', async (request, reply) => {
    // Parse multipart — expect field "image" (file) + "procedureCode" (text)
    const parts = request.parts();
    let imageBuffer: Buffer | null = null;
    let procedureCode: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'image') {
        imageBuffer = await part.toBuffer();
      } else if (part.type === 'field' && part.fieldname === 'procedureCode') {
        procedureCode = String(part.value);
      }
    }

    if (!imageBuffer) {
      return reply.code(400).send({ error: 'Missing "image" file field' });
    }
    if (!procedureCode) {
      return reply.code(400).send({ error: 'Missing "procedureCode" field' });
    }

    // Lookup procedure + active form version
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
          eq(
            procedureFormVersions.version,
            procedures.currentFormVersion,
          ),
        ),
      )
      .where(eq(procedures.code, procedureCode))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return reply.code(404).send({ error: `Procedure ${procedureCode} not found` });
    }

    const docs = (row.requiredDocs as RequiredDocsJson)?.documents ?? [];
    if (docs.length === 0) {
      return reply.code(422).send({
        error: `Procedure ${procedureCode} chưa config required_docs`,
      });
    }

    // OCR extract text
    let ocrText = '';
    let ocrConfidence = 0;
    try {
      const result = await extractText(imageBuffer);
      ocrText = result.text;
      ocrConfidence = result.confidence;
    } catch (err) {
      request.log.error({ err }, 'OCR failed');
      return reply.code(500).send({ error: 'OCR extraction failed' });
    }

    // Classify
    const match = classifyDocument(ocrText, docs);

    return reply.send({
      ocrText,
      ocrConfidence,
      match: match
        ? {
            code: match.code,
            name: match.name,
            score: match.score,
            matchedKeywords: match.matchedKeywords,
          }
        : null,
      procedureCode,
    });
  });
}
