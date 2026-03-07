/**
 * Formatea una fecha ISO a "15 de marzo de 2026"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formatea una fecha-hora ISO a "15 de marzo de 2026, 10:30"
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Formatea un monto a "$1,500.00 MXN"
 */
export function formatCurrency(amount: number): string {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MXN",
      currencyDisplay: "code",
    })
      .format(amount)
      // "MXN 1,500.00" → "$1,500.00 MXN"
      .replace("MXN", "")
      .trim()
      .replace(/^/, "$") + " MXN"
  );
}

/**
 * Formatea un teléfono "+5255XXXXXXXX" a "+52 55 XXXX XXXX"
 */
export function formatPhone(phone: string): string {
  // Espera formato +52XXXXXXXXXX (12 dígitos con +52)
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("52")) {
    const area = digits.slice(2, 4);
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8, 12);
    return `+52 ${area} ${part1} ${part2}`;
  }
  return phone;
}
