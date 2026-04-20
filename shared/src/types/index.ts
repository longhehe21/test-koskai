export type HoSoStatus = 'draft' | 'submitted' | 'processing' | 'completed' | 'rejected';

export interface User {
  id: string;
  hashedCccd: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HoSo {
  id: string;
  userId: string;
  loaiThuTuc: string;
  trangThai: HoSoStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: string;
  userId: string;
  createdAt: Date;
}

export interface WalletFile {
  id: string;
  walletId: string;
  fileName: string;
  encryptedBlobKey: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userHash: string;
  action: string;
  result: 'success' | 'failure';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
