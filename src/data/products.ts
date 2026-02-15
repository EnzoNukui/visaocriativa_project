import { Product } from '@/types';

export const defaultProducts: Product[] = [
  {
    id: '1',
    name: 'Bermuda Masculina',
    variants: [
      { size: '4', price: 112, supplierPrice: 76 },
      { size: '8', price: 116, supplierPrice: 84 },
      { size: '10', price: 60, supplierPrice: 48 },
      { size: '14', price: 62, supplierPrice: 50 },
      { size: '16', price: 64, supplierPrice: 51 },
      { size: 'P', price: 67, supplierPrice: 56 },
    ],
  },
  {
    id: '2',
    name: 'Baby Look',
    variants: [
      { size: '4', price: 40, supplierPrice: 32 },
      { size: '8', price: 42, supplierPrice: 34 },
      { size: '10', price: 43, supplierPrice: 35 },
      { size: '14', price: 90, supplierPrice: 76 },
      { size: '16', price: 135, supplierPrice: 114 },
      { size: 'P', price: 48, supplierPrice: 39 },
    ],
  },
  {
    id: '3',
    name: 'Bermuda Dry Fit',
    variants: [
      { size: '4', price: 55, supplierPrice: 44 },
      { size: '8', price: 58, supplierPrice: 46 },
      { size: '10', price: 60, supplierPrice: 48 },
      { size: '14', price: 62, supplierPrice: 50 },
      { size: '16', price: 64, supplierPrice: 51 },
      { size: 'P', price: 67, supplierPrice: 54 },
    ],
  },
  {
    id: '4',
    name: 'Blusa College',
    variants: [
      { size: '4', price: 120, supplierPrice: 104 },
      { size: '8', price: 125, supplierPrice: 109 },
      { size: '10', price: 140, supplierPrice: 122 },
      { size: '14', price: 140, supplierPrice: 122 },
      { size: '16', price: 145, supplierPrice: 126 },
      { size: 'P', price: 150, supplierPrice: 130 },
    ],
  },
  {
    id: '5',
    name: 'Blusa Moletom',
    variants: [
      { size: '4', price: 110, supplierPrice: 96 },
      { size: '8', price: 115, supplierPrice: 100 },
      { size: '10', price: 125, supplierPrice: 109 },
      { size: '14', price: 130, supplierPrice: 120 },
      { size: '16', price: 135, supplierPrice: 117 },
      { size: 'P', price: 140, supplierPrice: 122 },
    ],
  },
  {
    id: '6',
    name: 'Calça Bailarina',
    variants: [
      { size: '4', price: 60, supplierPrice: 48 },
      { size: '8', price: 65, supplierPrice: 52 },
      { size: '10', price: 68, supplierPrice: 55 },
      { size: '14', price: 70, supplierPrice: 60 },
      { size: '16', price: 75, supplierPrice: 63 },
      { size: 'P', price: 78, supplierPrice: 67 },
    ],
  },
  {
    id: '7',
    name: 'Calça Moletom',
    variants: [
      { size: '4', price: 65, supplierPrice: 50 },
      { size: '8', price: 75, supplierPrice: 57 },
      { size: '10', price: 80, supplierPrice: 62 },
      { size: '14', price: 85, supplierPrice: 66 },
      { size: '16', price: 90, supplierPrice: 72 },
      { size: 'P', price: 95, supplierPrice: 80 },
    ],
  },
  {
    id: '8',
    name: 'Camiseta Dry Fit',
    variants: [
      { size: '4', price: 42, supplierPrice: 34 },
      { size: '8', price: 45, supplierPrice: 36 },
      { size: '10', price: 48, supplierPrice: 38 },
      { size: '14', price: 48, supplierPrice: 38 },
      { size: '16', price: 50, supplierPrice: 42 },
      { size: 'P', price: 53, supplierPrice: 43 },
    ],
  },
  {
    id: '9',
    name: 'Camiseta Manga Longa',
    variants: [
      { size: '4', price: 45, supplierPrice: 36 },
      { size: '8', price: 47, supplierPrice: 39 },
      { size: '10', price: 48, supplierPrice: 39 },
      { size: '14', price: 50, supplierPrice: 41 },
      { size: '16', price: 52, supplierPrice: 43 },
      { size: 'P', price: 55, supplierPrice: 45 },
    ],
  },
  {
    id: '10',
    name: 'Saia Shorts',
    variants: [
      { size: '4', price: 52, supplierPrice: 42 },
      { size: '8', price: 55, supplierPrice: 44 },
      { size: '10', price: 58, supplierPrice: 47 },
      { size: '14', price: 62, supplierPrice: 52 },
      { size: '16', price: 65, supplierPrice: 54 },
      { size: 'P', price: 68, supplierPrice: 56 },
    ],
  },
  {
    id: '11',
    name: 'Camiseta',
    variants: [
      { size: '4', price: 80, supplierPrice: 62 },
      { size: '8', price: 168, supplierPrice: 132 },
      { size: '10', price: 90, supplierPrice: 74 },
      { size: '14', price: 48, supplierPrice: 38 },
      { size: '16', price: 100, supplierPrice: 84 },
      { size: 'P', price: 216, supplierPrice: 188 },
    ],
  },
];

export function getProducts(): Product[] {
  const stored = localStorage.getItem('vc_products');
  if (stored) {
    const products = JSON.parse(stored);
    // Migrate old data without supplierPrice
    const migrated = products.map((p: any) => ({
      ...p,
      variants: p.variants.map((v: any) => ({
        ...v,
        supplierPrice: v.supplierPrice ?? Math.round(v.price * 0.8),
      })),
    }));
    return migrated;
  }
  localStorage.setItem('vc_products', JSON.stringify(defaultProducts));
  return defaultProducts;
}

export function saveProducts(products: Product[]) {
  localStorage.setItem('vc_products', JSON.stringify(products));
}
