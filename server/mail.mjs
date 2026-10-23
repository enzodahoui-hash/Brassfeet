// Envio de e-mails (verificação de conta e redefinição de senha).
// Com SMTP_HOST definido, usa o servidor SMTP informado (Gmail, Amazon SES, Mailgun, Brevo, etc.).
// Sem SMTP, funciona em modo de teste: o conteúdo do e-mail (com o link) aparece no log do servidor.

export function mailConfigured(env = process.env) {
  return !!env.SMTP_HOST;
}

let transport = null;

export async function sendMail(cfg, { to, subject, text }, env = process.env) {
  if (!mailConfigured(env)) {
    console.log(`\n[e-mail de teste] para: ${to}\nassunto: ${subject}\n${text}\n`);
    return { preview: true };
  }
  if (!transport) {
    const nodemailer = (await import('nodemailer')).default;
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 587),
      secure: env.SMTP_SECURE === '1' || Number(env.SMTP_PORT) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transport.sendMail({ from: env.MAIL_FROM ?? `${cfg.appName} <no-reply@${new URL(cfg.baseUrl).hostname}>`, to, subject, text });
}
