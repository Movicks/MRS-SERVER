import { Injectable, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailerService implements OnModuleInit {
  private transporter: Transporter | null = null;
  private from: string;
  private appName: string;
  private frontendUrl: string;
  private readonly env: string;
  private readonly resendKey?: string;

  constructor(private readonly config: ConfigService, private readonly logger: Logger) {
    this.from = this.config.get<string>('MAIL_FROM') || this.config.get<string>('EMAIL_FROM') || 'no-reply@mrs.local';
    this.appName = this.config.get<string>('APP_NAME') || 'MRS';
    this.frontendUrl = (this.config.get<string>('FRONTEND_URL') || '').replace(/\/$/, '');
    this.env = this.config.get<string>('NODE_ENV') || 'development';
    this.resendKey = this.config.get<string>('RESEND_API_KEY') || undefined;
  }

  async onModuleInit() {
    // ── Step 1: Try to build and verify the primary (real) SMTP transporter ──
    const primaryVerified = await this.tryInitPrimary();

    // ── Step 2: If primary failed and we are NOT in production, fall back to Ethereal ──
    if (!primaryVerified) {
      const useEthereal = this.config.get<string | boolean>('USE_ETHEREAL_FALLBACK');
      const shouldUseEthereal =
        useEthereal === true || useEthereal === 'true';
      if (shouldUseEthereal) {
        await this.initEthereal();
      }
    }

    if (!this.transporter) {
      this.logger.warn('[Mailer] No email transporter available — emails will be skipped');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public send methods
  // ─────────────────────────────────────────────────────────────────────────────

  async sendDoctorInvitation(email: string, token: string): Promise<void> {
    const acceptUrl = this.frontendUrl
      ? `${this.frontendUrl}/invite/accept?token=${encodeURIComponent(token)}`
      : `${this.config.get<string>('PUBLIC_API_URL') || ''}/api/v1/invitations/${encodeURIComponent(token)}`;

    const subject = `You're invited to ${this.appName} as a Doctor`;
    const html = this.invitationTemplate({ appName: this.appName, acceptUrl });
    await this.dispatch(email, subject, html);
  }

  async sendDoctorWelcome(email: string, name?: string): Promise<void> {
    const subject = `Welcome to ${this.appName}`;
    const landing = this.frontendUrl || this.config.get<string>('PUBLIC_APP_URL') || '';
    const html = this.welcomeTemplate({ appName: this.appName, name, landing });
    await this.dispatch(email, subject, html);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build the primary SMTP transporter from .env and verify the connection.
   * Returns true if the transporter connected successfully, false otherwise.
   */
  private async tryInitPrimary(): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT'));
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    // Strip spaces — Gmail App Passwords are displayed with spaces but must be sent without
    const pass = (this.config.get<string>('SMTP_PASS') ?? '').replace(/\s+/g, '');

    if (!host || !port || !user || !pass) {
      this.logger.warn('[Mailer] SMTP credentials incomplete — skipping primary transporter');
      return false;
    }

    const candidate = nodemailer.createTransport({
      host,
      port,
      secure,
      // Port 587 → STARTTLS (requireTLS). Port 465 → direct SSL (secure:true)
      requireTLS: !secure && port === 587,
      auth: { user, pass },
      tls: {
        // Strict cert checking in production; relaxed in dev
        rejectUnauthorized: this.env === 'production',
      },
    });

    try {
      await candidate.verify();
      this.transporter = candidate;
      this.logger.log(
        `[Mailer] Primary SMTP ready — host=${host} port=${port} user=${user}`,
      );
      return true;
    } catch (err) {
      const msg = (err as Error & { code?: string; responseCode?: number }).message;
      const code = (err as Error & { code?: string }).code ?? '';
      const responseCode = (err as Error & { responseCode?: number }).responseCode ?? 0;

      this.logger.error(
        `[Mailer] Primary SMTP verify FAILED (${code} ${responseCode}): ${msg}`,
      );

      if (code === 'EAUTH' || responseCode === 535) {
        this.logger.error(
          '[Mailer] *** GMAIL AUTHENTICATION REJECTED (535) ***\n' +
          '    Possible causes:\n' +
          '    1. The App Password in .env is wrong — regenerate it at:\n' +
          '       https://myaccount.google.com/apppasswords\n' +
          '    2. 2-Step Verification is NOT enabled on the Google account.\n' +
          '       Enable it first, then create an App Password.\n' +
          '    3. The Gmail account has "Allow less secure apps" blocked and\n' +
          '       has not set up an App Password.',
        );
      }

      return false;
    }
  }

  /**
   * Spin up an Ethereal (fake SMTP) transporter for local development.
   * Emails sent here will NOT reach real inboxes — use the preview URL logged below.
   */
  private async initEthereal(): Promise<void> {
    try {
      const account = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: account.user, pass: account.pass },
        tls: { rejectUnauthorized: false },
      });
      this.from = this.from || account.user;

      await this.transporter.verify();
      this.logger.warn(
        `[Mailer] Using Ethereal fallback — emails go to https://ethereal.email\n` +
        `         Login: ${account.user} / ${account.pass}`,
      );
    } catch (err) {
      this.logger.warn(`[Mailer] Ethereal fallback also failed: ${(err as Error).message}`);
      this.transporter = null;
    }
  }

  /**
   * Core send method. Email failures are NON-FATAL in development (logged + swallowed).
   * In production they are also swallowed at this level — callers should handle if needed.
   */
  private async dispatch(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter && this.resendKey) {
      try {
        const ok = await this.sendWithResend(to, subject, html);
        if (ok) {
          this.logger.log(`[Mailer] Email sent via Resend to "${to}"`);
          return;
        }
      } catch (err) {
        const msg = (err as Error).message ?? 'Unknown Resend error';
        this.logger.error(`[Mailer] Resend send FAILED to "${to}": ${msg}`);
      }
    }
    if (!this.transporter && !this.resendKey) {
      this.logger.warn(`[Mailer] No transporter — email NOT sent to "${to}" (subject: "${subject}")`);
      return;
    }

    try {
      const info = await this.transporter!.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
      this.logger.log(`[Mailer] Email sent to "${to}" — messageId: ${info.messageId}`);

      // Ethereal gives a preview URL — show it prominently
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) {
        this.logger.log(`[Mailer] >>> PREVIEW EMAIL HERE: ${preview}`);
      }
    } catch (err) {
      const msg = (err as Error).message ?? 'Unknown SMTP error';
      this.logger.error(`[Mailer] SMTP send FAILED to "${to}": ${msg}`);
      // Attempt Resend fallback if available
      if (this.resendKey) {
        try {
          const ok = await this.sendWithResend(to, subject, html);
          if (ok) {
            this.logger.log(`[Mailer] Fallback via Resend succeeded to "${to}"`);
            return;
          }
        } catch (e2) {
          const msg2 = (e2 as Error).message ?? 'Unknown Resend error';
          this.logger.error(`[Mailer] Resend fallback FAILED to "${to}": ${msg2}`);
        }
      }
      // Non-fatal — invite is saved; delivery can be retried
    }
  }

  private getFromEmail(): { email: string; name?: string } {
    const raw = this.from.trim();
    const m = raw.match(/^(.*)<([^>]+)>$/);
    if (m) {
      return { email: m[2].trim(), name: m[1].trim().replace(/"|'/g, '').trim() || undefined };
    }
    return { email: raw };
  }

  private async sendWithResend(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.resendKey) return false;
    const from = this.getFromEmail();
    const publicMailbox = /@(gmail|yahoo|outlook|hotmail|aol)\./i.test(from.email);
    const fromEmail = publicMailbox ? 'onboarding@resend.dev' : from.email;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: from.name ? `${from.name} <${fromEmail}>` : fromEmail,
        to: [to],
        subject,
        html
      })
    });
    if (res.ok) return true;
    const text = await res.text().catch(() => '');
    this.logger.error(`[Mailer] Resend responded ${res.status}: ${text}`);
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Email templates
  // ─────────────────────────────────────────────────────────────────────────────

  private invitationTemplate(params: { appName: string; acceptUrl: string }) {
    const { appName, acceptUrl } = params;
    return `
    <div style="font-family: Inter, Arial, sans-serif; background:#f7fafc; padding:24px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:24px">
          <h2 style="margin:0 0 12px 0;font-size:20px;color:#111827">${appName} Invitation</h2>
          <p style="margin:0 0 16px 0;color:#374151;font-size:14px">
            You have been invited to join ${appName} as a Doctor. Click the button below to accept the invitation and set your password.
          </p>
          <p style="text-align:center;margin:24px 0">
            <a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Accept Invitation</a>
          </p>
          <p style="margin:0;color:#6b7280;font-size:12px">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <span style="word-break:break-all">${acceptUrl}</span>
          </p>
        </td></tr>
      </table>
    </div>
    `;
  }

  private welcomeTemplate(params: { appName: string; name?: string; landing: string }) {
    const { appName, name, landing } = params;
    const greeting = name ? `Hi ${name},` : 'Hi,';
    const cta = landing
      ? `<p style="text-align:center;margin:24px 0">
          <a href="${landing}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Go to ${appName}</a>
        </p>`
      : '';
    return `
    <div style="font-family: Inter, Arial, sans-serif; background:#f7fafc; padding:24px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:24px">
            <h2 style="margin:0 0 12px 0;font-size:20px;color:#111827">Welcome to ${appName}</h2>
            <p style="margin:0 0 16px 0;color:#374151;font-size:14px">${greeting}</p>
            <p style="margin:0 0 16px 0;color:#374151;font-size:14px">
              Your account has been created. You can now sign in using your email and password.
            </p>
            ${cta}
          </td>
        </tr>
      </table>
    </div>
    `;
  }
}
