import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PasswordService {
  private readonly pepper: string;
  private readonly rounds: number;

  constructor(private readonly config: ConfigService) {
    this.pepper = this.config.get<string>('PEPPER_SECRET') || '';
    this.rounds = 12;
  }

  async hash(plain: string): Promise<string> {
    const salted = plain + this.pepper;
    const salt = await bcrypt.genSalt(this.rounds);
    return bcrypt.hash(salted, salt);
    }

  async verify(plain: string, hash: string): Promise<boolean> {
    const salted = plain + this.pepper;
    return bcrypt.compare(salted, hash);
  }
}
