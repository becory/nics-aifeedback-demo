import { generateSecret, generateURI, verifySync } from 'otplib'

const ISSUER = 'AI 回饋系統'

export function createTotpSecret(): string {
  return generateSecret()
}

export function createTotpUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret })
}

export function verifyTotp(token: string, secret: string): boolean {
  const result = verifySync({ secret, token, epochTolerance: 1 })
  return result.valid
}
