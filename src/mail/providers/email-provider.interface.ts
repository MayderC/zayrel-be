/**
 * Email Provider Interface
 * All email providers must implement this interface
 */

export interface SendMailOptions {
    to: string;
    subject: string;
    html: string;
    from?: string;
    text?: string;
}

export interface EmailProvider {
    /**
     * Provider name for logging/debugging
     */
    readonly name: string;

    /**
     * Send an email
     */
    sendMail(options: SendMailOptions): Promise<void>;
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
export const EMAIL_FALLBACK_PROVIDER = 'EMAIL_FALLBACK_PROVIDER';
