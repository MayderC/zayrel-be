/**
 * Telegram & WhatsApp Message Templates
 * 
 * Centralized templates for all notification messages.
 * Separates content from delivery logic for easier maintenance.
 */

// ============================================
// STATUS CONFIGURATION MAPS
// ============================================

/**
 * Maps order status to the corresponding Telegram topic environment variable
 */
export const STATUS_TO_TOPIC_ENV: Record<string, string> = {
    'pagada': 'TELEGRAM_TOPIC_PAGADA',
    'rechazada': 'TELEGRAM_TOPIC_REVISION',
    'en_produccion': 'TELEGRAM_TOPIC_EN_PRODUCCION',
    'enviada': 'TELEGRAM_TOPIC_ENVIADA',
    'completada': 'TELEGRAM_TOPIC_COMPLETADA',
};

/**
 * Emoji icons for each order status
 */
export const STATUS_EMOJIS: Record<string, string> = {
    'pagada': '✅',
    'rechazada': '❌',
    'en_produccion': '🛠️',
    'enviada': '🚀',
    'completada': '📦',
};

/**
 * Human-readable labels for each order status
 */
export const STATUS_LABELS: Record<string, string> = {
    'pagada': 'PAGADA',
    'rechazada': 'RECHAZADA',
    'en_produccion': 'EN PRODUCCIÓN',
    'enviada': 'ENVIADA',
    'completada': 'COMPLETADA',
};

/**
 * Next workflow step buttons for each status
 */
export const WORKFLOW_NEXT_STEPS: Record<string, { text: string; action: string } | null> = {
    'pagada': { text: '🛠️ Mover a Producción', action: 'move_produccion' },
    'en_produccion': { text: '🚀 Marcar como Enviada', action: 'move_enviada' },
    'enviada': { text: '📦 Marcar Completada', action: 'move_completada' },
    'completada': null,
    'rechazada': null,
};

// ============================================
// INLINE KEYBOARD BUTTON DEFINITIONS
// ============================================

export const PAYMENT_REVIEW_BUTTONS = {
    initial: (orderId: string) => [
        [
            { text: '✅ Aprobar', callback_data: `approve_step1:${orderId}` },
            { text: '❌ Rechazar', callback_data: `reject_step1:${orderId}` }
        ]
    ],
    confirmApprove: (orderId: string) => [
        [
            { text: '✅ SÍ, APROBAR', callback_data: `approve_confirm:${orderId}` },
            { text: '↩️ Cancelar', callback_data: `cancel:${orderId}` }
        ]
    ],
    confirmReject: (orderId: string) => [
        [
            { text: '❌ SÍ, RECHAZAR', callback_data: `reject_confirm:${orderId}` },
            { text: '↩️ Cancelar', callback_data: `cancel:${orderId}` }
        ]
    ],
};

// ============================================
// WHATSAPP MESSAGE TEMPLATES
// ============================================

interface WhatsAppTemplateParams {
    customerName: string;
    shortOrderId: string;
    trackingNumber?: string;
}

/**
 * Generates WhatsApp message for payment approval
 */
export function getWhatsAppApprovedMessage({ customerName, shortOrderId }: WhatsAppTemplateParams): string {
    return `Hola ${customerName}! 🎨\n\nTu pago para la orden #${shortOrderId} fue aprobado ✅\n\nPronto comenzamos con la producción de tu pedido. ¡Gracias por tu compra!`;
}

/**
 * Generates WhatsApp message for payment rejection
 */
export function getWhatsAppRejectedMessage({ customerName, shortOrderId }: WhatsAppTemplateParams): string {
    return `Hola ${customerName},\n\nHubo un problema con el comprobante de pago de tu orden #${shortOrderId}.\n\nPor favor envía un nuevo comprobante o contáctanos para más información.`;
}

/**
 * Generates WhatsApp message based on order status
 */
export function getWhatsAppStatusMessage(
    status: string,
    { customerName, shortOrderId, trackingNumber }: WhatsAppTemplateParams
): string {
    const templates: Record<string, string> = {
        'pagada': `Hola ${customerName}! 🎨\n\nTu pago fue aprobado ✅ Pronto comenzamos con la producción de tu orden #${shortOrderId}.\n\n¡Gracias por tu compra!`,
        'rechazada': `Hola ${customerName},\n\nHubo un problema con tu pago para la orden #${shortOrderId}.\n\nPor favor contáctanos para más información.`,
        'en_produccion': `Hola ${customerName}! 🛠️\n\nTu orden #${shortOrderId} ya está en producción.\n\nTe avisaremos cuando esté lista para envío.`,
        'enviada': `Hola ${customerName}! 🚀\n\nTu orden #${shortOrderId} va en camino.${trackingNumber ? `\n\nNúmero de guía: ${trackingNumber}` : ''}\n\n¡Gracias por tu preferencia!`,
        'completada': `Hola ${customerName}! 📦\n\nTu orden #${shortOrderId} fue entregada.\n\n¡Esperamos que disfrutes tu compra! Si tienes alguna pregunta, estamos para ayudarte.`,
    };

    return templates[status] || '';
}

// ============================================
// TELEGRAM MESSAGE TEMPLATES
// ============================================

interface PaymentProofMessageParams {
    shortOrderId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    total: string;
    paymentMethod: string;
    reference?: string;
    whatsappApproved: string;
    whatsappRejected: string;
}

/**
 * Generates the Telegram message for payment proof review
 */
export function buildPaymentProofMessage({
    shortOrderId,
    customerName,
    customerEmail,
    customerPhone,
    total,
    paymentMethod,
    reference,
    whatsappApproved,
    whatsappRejected,
}: PaymentProofMessageParams): string {
    return `
🧾 <b>Nuevo Comprobante de Pago</b>

<b>Orden:</b> #${shortOrderId}
<b>Cliente:</b> ${customerName}
<b>Email:</b> ${customerEmail}${customerPhone ? `\n<b>📱 Tel:</b> ${customerPhone}` : ''}
<b>Total:</b> ${total}
<b>Método:</b> ${paymentMethod}${reference ? `\n<b>Referencia:</b> ${reference}` : ''}

<i>Toca un botón para aprobar o rechazar:</i>

━━━━━━━━━━━━━━━━━━
<b>📋 WhatsApp (Aprobado):</b>
<code>${whatsappApproved}</code>

<b>📋 WhatsApp (Rechazado):</b>
<code>${whatsappRejected}</code>
    `.trim();
}

interface StatusChangeMessageParams {
    shortOrderId: string;
    statusEmoji: string;
    statusLabel: string;
    dateStr: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    total: string;
    itemsText: string;
    trackingNumber?: string;
    extraNote?: string;
    whatsappTemplate?: string;
}

/**
 * Generates the Telegram message for order status changes
 */
export function buildStatusChangeMessage({
    shortOrderId,
    statusEmoji,
    statusLabel,
    dateStr,
    customerName,
    customerEmail,
    customerPhone,
    total,
    itemsText,
    trackingNumber,
    extraNote,
    whatsappTemplate,
}: StatusChangeMessageParams): string {
    let message = `
${statusEmoji} <b>Orden #${shortOrderId}</b> - ${statusLabel}

<b>📅 Fecha:</b> ${dateStr}
<b>👤 Cliente:</b> ${customerName}
<b>📧 Email:</b> ${customerEmail}${customerPhone ? `\n<b>📱 Tel:</b> ${customerPhone}` : ''}
<b>💰 Total:</b> ${total} (${itemsText})${trackingNumber ? `\n<b>Guía:</b> ${trackingNumber}` : ''}
    `.trim();

    if (extraNote) {
        message += `\n<b>📝 Nota:</b> ${extraNote}`;
    }

    if (whatsappTemplate) {
        message += `\n\n━━━━━━━━━━━━━━━━━━\n<b>📋 WhatsApp:</b>\n<code>${whatsappTemplate}</code>`;
    }

    return message;
}

// ============================================
// QUOTE NOTIFICATION TEMPLATES
// ============================================

interface NewQuoteMessageParams {
    shortQuoteId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerTelegram?: string;
    productName: string;
    sizeName: string;
    colorName: string;
    quantity: number;
    clientNotes?: string;
    preferredContactMethod: string;
    estimatedPrice?: number;
    dashboardUrl: string;
}

/**
 * Buttons for quote notifications.
 * Opens dashboard directly - no approve/reject here, price is set in the admin.
 */
export const QUOTE_BUTTONS = {
    viewInDashboard: (quoteId: string, dashboardUrl: string) => [
        [
            { text: '💰 Ver Cotización en Dashboard', url: `${dashboardUrl}/dashboard/quotes/${quoteId}` }
        ]
    ],
};

/**
 * Generates the Telegram message for a new custom design quote request
 */
export function buildNewQuoteMessage({
    shortQuoteId,
    customerName,
    customerEmail,
    customerPhone,
    customerTelegram,
    productName,
    sizeName,
    colorName,
    quantity,
    clientNotes,
    preferredContactMethod,
    estimatedPrice,
    dashboardUrl,
}: NewQuoteMessageParams): string {
    return `
🎨 <b>Nueva Solicitud de Diseño Personalizado</b>

<b>Cotización:</b> #${shortQuoteId}
<b>👤 Cliente:</b> ${customerName}
<b>📧 Email:</b> ${customerEmail}${customerPhone ? `\n<b>📱 Tel:</b> ${customerPhone}` : ''}${customerTelegram ? `\n<b>🆔 Telegram:</b> @${customerTelegram.replace('@', '')}` : ''}
<b>🎯 Preferencia:</b> ${preferredContactMethod.toUpperCase()}
${estimatedPrice ? `<b>💰 Precio Est.:</b> ₡${estimatedPrice.toLocaleString('es-CR')}` : ''}

<b>👕 Prenda:</b> ${productName}
<b>📐 Talla:</b> ${sizeName}
<b>🎨 Color:</b> ${colorName}
<b>🔢 Cantidad:</b> ${quantity} unidad${quantity > 1 ? 'es' : ''}
${clientNotes ? `\n<b>📝 Nota del cliente:</b> ${clientNotes}` : ''}

<i>Abre el dashboard para ver el diseño completo y asignar precio.</i>
    `.trim();
}
