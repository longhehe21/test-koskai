export const createSessionBodySchema = {
  type: 'object',
  properties: {
    cccd: { type: 'string' },
    loginMethod: { type: 'string', enum: ['cccd_nfc', 'vneid', 'qr', 'guest'] },
    identityVerified: { type: 'boolean' },
  },
} as const;

export const createSessionResponseSchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'number' },
    sessionToken: { type: 'string' },
    citizenId: { type: 'number' },
    isNewCitizen: { type: 'boolean' },
  },
} as const;

export const sessionMeResponseSchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'number' },
    citizenId: { type: ['number', 'null'] },
    kioskId: { type: 'number' },
  },
} as const;
