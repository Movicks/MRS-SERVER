import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';

@Injectable()
export class AppMailerService {
  private readonly from: string;
  private readonly appName: string;
  private readonly frontendUrl: string;
  private readonly resendKey?: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('MAIL_FROM') || this.config.get<string>('EMAIL_FROM') || 'no-reply@mrs.local';
    this.appName = this.config.get<string>('APP_NAME') || 'MRS';
    this.frontendUrl = (this.config.get<string>('FRONTEND_URL') || '').replace(/\/$/, '');
    this.resendKey = this.config.get<string>('RESEND_API_KEY') || undefined;
  }

  private resolveTemplatePath(name: string): string {
    const dist = join(process.cwd(), 'dist', 'mailer', 'templates', `${name}.hbs`);
    const src = join(process.cwd(), 'src', 'mailer', 'templates', `${name}.hbs`);
    return existsSync(dist) ? dist : src;
  }

  private renderTemplate(name: string, context: Record<string, unknown>): string {
    const file = this.resolveTemplatePath(name);
    const content = readFileSync(file, 'utf8');
    const compiled = Handlebars.compile(content, { strict: true });
    return compiled(context);
  }

  private async sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.resendKey) return { ok: false, error: 'Missing RESEND_API_KEY' };
    const publicMailbox = /@(gmail|yahoo|outlook|hotmail|aol)\./i.test(this.from);
    const fromEmail = publicMailbox ? 'mrs_server_send@resend.dev' : this.from;
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html
        })
      });
      if (resp.ok) return { ok: true };
      const text = await resp.text().catch(() => '');
      return { ok: false, error: `Resend ${resp.status}: ${text}` };
    } catch (e) {
      const message = (e as Error)?.message || 'Resend send failed';
      return { ok: false, error: message };
    }
  }

  async sendInvitation(email: string, token: string, role: 'Doctor' | 'Nurse' | 'Staff'): Promise<{ ok: boolean; error?: string }> {
    const acceptUrl =
      this.frontendUrl
        ? `${this.frontendUrl}/invite/accept?token=${encodeURIComponent(token)}`
        : `${this.config.get<string>('PUBLIC_API_URL') || ''}/api/v1/invitations/${encodeURIComponent(token)}`;
    const html = this.renderTemplate('invitation', { appName: this.appName, acceptUrl, role });
    return this.sendViaResend(email, `You're invited to ${this.appName} as a ${role}`, html);
  }

  async sendDoctorWelcome(email: string, name?: string): Promise<{ ok: boolean; error?: string }> {
    const landing = this.frontendUrl || this.config.get<string>('PUBLIC_APP_URL') || '';
    const html = this.renderTemplate('welcome', { appName: this.appName, name, landing });
    return this.sendViaResend(email, `Welcome to ${this.appName}`, html);
  }
}
