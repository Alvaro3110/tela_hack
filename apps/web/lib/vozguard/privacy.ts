export function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "***";

  const start = phone.slice(0, 6);
  const end = phone.slice(-4);
  return `${start}*****${end}`;
}

export function maskEmails(text: string): string {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email mascarado]");
}

export function sanitizeTranscript(text: string): string {
  return maskEmails(text);
}
