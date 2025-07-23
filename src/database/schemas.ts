import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Schemas for Zayrel Studio based on Mermaid ER model
 */

// -----------------------------
// USER
// -----------------------------
// Represents a user in the system with personal details, authentication information, and roles.
export type UserDocument = User & Document;
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
}
export const UserSchema = SchemaFactory.createForClass(User);

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
}
export const VariantSchema = SchemaFactory.createForClass(Variant);

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
// PRODUCT (Base and User-generated)
// -----------------------------
// Represents a product with details like name, price, description, and associated images.
export type ProductDocument = Product & Document;
@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true }) name: string;
  @Prop() description?: string;
  @Prop({ required: true }) price: number;
  @Prop({ type: [Types.ObjectId], ref: Image.name }) images: Types.ObjectId[];
  @Prop({ type: Types.ObjectId, ref: User.name }) creator?: Types.ObjectId;
}
export const ProductSchema = SchemaFactory.createForClass(Product);

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
@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true }) user: Types.ObjectId;
  @Prop({ default: 'pending', enum: ['pending', 'paid', 'shipped', 'completed', 'cancelled'] })
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
