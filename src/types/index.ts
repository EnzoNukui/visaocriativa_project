export type UserRole = 'admin' | 'supplier';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ProductVariant {
  size: string;
  price: number; // school price
  supplierPrice: number;
}

export interface Product {
  id: string;
  name: string;
  variants: ProductVariant[];
}

export interface OrderItem {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number; // school price
  supplierPrice: number;
  total: number;
  supplierTotal: number;
}

export type OrderStatus = 'awaiting_payment' | 'paid' | 'in_production' | 'ready' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string;
  studentName: string;
  grade: string;
  responsibleName: string;
  phone: string;
  items: OrderItem[];
  totalAmount: number;
  supplierTotalAmount: number;
  status: OrderStatus;
  createdAt: string;
  createdBy: string;
  supplierId: string | null;
  repasseCompleted: boolean;
  repasseDate: string | null;
  repasseAmount: number;
  repasseConfirmedBy: string | null;
}
