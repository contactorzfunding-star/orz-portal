import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpEmail(to: string, code: string) {
  const mailOptions = {
    from: `"ORZ Funding" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Código de acceso a tu cuenta ORZ Funding',
    text: `Tu código de acceso es: ${code}\n\nEste código vence en 10 minutos y es de un solo uso.\n\nSi no solicitaste este código, ignora este mensaje.\n\nORZ Funding`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #000; color: #fff;">
        <h2 style="margin: 0 0 16px;">ORZ Funding</h2>
        <p>Tu código de acceso es:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 16px 0;">${code}</p>
        <p>Este código vence en <strong>10 minutos</strong> y es de un solo uso.</p>
        <p style="color: #aaa; font-size: 12px;">Si no solicitaste este código, ignora este mensaje.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}