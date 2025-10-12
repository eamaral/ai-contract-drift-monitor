import nodemailer from 'nodemailer';

export type Fact = { name: string; value: string };

export async function sendEmailMessage(
  to: string,
  title: string,
  text: string,
  facts?: Fact[]
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const factsHtml = facts && facts.length > 0 
    ? `<ul>${facts.map(f => `<li><strong>${f.name}:</strong> ${f.value}</li>`).join('')}</ul>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d73502;">🚨 ${title}</h2>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0;">${text}</p>
      </div>
      ${factsHtml}
      <hr style="margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">
        Enviado em: ${new Date().toLocaleString('pt-BR')}<br>
        Sistema: AI Contract Drift Monitor
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `🚨 ${title}`,
    html
  });
}
