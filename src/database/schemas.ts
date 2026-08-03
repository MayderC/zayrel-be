import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Schemas for Zayrel Studio based on Mermaid ER model
 */

// -----------------------------
// USER
// -----------------------------
// Represents a user in the system with personal details, authentication information, and roles.
export type UserDocument = User &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true }) firstname: string;
  @Prop({ required: true }) lastname: string;
  @Prop({ required: true, unique: true, lowercase: true }) email: string;
  @Prop({ required: true, select: false }) password: string; // hashed password
  @Prop({ default: 'user', enum: ['user', 'admin'] }) role: string; // user or admin
  @Prop({ default: false }) isEmailVerified: boolean; // true if email is verified
  @Prop({ default: false }) isBanned: boolean; // true if user is banned
  @Prop({ default: false }) isDeleted: boolean; // true if user is deleted
  @Prop({ default: 4 }) vtoTokens: number; // Virtual Try-On tokens (4 free, +5 per purchase)
  @Prop() phone?: string;
  @Prop() telegram?: string;

  // --- Zayrel Plaza (minigame) ---
  @Prop({ default: 0 }) zaycoins: number; // Moneda virtual ganada jugando
  @Prop({ type: String, default: null }) activeAvatarSkin?: string; // SKU de camiseta equipada
  @Prop({ default: false }) isStarSeller: boolean; // Halo dorado: comprador frecuente

  @Prop({
    type: [
      {
        label: { type: String }, // e.g., 'Home', 'Office'
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zipRegion: { type: String },
        country: { type: String },
        phone: { type: String },
        isDefault: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  addresses: {
    label: string;
    street: string;
    city: string;
    state: string;
    zipRegion: string;
    country: string;
    phone: string;
    isDefault: boolean;
  }[];
}
export const UserSchema = SchemaFactory.createForClass(User);

// -----------------------------
// PASSWORD RESET TOKEN
// -----------------------------
// Stores tokens for password reset functionality with expiration and usage tracking.
export type PasswordResetTokenDocument = PasswordResetToken & Document;

@Schema({ timestamps: true, collection: 'password_reset_tokens' })
export class PasswordResetToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token: string; // Hashed token (raw token is sent via email)

  @Prop({ required: true })
  expiresAt: Date; // 1 hour from creation

  @Prop({ default: false })
  isUsed: boolean; // true = already used
}
export const PasswordResetTokenSchema = SchemaFactory.createForClass(PasswordResetToken);

// -----------------------------
// MAGIC LINK TOKEN
// -----------------------------
// Stores tokens for magic link authentication (one-click login from welcome email).
export type MagicLinkTokenDocument = MagicLinkToken & Document;

@Schema({ timestamps: true, collection: 'magic_link_tokens' })
export class MagicLinkToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token: string; // Hashed token (raw token is sent via email)

  @Prop({ required: true })
  expiresAt: Date; // 24 hours from creation

  @Prop({ default: false })
  isUsed: boolean; // true = already used (one-time use)
}
export const MagicLinkTokenSchema = SchemaFactory.createForClass(MagicLinkToken);

// -----------------------------
// EMAIL VERIFICATION TOKEN
// -----------------------------
export type EmailVerificationTokenDocument = EmailVerificationToken & Document;

@Schema({ timestamps: true, collection: 'email_verification_tokens' })
export class EmailVerificationToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  isUsed: boolean;
}
export const EmailVerificationTokenSchema = SchemaFactory.createForClass(EmailVerificationToken);

// -----------------------------
// CART ITEM (Embedded)
// -----------------------------
export class CartItem {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Variant' })
  variantId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ default: Date.now })
  addedAt: Date;
}
export const CartItemSchema = SchemaFactory.createForClass(CartItem);

// -----------------------------
// CART
// -----------------------------
// Stores the shopping cart for logged-in users
export type CartDocument = Cart & Document;

@Schema({ timestamps: true, collection: 'carts' })
export class Cart {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', unique: true })
  userId: Types.ObjectId;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop({ type: String, default: null })
  couponCode: string | null;

  @Prop({ type: Date, default: null })
  reminderSentAt: Date | null; // For abandoned cart email (only send once)

  @Prop({ default: Date.now })
  lastUpdated: Date;
}
export const CartSchema = SchemaFactory.createForClass(Cart);

// -----------------------------
// COUPON
// -----------------------------
// Discount coupons for orders
export type CouponDocument = Coupon & Document;

@Schema({ timestamps: true, collection: 'coupons' })
export class Coupon {
  @Prop({ required: true, unique: true, uppercase: true })
  code: string; // e.g. "NAVIDAD2024"

  @Prop({ required: true, enum: ['percentage', 'fixed'] })
  type: 'percentage' | 'fixed';

  @Prop({ required: true })
  value: number; // 10 = 10% or ₡10,000

  @Prop({ type: Number, default: null })
  minPurchase: number | null; // Minimum order amount

  @Prop({ type: Number, default: null })
  maxUses: number | null; // Global usage limit

  @Prop({ default: 0 })
  currentUses: number;

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ default: true })
  isActive: boolean;
}
export const CouponSchema = SchemaFactory.createForClass(Coupon);

// -----------------------------
// COLOR
// -----------------------------
// Represents a color with a unique name and hexadecimal value.
export type ColorDocument = Color & Document;
@Schema({ collection: 'colors' })
export class Color {
  @Prop({ required: true, unique: true }) name: string;
  @Prop({ required: true, match: /^#([0-9a-fA-F]{3}){1,2}$/ }) hex: string;
}
export const ColorSchema = SchemaFactory.createForClass(Color);

// -----------------------------
// SIZE
// -----------------------------
// Represents a size with a unique name (e.g., S, M, L).
export type SizeDocument = Size & Document;
@Schema({ collection: 'sizes' })
export class Size {
  @Prop({ required: true, unique: true }) name: string; // e.g. S, M, L
}
export const SizeSchema = SchemaFactory.createForClass(Size);

// -----------------------------
// VARIANT (Product variation: color + size + stock + availability)
// -----------------------------
// Represents a product variation combining color, size, stock, and availability.
export type VariantDocument = Variant & Document;
@Schema({ collection: 'variants' })
export class Variant {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true }) product: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: Color.name, required: true }) color: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: Size.name, required: true }) size: Types.ObjectId;
  @Prop({ default: 0 }) stock: number;
  @Prop({ default: true }) isAvailable: boolean;

  // Variant-specific image (optional - falls back to product images if not set)
  @Prop() imageUrl?: string;

  // Gallery images for this variant/color (first one is the main/primary image)
  @Prop({ type: [String], default: [] }) images?: string[];

  // Canvas templates: flat transparent PNGs used in the 2D editor
  // These are DIFFERENT from product listing photos (which may have models/shadows)
  @Prop() canvasImageFront?: string;
  @Prop() canvasImageBack?: string;

  // Displacement maps: grayscale PNGs for fabric-fold warp effect in the editor
  @Prop() displacementMapFront?: string;
  @Prop() displacementMapBack?: string;

  // Inventory Enhancements
  @Prop({ unique: true, sparse: true }) sku?: string; // Stock Keeping Unit
  @Prop({ default: 0 }) costPrice?: number; // Cost price for profit calculation
  @Prop({ default: 5 }) lowStockThreshold?: number; // Alert threshold
  @Prop() location?: string; // Warehouse location
}
export const VariantSchema = SchemaFactory.createForClass(Variant);
VariantSchema.index({ product: 1, color: 1, size: 1 }, { unique: true });

// -----------------------------
// IMAGE (Design assets and product photos)
// -----------------------------
// Represents an image with metadata such as type, dimensions, and uploader.
export type ImageDocument = Image & Document;
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'images',
})
export class Image {
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) filename: string;
  @Prop({ required: true, enum: ['design', 'product', 'user-design'] }) type: string;
  @Prop({ required: true }) width: number;
  @Prop({ required: true }) height: number;
  @Prop({ type: Types.ObjectId, ref: User.name, required: true }) uploadedBy: Types.ObjectId;
}
export const ImageSchema = SchemaFactory.createForClass(Image);

// -----------------------------
// LIBRARY DESIGN (Managed designs for editor)
// -----------------------------
export type LibraryDesignDocument = LibraryDesign & Document;
@Schema({ timestamps: true, collection: 'library_designs' })
export class LibraryDesign {
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) publicId: string;
  @Prop({ default: 0 }) price: number; // In Colones (CRC)
  @Prop({ default: 'Regular', enum: ['Logo', 'Regular', 'Full'] }) sizeCategory: string;
  @Prop() category?: string;
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ type: [{ type: Types.ObjectId, ref: 'LibraryDesign' }], default: [] })
  relatedDesignIds: Types.ObjectId[];
  @Prop() width?: number;
  @Prop() height?: number;
  @Prop() widthCm?: number;
  @Prop() heightCm?: number;
  @Prop() format?: string;
}
export const LibraryDesignSchema = SchemaFactory.createForClass(LibraryDesign);

// -----------------------------
// PRODUCT (Base and User-generated)
// -----------------------------
// Represents a product with details like name, price, description, and associated images.
export type ProductDocument = Product & Document;
@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true }) name: string;
  @Prop({ required: true, unique: true }) slug: string;
  @Prop() description?: string;
  @Prop({ required: true }) price: number;
  @Prop({ type: [Types.ObjectId], ref: Image.name }) images: Types.ObjectId[];
  @Prop({ type: Types.ObjectId, ref: User.name }) creator?: Types.ObjectId;
  @Prop({
    type: [
      {
        size: { type: Types.ObjectId, ref: 'Size', required: true },
        widthCm: { type: Number, required: true },
        heightCm: { type: Number, required: true },
      },
    ],
    default: [],
  })
  sizeMeasurements: { size: Types.ObjectId; widthCm: number; heightCm: number }[];
  @Prop({ default: false }) isUniqueProduct?: boolean;
}
export const ProductSchema = SchemaFactory.createForClass(Product);

// Virtual populate: get all variants for this product
ProductSchema.virtual('variants', {
  ref: 'Variant',
  localField: '_id',
  foreignField: 'product',
});

// Ensure virtuals are included in JSON output
ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

// -----------------------------
// ORDER_ITEM
// -----------------------------
// Represents an item in an order, including variant, quantity, and unit price.
export type OrderItemDocument = OrderItem & Document;
@Schema({ collection: 'order_items' })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Order', required: true }) orderId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: Variant.name }) variantId?: Types.ObjectId;
  @Prop({ required: true }) quantity: number;
  @Prop({ required: true }) unitPrice: number;
  @Prop({ type: Types.ObjectId, ref: Image.name }) snapshotImageId?: Types.ObjectId;
}
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

// -----------------------------
// ORDER_ITEM_DESIGN
// -----------------------------
// Represents custom designs applied to an order item, including design details and positioning.
export type OrderItemDesignDocument = OrderItemDesign & Document;
@Schema({ collection: 'order_item_designs' })
export class OrderItemDesign {
  @Prop({ type: Types.ObjectId, ref: OrderItem.name, required: true }) orderItemId: Types.ObjectId;
  @Prop([
    {
      designId: { type: Types.ObjectId, ref: 'Design', required: true },
      posXmm: { type: Number, required: true },
      posYmm: { type: Number, required: true },
      widthMm: { type: Number, required: true },
      heightMm: { type: Number, required: true },
      rotationDeg: { type: Number, required: true },
      layer: { type: Number, default: 0 },
    },
  ])
  designs: {
    designId: Types.ObjectId;
    posXmm: number;
    posYmm: number;
    widthMm: number;
    heightMm: number;
    rotationDeg: number;
    layer: number;
  }[];
}
export const OrderItemDesignSchema = SchemaFactory.createForClass(OrderItemDesign);

// -----------------------------
// DESIGN
// -----------------------------
// Represents a design created by a user, associated with an image and status.
export type DesignDocument = Design & Document;
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'designs' })
export class Design {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: Image.name, required: true }) imageId: Types.ObjectId;
  @Prop({ default: 'active', enum: ['active', 'inactive', 'deleted'] }) status: string;
}
export const DesignSchema = SchemaFactory.createForClass(Design);

// -----------------------------
// CATEGORY
// -----------------------------
// Represents a category for organizing products, with support for subcategories and custom ordering.
export type CategoryDocument = Category & Document;
@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, unique: true }) name: string;
  @Prop() description?: string;
  @Prop() slug: string; // URL-friendly version of name
  @Prop({ type: Types.ObjectId, ref: Category.name }) parentCategory?: Types.ObjectId; // for subcategories
  @Prop({ default: true }) isActive: boolean;
  @Prop({ default: 0 }) sortOrder: number; // for custom ordering
  @Prop() icon?: string; // icon name or URL
  @Prop() color?: string; // hex color for UI
}
export const CategorySchema = SchemaFactory.createForClass(Category);

// -----------------------------
// PRODUCT_LISTING (catalog entries referencing variants)
// -----------------------------
// Represents a product listing in the catalog, referencing a variant and additional metadata.
export type ProductListingDocument = ProductListing & Document;
@Schema({ timestamps: true, collection: 'product_listings' })
export class ProductListing {
  @Prop({ type: Types.ObjectId, ref: Variant.name, required: true }) variant: Types.ObjectId;
  @Prop({ default: true }) isActive: boolean;
  @Prop() displayOrder?: number;
  @Prop() featured?: boolean;
  @Prop({ type: Types.ObjectId, ref: Category.name }) category?: Types.ObjectId;
  @Prop() tags?: string[];
  @Prop() salePrice?: number; // for discounted items
  @Prop() isNewArrival?: boolean;
  @Prop() isBestSeller?: boolean;
}
export const ProductListingSchema = SchemaFactory.createForClass(ProductListing);

// -----------------------------
// ORDER
// -----------------------------
// Represents an order placed by a user, with status tracking.
export type OrderDocument = Order & Document;
@Schema({ _id: false })
export class PaymentProof {
  @Prop({ required: false })
  url: string;

  @Prop({ required: false, enum: ['transfer', 'sinpe', 'onvopay', 'paypal', 'other'] })
  method: string;

  @Prop()
  reference?: string;

  @Prop({ default: 'pending', enum: ['pending', 'verified', 'rejected'] })
  status: string;

  @Prop()
  reason?: string;
}
export const PaymentProofSchema = SchemaFactory.createForClass(PaymentProof);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: Types.ObjectId, ref: User.name, required: false }) user?: Types.ObjectId; // Optional for manual sales

  @Prop({
    type: {
      name: { type: String, required: true },
      contact: { type: String },
      email: { type: String },
    },
    _id: false,
  })
  guestInfo?: { name: string; contact?: string; email?: string };

  @Prop({
    type: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipRegion: { type: String }, // Zip or Region/Canton
      country: { type: String },
      phone: { type: String },
    },
    _id: false,
  })
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipRegion: string;
    country: string;
    phone: string;
  };

  @Prop() trackingNumber?: string;
  @Prop() shippingProvider?: string;

  @Prop({ default: 'online', enum: ['online', 'manual_sale'] })
  orderType: string;

  @Prop({ type: PaymentProofSchema })
  paymentProof?: PaymentProof;

  @Prop({
    default: 'esperando_pago',
    enum: [
      'esperando_pago',
      'pagada',
      'en_produccion',
      'enviada',
      'completada',
      'cancelada',
      'archivada',
    ],
  })
  status: string;
}
export const OrderSchema = SchemaFactory.createForClass(Order);

// -----------------------------
// STOCK_LOG
// -----------------------------
// Represents a log entry for stock changes, including reason and user responsible.
export type StockLogDocument = StockLog & Document;
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'stock_logs' })
export class StockLog {
  @Prop({ type: Types.ObjectId, ref: Variant.name, required: true }) variantId: Types.ObjectId;
  @Prop({ required: true }) change: number; // positive for additions, negative for subtractions
  @Prop({
    required: true,
    enum: ['purchase', 'sale', 'adjustment', 'return', 'damaged'],
  })
  reason: string;
  @Prop({ type: Types.ObjectId, ref: User.name, required: true }) userId: Types.ObjectId;
}
export const StockLogSchema = SchemaFactory.createForClass(StockLog);

// -----------------------------
// QUOTE
// -----------------------------
// Represents a custom design quote request from a client.
export type QuoteDocument = Quote & Document;
@Schema({ timestamps: true, collection: 'quotes' })
export class Quote {
  @Prop({ type: Types.ObjectId, ref: User.name, required: false })
  user?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Variant.name, required: true })
  variantId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  designState: string;

  @Prop({ type: [String], default: [] })
  designImageUrls: string[];

  @Prop()
  guestName?: string;

  @Prop()
  guestEmail?: string;

  @Prop()
  guestPhone?: string;

  @Prop()
  guestTelegram?: string;

  @Prop()
  preferredContactMethod?: string; // 'email', 'phone', 'telegram'

  @Prop()
  estimatedPrice?: number; // In Colones (CRC)

  @Prop()
  garmentId?: string;

  @Prop()
  shirtColor?: string;

  @Prop({ type: Number, default: null })
  quotedPrice?: number;

  @Prop()
  priceNotes?: string;

  @Prop()
  clientNotes?: string;

  @Prop()
  rejectionReason?: string;

  @Prop({
    default: 'pending',
    enum: ['pending', 'sent', 'accepted', 'rejected', 'converted', 'expired'],
  })
  status: string;

  @Prop({ type: Date, default: null }) sentAt?: Date;
  @Prop({ type: Date, default: null }) respondedAt?: Date;
  @Prop({ type: Date, default: null }) expiresAt?: Date;
  @Prop({ type: Types.ObjectId, ref: Order.name, default: null })
  convertedToOrderId?: Types.ObjectId;

  @Prop({ unique: true, sparse: true })
  referenceId?: string;
}
export const QuoteSchema = SchemaFactory.createForClass(Quote);
