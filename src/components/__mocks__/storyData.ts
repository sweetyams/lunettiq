import type { Product as BaseProduct, ProductVariant, Image as ShopifyImage } from '@/types/shopify';

type Product = BaseProduct & { tags?: string[] };
export type { Product };
import type { EditorialPanel, HomepageHero, CategoryPanel, LensOption, EyeTestCTA } from '@/types/metaobjects';

const IMG = 'https://placehold.co/800x1000/F5F5F9/333?text=Lunettiq';
const IMG2 = 'https://placehold.co/800x1000/E8E8EC/333?text=Alt+View';
const FACE_IMG = 'https://placehold.co/400x400/F5F5F9/333?text=On+Face';

export const mockImage: ShopifyImage = { url: IMG, altText: 'Lunettiq frame' };
export const mockImage2: ShopifyImage = { url: IMG2, altText: 'Alternate view' };

export const mockVariant: ProductVariant = {
  id: 'gid://shopify/ProductVariant/1001',
  title: 'Noir / Medium',
  price: { amount: '295.00', currencyCode: 'CAD' },
  availableForSale: true,
  selectedOptions: [
    { name: 'Colour', value: 'Noir' },
    { name: 'Size', value: 'Medium' },
  ],
  image: mockImage,
};

export const mockVariantTortoise: ProductVariant = {
  id: 'gid://shopify/ProductVariant/1002',
  title: 'Tortoise / Medium',
  price: { amount: '295.00', currencyCode: 'CAD' },
  availableForSale: true,
  selectedOptions: [
    { name: 'Colour', value: 'Tortoise' },
    { name: 'Size', value: 'Medium' },
  ],
  image: { url: IMG2, altText: 'Tortoise frame' },
};

export const mockProduct: Product = {
  id: 'gid://shopify/Product/1',
  title: 'Plateau Round',
  handle: 'plateau-round',
  description: 'Hand-polished Italian acetate with spring hinges.',
  descriptionHtml: '<p>Hand-polished Italian acetate with spring hinges.</p>',
  priceRange: {
    minVariantPrice: { amount: '295.00', currencyCode: 'CAD' },
    maxVariantPrice: { amount: '295.00', currencyCode: 'CAD' },
  },
  options: [{ name: 'Colour', values: ['Noir', 'Tortoise'] }],
  variants: [mockVariant, mockVariantTortoise],
  images: [mockImage, mockImage2],
  tags: ['shape:round', 'colour:black', 'material:acetate', 'size:medium'],
  metafields: {
    material: 'Italian Acetate',
    origin: 'Handmade in Japan',
    rxCompatible: true,
    bridgeWidth: 20,
    lensWidth: 48,
    templeLength: 145,
    frameWidth: 138,
    lensHeight: 42,
    onFaceImages: [FACE_IMG, FACE_IMG],
    faceNotes: 'Suits oval and round face shapes.',
    tryOnImage: IMG,
  },
};

export const mockProduct2: Product = {
  ...mockProduct,
  id: 'gid://shopify/Product/2',
  title: 'Dix30 Aviator',
  handle: 'dix30-aviator',
  options: [{ name: 'Colour', values: ['Gold', 'Silver'] }],
};

export const mockProduct3: Product = {
  ...mockProduct,
  id: 'gid://shopify/Product/3',
  title: 'Signature Cat-Eye',
  handle: 'signature-cat-eye',
  options: [{ name: 'Colour', values: ['Rose', 'Noir'] }],
};

export const mockProducts: Product[] = [mockProduct, mockProduct2, mockProduct3];

export const mockHero: HomepageHero = {
  headline: 'New Season',
  imageLeft: IMG,
  imageRight: IMG2,
  ctaText: 'Shop Now',
  ctaLink: '/collections/optics',
  active: true,
};

export const mockCategoryPanel: CategoryPanel = {
  title: 'Optical',
  image: IMG,
  collectionHandle: 'optics',
  sortOrder: 0,
};

export const mockEditorialPanel: EditorialPanel = {
  title: 'The Art of Seeing',
  body: 'Crafted with intention, worn with confidence.',
  image: IMG,
  linkUrl: '/pages/about',
  placement: 'homepage',
};

export const mockLensOptions: LensOption[] = [
  { type: 'lensIndex', name: 'Standard 1.50', description: 'Included — suitable for mild prescriptions.', price: 0, sortOrder: 0, compatibleLensTypes: [], active: true },
  { type: 'lensIndex', name: 'Thin 1.61', description: 'Thinner and lighter.', price: 50, sortOrder: 1, compatibleLensTypes: [], active: true },
  { type: 'lensIndex', name: 'Ultra-Thin 1.67', description: 'For prescriptions above ±4.00.', price: 100, sortOrder: 2, compatibleLensTypes: [], active: true },
  { type: 'coating', name: 'Anti-Reflective', description: 'Reduces glare.', price: 25, sortOrder: 0, compatibleLensTypes: [], active: true },
  { type: 'coating', name: 'Blue Light Filter', description: 'Filters blue light.', price: 35, sortOrder: 1, compatibleLensTypes: [], active: true },
];

export const mockEyeTestCTA: EyeTestCTA = {
  heading: 'Book an Eye Exam',
  body: 'Our in-house optometrists are ready to help you see clearly.',
  ctaText: 'Book Now',
  ctaLink: '/pages/eye-test',
  image: IMG,
};

export const noop = () => {};
