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
    ) { }

    async onApplicationBootstrap() {
        await this.seedAdmin();
    }

    private async seedAdmin() {
        const email = this.configService.get<string>('ADMIN_SEED_EMAIL');
        const password = this.configService.get<string>('ADMIN_SEED_PASSWORD');
        const firstName = this.configService.get<string>('ADMIN_SEED_FIRSTNAME', 'Admin');
        const lastName = this.configService.get<string>('ADMIN_SEED_LASTNAME', 'Sistema');

        if (!email || !password) {
            this.logger.warn('ADMIN_SEED_EMAIL o ADMIN_SEED_PASSWORD no definidos. Saltando el seeding de admin.');
            return;
        }

        try {
            const existingUser = await this.userModel.findOne({ email: email.toLowerCase() });

            if (existingUser) {
                this.logger.log(`Usuario admin (${email}) ya existe. Saltando creación.`);
                return;
            }

            // Create admin user
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            await this.userModel.create({
                firstname: firstName,
                lastname: lastName,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: 'admin',
                isEmailVerified: true,
            });

            this.logger.log(`Usuario administrador creado con éxito: ${email}`);
        } catch (error) {
            this.logger.error(`Error durante el seeding de admin: ${error.message}`);
        }
    }
}
