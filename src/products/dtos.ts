export class CreateProductDto {
  name: string;
  description?: string;
  price: number;
  images?: string[];
}

export class EditProductDto {
  name?: string;
  description?: string;
  price?: number;
  images?: string[];
}

export class CreateVariantDto {
  productId: string;
  color: string;
  size: string;
  stock: number;
  isAvailable?: boolean;
}

export class EditVariantDto {
  color?: string;
  size?: string;
  stock?: number;
  isAvailable?: boolean;
}

export class CreateListingDto {
  variant: string;
  isActive?: boolean;
  displayOrder?: number;
  featured?: boolean;
  category?: string;
  tags?: string[];
  salePrice?: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
}

export class EditListingDto {
  isActive?: boolean;
  displayOrder?: number;
  featured?: boolean;
  category?: string;
  tags?: string[];
  salePrice?: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
}
