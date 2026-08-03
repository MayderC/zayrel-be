import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EMAIL_PROVIDER,
  EMAIL_FALLBACK_PROVIDER,
  EmailProvider,
  SendMailOptions,
} from './providers';
import { EmailTemplateService } from './email-template.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly isTestMode: boolean;
  private readonly testRecipient: string | undefined;

  // Centralized brand/site configuration
  private readonly brandName: string;
  private readonly siteUrl: string;
  private readonly storeUrl: string;
  private readonly instagramUrl: string;

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly primaryProvider: EmailProvider,
    @Optional()
    @Inject(EMAIL_FALLBACK_PROVIDER)
    private readonly fallbackProvider: EmailProvider | null,
    private readonly configService: ConfigService,
    private readonly templateService: EmailTemplateService,
  ) {
    this.isTestMode = this.configService.get('NODE_ENV') === 'development';
    this.testRecipient = this.configService.get('MAIL_TEST_RECIPIENT');

    // Brand configuration from env or defaults
    this.brandName = this.configService.get('BRAND_NAME') || 'ZayrelStudio';
    this.siteUrl = this.configService.get('SITE_URL') || 'https://www.zayrelstudio.com';
    this.storeUrl = this.configService.get('STORE_URL') || this.siteUrl;
    this.instagramUrl =
      this.configService.get('INSTAGRAM_URL') || 'https://www.instagram.com/zayrelstudio';

    this.logger.log(`📧 Primary provider: ${this.primaryProvider.name}`);
    if (this.fallbackProvider) {
      this.logger.log(`📧 Fallback provider: ${this.fallbackProvider.name}`);
    }
  }

  /**
   * Common template variables used across all emails
   */
  private getCommonTemplateVars() {
    return {
      brandName: this.brandName,
      siteUrl: this.siteUrl,
      storeUrl: this.storeUrl,
      instagramUrl: this.instagramUrl,
      year: new Date().getFullYear(),
    };
  }

  /**
   * Get current provider info for debugging
   */
  getProviderInfo() {
    return {
      provider: this.primaryProvider.name,
      fallbackProvider: this.fallbackProvider?.name || null,
      isTestMode: this.isTestMode,
      testRecipient: this.testRecipient,
      availableTemplates: this.templateService.getAvailableTemplates(),
    };
  }

  /**
   * Core method to send emails with test mode and fallback support
   */
  private async sendMail(options: SendMailOptions): Promise<void> {
    const originalRecipient = options.to;
    let finalRecipient = options.to;
    let subject = options.subject;

    // In test mode, redirect all emails to the test recipient
    if (this.isTestMode && this.testRecipient) {
      finalRecipient = this.testRecipient;
      subject = `[TEST - Para: ${originalRecipient}] ${options.subject}`;
      this.logger.warn(
        `📧 TEST MODE: Redirecting email from ${originalRecipient} to ${this.testRecipient}`,
      );
    }

    const mailOptions: SendMailOptions = {
      ...options,
      to: finalRecipient,
      subject: subject,
    };

    // Try primary provider
    try {
      await this.primaryProvider.sendMail(mailOptions);
      this.logger.log(`✅ Email sent via ${this.primaryProvider.name} to ${finalRecipient}`);
      return;
    } catch (primaryError) {
      this.logger.error(
        `❌ Primary provider (${this.primaryProvider.name}) failed: ${primaryError.message}`,
      );

      // Try fallback if available
      if (this.fallbackProvider) {
        this.logger.warn(`🔄 Trying fallback provider: ${this.fallbackProvider.name}`);
        try {
          await this.fallbackProvider.sendMail(mailOptions);
          this.logger.log(
            `✅ Email sent via fallback (${this.fallbackProvider.name}) to ${finalRecipient}`,
          );
          return;
        } catch (fallbackError) {
          this.logger.error(
            `❌ Fallback provider (${this.fallbackProvider.name}) also failed: ${fallbackError.message}`,
          );
          throw new Error(
            `All email providers failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`,
          );
        }
      }

      throw primaryError;
    }
  }

  /**
   * Send welcome email to new users
   * @param user User info (email, name)
   * @param magicLinkUrl Optional magic link URL for one-click login
   */
  async sendUserWelcome(
    user: { email: string; name: string },
    magicLinkUrl?: string,
  ): Promise<void> {
    const html = this.templateService.render('welcome', {
      ...this.getCommonTemplateVars(),
      name: user.name,
      email: user.email,
      magicLinkUrl: magicLinkUrl || this.storeUrl, // Fallback to store URL if no magic link
    });

    await this.sendMail({
      to: user.email,
      subject: `¡Bienvenido a ${this.brandName}! 🎉`,
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(user: { email: string; name: string }, resetUrl: string): Promise<void> {
    const html = this.templateService.render('password-reset', {
      ...this.getCommonTemplateVars(),
      name: user.name,
      email: user.email,
      resetUrl,
      expiresIn: '1 hora',
    });

    await this.sendMail({
      to: user.email,
      subject: `🔐 Restablecer tu contraseña - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send email verification email
   */
  async sendEmailVerification(
    user: { email: string; name: string },
    verifyUrl: string,
  ): Promise<void> {
    const html = this.templateService.render('email-verification', {
      ...this.getCommonTemplateVars(),
      name: user.name,
      email: user.email,
      verifyUrl,
      expiresIn: '48 horas',
    });

    await this.sendMail({
      to: user.email,
      subject: `✅ Verifica tu email - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send a custom email using a specific template
   */
  async sendWithTemplate(
    to: string,
    subject: string,
    templateName: string,
    data: Record<string, any>,
  ): Promise<void> {
    const html = this.templateService.render(templateName, {
      ...data,
      email: to,
      year: new Date().getFullYear(),
    });

    await this.sendMail({ to, subject, html });
  }

  // ==================== ORDER & PAYMENT NOTIFICATIONS ====================

  /**
   * Helper to get customer email from order
   */
  private getCustomerEmail(order: any): string | null {
    return order.guestInfo?.email || order.user?.email || order.shippingAddress?.email || null;
  }

  /**
   * Helper to get customer name from order
   */
  private getCustomerName(order: any): string {
    if (order.guestInfo?.name) return order.guestInfo.name;
    if (order.user?.firstname) return `${order.user.firstname} ${order.user.lastname || ''}`.trim();
    return 'Cliente';
  }

  /**
   * Helper to get readable payment method name
   */
  private getPaymentMethodDisplay(method: string): string {
    const methods: Record<string, string> = {
      onvopay: 'Tarjeta de Crédito/Débito',
      paypal: 'PayPal',
      sinpe: 'SINPE Móvil',
      transfer: 'Transferencia Bancaria',
      manual: 'Transferencia / SINPE',
      other: 'Otro método',
    };
    return methods[method] || method;
  }

  /**
   * Send order confirmation email when order is created
   * @param order - The order object with all details
   */
  async sendOrderConfirmation(order: any): Promise<void> {
    const customerEmail = this.getCustomerEmail(order);
    if (!customerEmail) {
      this.logger.warn(`Cannot send order confirmation - no email for order ${order._id}`);
      return;
    }

    const orderNumber = order._id.toString().slice(-8).toUpperCase();
    const paymentMethod = order.paymentProof?.method || 'manual';

    // Prepare items with calculated totals
    const items = (order.items || []).map((item: any) => ({
      name: item.name || 'Producto',
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const html = this.templateService.render('order-confirmation', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName: this.getCustomerName(order),
      orderNumber,
      items,
      subtotal: order.subtotal || order.total,
      shippingCost: order.shippingCost || 0,
      freeShipping: (order.shippingCost || 0) === 0,
      discount: order.discount || 0,
      total: order.total,
      paymentMethodDisplay: this.getPaymentMethodDisplay(paymentMethod),
      shippingAddress: order.shippingAddress || {},
      isManualPayment:
        paymentMethod === 'manual' || paymentMethod === 'sinpe' || paymentMethod === 'transfer',
      orderUrl: `${this.storeUrl}/order/${order._id}`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `🛍️ Orden #${orderNumber} confirmada - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send payment approved email
   * @param order - The order object after payment is verified
   */
  async sendPaymentApproved(order: any): Promise<void> {
    const customerEmail = this.getCustomerEmail(order);
    if (!customerEmail) {
      this.logger.warn(`Cannot send payment approved email - no email for order ${order._id}`);
      return;
    }

    const orderNumber = order._id.toString().slice(-8).toUpperCase();
    const paymentMethod = order.paymentProof?.method || 'manual';

    const items = (order.items || []).map((item: any) => ({
      name: item.productName || item.name || 'Producto',
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const html = this.templateService.render('payment-approved', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName: this.getCustomerName(order),
      orderNumber,
      total: order.total,
      paymentMethodDisplay: this.getPaymentMethodDisplay(paymentMethod),
      transactionId: order.paymentProof?.reference || null,
      paymentDate: new Date(),
      items,
      itemCount: items.length,
      orderUrl: `${this.storeUrl}/order/${order._id}`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `✅ Pago aprobado - Orden #${orderNumber} - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send payment rejected email
   * @param order - The order object after payment is rejected
   * @param reason - Optional rejection reason
   */
  async sendPaymentRejected(order: any, reason?: string): Promise<void> {
    const customerEmail = this.getCustomerEmail(order);
    if (!customerEmail) {
      this.logger.warn(`Cannot send payment rejected email - no email for order ${order._id}`);
      return;
    }

    const orderNumber = order._id.toString().slice(-8).toUpperCase();

    const html = this.templateService.render('payment-rejected', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName: this.getCustomerName(order),
      orderNumber,
      total: order.total,
      reason: reason || null,
      orderUrl: `${this.storeUrl}/order/${order._id}`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `❌ Comprobante rechazado - Orden #${orderNumber} - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send payment proof received email (confirmation that we got the proof)
   * @param order - The order object after payment proof is uploaded
   */
  async sendPaymentProofReceived(order: any): Promise<void> {
    const customerEmail = this.getCustomerEmail(order);
    if (!customerEmail) {
      this.logger.warn(
        `Cannot send payment proof received email - no email for order ${order._id}`,
      );
      return;
    }

    const orderNumber = order._id.toString().slice(-8).toUpperCase();
    const paymentMethod = order.paymentProof?.method || 'manual';

    const items = (order.items || []).map((item: any) => ({
      name: item.productName || item.name || 'Producto',
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const html = this.templateService.render('payment-proof-received', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName: this.getCustomerName(order),
      orderNumber,
      items,
      total: order.total,
      paymentMethodDisplay: this.getPaymentMethodDisplay(paymentMethod),
      reference: order.paymentProof?.reference || null,
      orderUrl: `${this.storeUrl}/order/${order._id}`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `📋 Comprobante recibido - Orden #${orderNumber} - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send order in production email
   */
  async sendOrderInProduction(order: any): Promise<void> {
    const customerEmail = this.getCustomerEmail(order);
    if (!customerEmail) return;

    const orderNumber = order._id.toString().slice(-8).toUpperCase();

    const items = (order.items || []).map((item: any) => ({
      name: item.productName || item.name || 'Producto',
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const html = this.templateService.render('order-in-production', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName: this.getCustomerName(order),
      orderNumber,
      items,
      itemCount: items.length,
      orderUrl: `${this.storeUrl}/order/${order._id}`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `🛠️ Tu pedido está en producción - Orden #${orderNumber} - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send order shipped email
   */
  async sendOrderShipped(order: any): Promise<void> {
    const customerEmail = this.getCustomerEmail(order);
    if (!customerEmail) return;

    const orderNumber = order._id.toString().slice(-8).toUpperCase();

    const html = this.templateService.render('order-shipped', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName: this.getCustomerName(order),
      orderNumber,
      trackingNumber: order.trackingNumber,
      shippingProvider: order.shippingProvider || 'Correos de Costa Rica',
      orderUrl: `${this.storeUrl}/order/${order._id}`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `🚀 ¡Tu pedido ha sido enviado! - Orden #${orderNumber} - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send order completed email
   */
  async sendOrderCompleted(order: any): Promise<void> {
    const customerEmail = this.getCustomerEmail(order);
    if (!customerEmail) return;

    const orderNumber = order._id.toString().slice(-8).toUpperCase();

    const html = this.templateService.render('order-completed', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName: this.getCustomerName(order),
      orderNumber,
      storeUrl: this.storeUrl,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `📦 Pedido entregado - Orden #${orderNumber} - ${this.brandName}`,
      html,
    });
  }

  // ==================== QUOTE NOTIFICATIONS ====================

  /**
   * Send confirmation to client when they submit a quote request
   */
  async sendQuoteReceived(quote: any, user: any): Promise<void> {
    const customerEmail = user?.email;
    if (!customerEmail) return;

    const quoteNumber = quote._id.toString().slice(-8).toUpperCase();
    const customerName = user.firstname
      ? `${user.firstname} ${user.lastname || ''}`.trim()
      : 'Cliente';

    const html = this.templateService.render('quote-received', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName,
      quoteNumber,
      quotesUrl: `${this.storeUrl}/store/quotes`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `📋 Cotización #${quoteNumber} recibida - ${this.brandName}`,
      html,
    });
  }

  /**
   * Send priced quote to client so they can accept or reject
   */
  async sendQuotePriced(quote: any, user: any): Promise<void> {
    const customerEmail = user?.email;
    if (!customerEmail) return;

    const quoteNumber = quote._id.toString().slice(-8).toUpperCase();
    const customerName = user.firstname
      ? `${user.firstname} ${user.lastname || ''}`.trim()
      : 'Cliente';

    const html = this.templateService.render('quote-priced', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName,
      quoteNumber,
      quotedPrice: quote.quotedPrice,
      priceNotes: quote.priceNotes,
      expiresAt: quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString('es-CR') : null,
      quoteUrl: `${this.storeUrl}/store/quotes`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `💰 Tu cotización #${quoteNumber} está lista - ${this.brandName}`,
      html,
    });
  }

  /**
   * Notify admin when client accepts a quote
   */
  async sendQuoteAccepted(quote: any, adminEmail: string): Promise<void> {
    const quoteNumber = quote._id.toString().slice(-8).toUpperCase();
    const customerName = quote.user?.firstname
      ? `${quote.user.firstname} ${quote.user.lastname || ''}`.trim()
      : 'Cliente';

    const html = this.templateService.render('quote-accepted', {
      ...this.getCommonTemplateVars(),
      email: adminEmail,
      customerName,
      quoteNumber,
      quotedPrice: quote.quotedPrice,
      dashboardUrl: `${this.siteUrl}/dashboard/quotes`,
    });

    await this.sendMail({
      to: adminEmail,
      subject: `✅ Cliente aceptó cotización #${quoteNumber} - ${this.brandName}`,
      html,
    });
  }

  /**
   * Notify admin when client rejects a quote
   */
  async sendQuoteRejected(quote: any, adminEmail: string): Promise<void> {
    const quoteNumber = quote._id.toString().slice(-8).toUpperCase();
    const customerName = quote.user?.firstname
      ? `${quote.user.firstname} ${quote.user.lastname || ''}`.trim()
      : 'Cliente';

    const html = this.templateService.render('quote-rejected', {
      ...this.getCommonTemplateVars(),
      email: adminEmail,
      customerName,
      quoteNumber,
      rejectionReason: quote.rejectionReason,
      dashboardUrl: `${this.siteUrl}/dashboard/quotes`,
    });

    await this.sendMail({
      to: adminEmail,
      subject: `❌ Cliente rechazó cotización #${quoteNumber} - ${this.brandName}`,
      html,
    });
  }

  /**
   * Notify client when their quote has expired
   */
  async sendQuoteExpired(quote: any, user: any): Promise<void> {
    const customerEmail = user?.email;
    if (!customerEmail) return;

    const quoteNumber = quote._id.toString().slice(-8).toUpperCase();
    const customerName = user.firstname
      ? `${user.firstname} ${user.lastname || ''}`.trim()
      : 'Cliente';

    const html = this.templateService.render('quote-expired', {
      ...this.getCommonTemplateVars(),
      email: customerEmail,
      customerName,
      quoteNumber,
      appUrl: `${this.siteUrl}/app`,
    });

    await this.sendMail({
      to: customerEmail,
      subject: `⏰ Tu cotización #${quoteNumber} venció - ${this.brandName}`,
      html,
    });
  }
}
