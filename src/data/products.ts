import { Product } from '@/types';

export const defaultProducts: Product[] = [
  {
    id: '1',
    name: 'Bermuda Masculina',
    variants: [
      { size: '4', price: 56 },
      { size: '8', price: 58 },
      { size: '10', price: 60 },
      { size: '14', price: 62 },
      { size: '16', price: 64 },
      { size: 'P', price: 67 },
    ],
  },
  {
    id: '2',
    name: 'Baby Look',
    variants: [
      { size: '4', price: 40 },
      { size: '8', price: 42 },
      { size: '10', price: 43 },
      { size: '14', price: 45 },
      { size: '16', price: 45 },
      { size: 'P', price: 48 },
    ],
  },
  {
    id: '3',
    name: 'Bermuda Dry Fit',
    variants: [
      { size: '4', price: 55 },
      { size: '8', price: 58 },
      { size: '10', price: 60 },
      { size: '14', price: 62 },
      { size: '16', price: 64 },
      { size: 'P', price: 67 },
    ],
  },
  {
    id: '4',
    name: 'Blusa College',
    variants: [
      { size: '4', price: 120 },
      { size: '8', price: 125 },
      { size: '10', price: 140 },
      { size: '14', price: 140 },
      { size: '16', price: 145 },
      { size: 'P', price: 150 },
    ],
  },
  {
    id: '5',
    name: 'Blusa Moletom',
    variants: [
      { size: '4', price: 110 },
      { size: '8', price: 115 },
      { size: '10', price: 125 },
      { size: '14', price: 130 },
      { size: '16', price: 135 },
      { size: 'P', price: 140 },
    ],
  },
  {
    id: '6',
    name: 'Calça Bailarina',
    variants: [
      { size: '4', price: 60 },
      { size: '8', price: 65 },
      { size: '10', price: 68 },
      { size: '14', price: 70 },
      { size: '16', price: 75 },
      { size: 'P', price: 78 },
    ],
  },
  {
    id: '7',
    name: 'Calça Moletom',
    variants: [
      { size: '4', price: 65 },
      { size: '8', price: 75 },
      { size: '10', price: 80 },
      { size: '14', price: 85 },
      { size: '16', price: 90 },
      { size: 'P', price: 95 },
    ],
  },
  {
    id: '8',
    name: 'Camiseta Dry Fit',
    variants: [
      { size: '4', price: 42 },
      { size: '8', price: 45 },
      { size: '10', price: 48 },
      { size: '14', price: 48 },
      { size: '16', price: 50 },
      { size: 'P', price: 53 },
    ],
  },
  {
    id: '9',
    name: 'Camiseta Manga Longa',
    variants: [
      { size: '4', price: 45 },
      { size: '8', price: 47 },
      { size: '10', price: 48 },
      { size: '14', price: 50 },
      { size: '16', price: 52 },
      { size: 'P', price: 55 },
    ],
  },
  {
    id: '10',
    name: 'Saia Shorts',
    variants: [
      { size: '4', price: 52 },
      { size: '8', price: 55 },
      { size: '10', price: 58 },
      { size: '14', price: 62 },
      { size: '16', price: 65 },
      { size: 'P', price: 68 },
    ],
  },
  {
    id: '11',
    name: 'Camiseta',
    variants: [
      { size: '4', price: 40 },
      { size: '8', price: 42 },
      { size: '10', price: 45 },
      { size: '14', price: 48 },
      { size: '16', price: 50 },
      { size: 'P', price: 54 },
    ],
  },
];

export function getProducts(): Product[] {
  const stored = localStorage.getItem('vc_products');
  if (stored) return JSON.parse(stored);
  localStorage.setItem('vc_products', JSON.stringify(defaultProducts));
  return defaultProducts;
}

export function saveProducts(products: Product[]) {
  localStorage.setItem('vc_products', JSON.stringify(products));
}
