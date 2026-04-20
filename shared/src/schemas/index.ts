import { z } from 'zod';

export const hoSoStatusSchema = z.enum([
  'draft',
  'submitted',
  'processing',
  'completed',
  'rejected',
]);

export const userSchema = z.object({
  id: z.string().uuid(),
  hashedCccd: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const hoSoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  loaiThuTuc: z.string().min(1),
  trangThai: hoSoStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const walletSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.date(),
});

export const walletFileSchema = z.object({
  id: z.string().uuid(),
  walletId: z.string().uuid(),
  fileName: z.string().min(1),
  encryptedBlobKey: z.string().min(1),
  createdAt: z.date(),
});

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  userHash: z.string().min(1),
  action: z.string().min(1),
  result: z.enum(['success', 'failure']),
  timestamp: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

export type UserSchema = z.infer<typeof userSchema>;
export type HoSoSchema = z.infer<typeof hoSoSchema>;
export type WalletSchema = z.infer<typeof walletSchema>;
export type WalletFileSchema = z.infer<typeof walletFileSchema>;
export type AuditLogSchema = z.infer<typeof auditLogSchema>;
export type HoSoStatusSchema = z.infer<typeof hoSoStatusSchema>;
