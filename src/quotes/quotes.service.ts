import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quote, QuoteDocument, Variant, VariantDocument, Product, ProductDocument, User, UserDocument } from '../database/schemas';
import { CreateQuoteDto, PriceQuoteDto, RejectQuoteDto } from './quotes.dto';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../notifications/telegram.service';
import { buildNewQuoteMessage, QUOTE_BUTTONS } from '../notifications/telegram-templates';

@Injectable()
export class QuotesService {
    private readonly logger = new Logger(QuotesService.name);

    constructor(
        @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
        @InjectModel(Variant.name) private variantModel: Model<VariantDocument>,
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private mailService: MailService,
        private configService: ConfigService,
        private telegramService: TelegramService,
    ) { }

    async create(dto: CreateQuoteDto, authenticatedUser: any) {
        // Fetch variant with full population for validation and notification
        const variant = await this.variantModel
            .findById(dto.variantId)
            .populate('product')
            .populate('color')
            .populate('size');

        if (!variant) {
            throw new NotFoundException(`Variante ${dto.variantId} no encontrada`);
        }

        // ── Stock validation ──
        if (variant.stock < dto.quantity) {
            throw new BadRequestException(
                `Stock insuficiente. Disponible: ${variant.stock}, solicitado: ${dto.quantity}`
            );
        }

        let user: UserDocument | null = null;
        if (authenticatedUser) {
            user = await this.userModel.findById(authenticatedUser._id);
        }

        const quoteData: any = {
            variantId: new Types.ObjectId(dto.variantId),
            quantity: dto.quantity,
            designState: dto.designState,
            designImageUrls: dto.designImageUrls,
            garmentId: dto.garmentId,
            shirtColor: dto.shirtColor,
            clientNotes: dto.clientNotes,
            status: 'pending',
        };

        if (user) {
            quoteData.user = new Types.ObjectId((user as any)._id);
            quoteData.preferredContactMethod = dto.preferredContactMethod || 'email';
            quoteData.estimatedPrice = dto.estimatedPrice;
        } else {
            // Guest data validation: Email is now strictly mandatory per user feedback
            if (!dto.guestEmail || !dto.guestName) {
                throw new BadRequestException('Se requiere nombre y correo para procesar la cotización');
            }
            quoteData.guestName = dto.guestName;
            quoteData.guestEmail = dto.guestEmail;
            quoteData.guestPhone = dto.guestPhone;
            quoteData.guestTelegram = dto.guestTelegram;
            quoteData.preferredContactMethod = dto.preferredContactMethod || 'email';
            quoteData.estimatedPrice = dto.estimatedPrice;
        }

        const quote = await this.quoteModel.create(quoteData);

        const shortId = (quote._id as any).toString().slice(-6).toUpperCase();
        const dashboardUrl = this.configService.get<string>('FRONTEND_URL') || 'https://zayrel.com';
        const product = variant.product as any;
        const color = variant.color as any;
        const size = variant.size as any;

        // ── Notifications Data Consolidation ──
        const customerName = user ? `${user.firstname} ${user.lastname}` : dto.guestName!;
        const customerEmail = user ? user.email : dto.guestEmail!;
        const customerPhone = user ? (user as any).phone : dto.guestPhone;
        const customerTelegram = user ? (user as any).telegram : dto.guestTelegram;

        // ── Email confirmation to client ──
        this.mailService.sendQuoteReceived(quote, user || ({
            firstname: customerName,
            lastname: '',
            email: customerEmail
        } as any)).catch((err) => {
            this.logger.error('Error sending quote received email', err);
        });

        // ── Telegram notification to admin ──
        const message = buildNewQuoteMessage({
            shortQuoteId: shortId,
            customerName,
            customerEmail,
            customerPhone,
            customerTelegram,
            productName: product?.name || 'Prenda personalizada',
            sizeName: size?.name || '?',
            colorName: color?.name || '?',
            quantity: dto.quantity,
            clientNotes: dto.clientNotes,
            preferredContactMethod: quoteData.preferredContactMethod,
            estimatedPrice: quoteData.estimatedPrice,
            dashboardUrl,
        });

        const buttons = QUOTE_BUTTONS.viewInDashboard((quote._id as any).toString(), dashboardUrl);

        // If a design preview image exists, send it as photo; otherwise send text
        const previewUrl = dto.designImageUrls?.[0];
        if (previewUrl && previewUrl.startsWith('http')) {
            this.telegramService.sendQuoteNotification(message, previewUrl, buttons).catch((err) => {
                this.logger.error('Error sending quote Telegram notification', err);
            });
        } else {
            this.telegramService.sendQuoteTextNotification(message, buttons).catch((err) => {
                this.logger.error('Error sending quote Telegram text notification', err);
            });
        }

        return quote;
    }

    async findAll(options: { page: number; limit: number; search?: string; status?: string }) {
        const { page, limit, search, status } = options;
        const skip = (page - 1) * limit;

        const filter: any = {};

        if (status && status !== 'all') {
            filter.status = status;
        }

        if (search) {
            const userMatches = await this.userModel.find({
                $or: [
                    { firstname: { $regex: search, $options: 'i' } },
                    { lastname: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                ],
            }).select('_id');
            const userIds = userMatches.map((u) => u._id);

            filter.$or = [
                { user: { $in: userIds } },
                { _id: Types.ObjectId.isValid(search) ? new Types.ObjectId(search) : undefined },
            ].filter((c) => c._id !== undefined || c.user !== undefined);
        }

        const [quotes, total] = await Promise.all([
            this.quoteModel
                .find(filter)
                .populate({ path: 'user', select: 'firstname lastname email' })
                .populate({ path: 'variantId', populate: { path: 'product', select: 'name price' } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            this.quoteModel.countDocuments(filter),
        ]);

        return {
            quotes,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findMyQuotes(userId: string) {
        return this.quoteModel
            .find({ user: new Types.ObjectId(userId) })
            .populate({ path: 'variantId', populate: { path: 'product', select: 'name price' } })
            .sort({ createdAt: -1 });
    }

    async findOne(id: string) {
        const quote = await this.quoteModel
            .findById(id)
            .populate({ path: 'user', select: 'firstname lastname email' })
            .populate({ path: 'variantId', populate: { path: 'product', select: 'name price' } });

        if (!quote) {
            throw new NotFoundException(`Cotización ${id} no encontrada`);
        }

        return quote;
    }

    async setPrice(id: string, dto: PriceQuoteDto) {
        const quote = await this.quoteModel.findById(id).populate({ path: 'user', select: 'firstname lastname email' });
        if (!quote) {
            throw new NotFoundException(`Cotización ${id} no encontrada`);
        }

        if (!['pending', 'sent'].includes(quote.status)) {
            throw new BadRequestException(`No se puede fijar precio en estado "${quote.status}"`);
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        quote.quotedPrice = dto.quotedPrice;
        quote.priceNotes = dto.priceNotes;
        quote.status = 'sent';
        quote.sentAt = new Date();
        quote.expiresAt = expiresAt;

        await quote.save();

        if (quote.user) {
            this.mailService.sendQuotePriced(quote, quote.user as any).catch((err) => {
                this.logger.error('Error sending quote priced email', err);
            });
        }

        return quote;
    }

    async acceptQuote(id: string, userId: string) {
        const quote = await this.quoteModel.findById(id).populate({ path: 'user', select: 'firstname lastname email' });
        if (!quote) {
            throw new NotFoundException(`Cotización ${id} no encontrada`);
        }

        if (!quote.user || quote.user.toString() !== userId) {
            throw new ForbiddenException('No tenés acceso a esta cotización');
        }

        if (quote.status !== 'sent') {
            throw new BadRequestException(`Solo se puede aceptar una cotización en estado "sent"`);
        }

        quote.status = 'accepted';
        quote.respondedAt = new Date();
        await quote.save();

        const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
        if (adminEmail) {
            this.mailService.sendQuoteAccepted(quote, adminEmail).catch((err) => {
                this.logger.error('Error sending quote accepted email', err);
            });
        }

        return quote;
    }

    async rejectQuote(id: string, userId: string, dto: RejectQuoteDto) {
        const quote = await this.quoteModel.findById(id).populate({ path: 'user', select: 'firstname lastname email' });
        if (!quote) {
            throw new NotFoundException(`Cotización ${id} no encontrada`);
        }

        if (!quote.user || quote.user.toString() !== userId) {
            throw new ForbiddenException('No tenés acceso a esta cotización');
        }

        if (quote.status !== 'sent') {
            throw new BadRequestException(`Solo se puede rechazar una cotización en estado "sent"`);
        }

        quote.status = 'rejected';
        quote.respondedAt = new Date();
        quote.rejectionReason = dto.rejectionReason;
        await quote.save();

        const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
        if (adminEmail) {
            this.mailService.sendQuoteRejected(quote, adminEmail).catch((err) => {
                this.logger.error('Error sending quote rejected email', err);
            });
        }

        return quote;
    }

    async markConverted(id: string, orderId: string) {
        const quote = await this.quoteModel.findById(id);
        if (!quote) {
            throw new NotFoundException(`Cotización ${id} no encontrada`);
        }

        quote.status = 'converted';
        quote.convertedToOrderId = new Types.ObjectId(orderId);
        await quote.save();

        return quote;
    }

    async expireOldQuotes() {
        const now = new Date();
        const expired = await this.quoteModel.find({
            status: 'sent',
            expiresAt: { $lt: now },
        }).populate({ path: 'user', select: 'firstname lastname email' });

        if (expired.length === 0) return;

        this.logger.log(`Expirando ${expired.length} cotizaciones vencidas`);

        for (const quote of expired) {
            quote.status = 'expired';
            await quote.save();

            if (quote.user) {
                this.mailService.sendQuoteExpired(quote, quote.user as any).catch((err) => {
                    this.logger.error(`Error sending quote expired email for ${quote._id}`, err);
                });
            }
        }
    }
}
