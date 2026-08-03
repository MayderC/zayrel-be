import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../database/schemas';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAdmin();
    await this.seedDevUser();
  }

  private get isDevMode(): boolean {
    return this.configService.get<string>('DEV_MODE', 'false') === 'true';
  }

  private async seedAdmin() {
    const email = this.configService.get<string>('ADMIN_SEED_EMAIL');
    const password = this.configService.get<string>('ADMIN_SEED_PASSWORD');
    const firstName = this.configService.get<string>('ADMIN_SEED_FIRSTNAME', 'Admin');
    const lastName = this.configService.get<string>('ADMIN_SEED_LASTNAME', 'Sistema');

    if (!email || !password) {
      this.logger.warn(
        'ADMIN_SEED_EMAIL o ADMIN_SEED_PASSWORD no definidos. Saltando el seeding de admin.',
      );
      return;
    }

    await this.upsertUser({
      email,
      password,
      firstName,
      lastName,
      role: 'admin',
      label: 'Admin',
    });
  }

  private async seedDevUser() {
    if (!this.isDevMode) return;

    const email = this.configService.get<string>('DEV_USER_EMAIL');
    const password = this.configService.get<string>('DEV_USER_PASSWORD');
    const firstName = this.configService.get<string>('DEV_USER_FIRSTNAME', 'Dev');
    const lastName = this.configService.get<string>('DEV_USER_LASTNAME', 'Test');

    if (!email || !password) {
      this.logger.warn(
        'DEV_MODE=true pero DEV_USER_EMAIL o DEV_USER_PASSWORD no definidos. Saltando el seeding de dev user.',
      );
      return;
    }

    await this.upsertUser({
      email,
      password,
      firstName,
      lastName,
      role: 'user',
      label: 'Dev',
      extra: { isEmailVerified: true, vtoTokens: 999 },
    });
  }

  private async upsertUser(opts: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    label: string;
    extra?: Record<string, any>;
  }) {
    const { email, password, firstName, lastName, role, label, extra } = opts;

    try {
      const existingUser = await this.userModel
        .findOne({ email: email.toLowerCase() })
        .select('+password');

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      if (existingUser) {
        if (!this.isDevMode) {
          this.logger.log(`${label} user (${email}) ya existe. Saltando.`);
          return;
        }
        existingUser.password = hashedPassword;
        existingUser.firstname = firstName;
        existingUser.lastname = lastName;
        existingUser.role = role;
        if (extra) Object.assign(existingUser, extra);
        await existingUser.save();
        this.logger.log(
          `${label} user (${email}) ya existía — contraseña y datos reseteados desde .env.`,
        );
        return;
      }

      await this.userModel.create({
        firstname: firstName,
        lastname: lastName,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        isEmailVerified: true,
        ...extra,
      });

      this.logger.log(`${label} user creado con éxito: ${email} / ${password}`);
    } catch (error) {
      this.logger.error(`Error durante el seeding de ${label} user: ${error.message}`);
    }
  }
}
