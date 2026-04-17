/** Normalize phone to E.164 format (+1XXXXXXXXXX for Canadian/US numbers) */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

/** Normalize email: lowercase + trim */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

/** Normalize name: trim whitespace */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.trim();
}
