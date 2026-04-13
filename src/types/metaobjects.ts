// Shopify Metaobject CMS content types

export interface AnnouncementBar {
  message: string;
  linkText?: string;
  linkUrl?: string;
  active: boolean;
}

export interface HomepageHero {
  headline: string;
  imageLeft: string;   // file reference URL
  imageRight: string;  // file reference URL
  ctaText: string;
  ctaLink: string;
  active: boolean;
}

export interface EditorialPanel {
  title: string;
  body: string;
  image: string;       // file reference URL
  linkUrl?: string;
  placement: 'homepage' | 'plp' | 'both';
}

export interface CategoryPanel {
  title: string;
  image: string;       // file reference URL
  collectionHandle: string;
  sortOrder: number;
}

export interface StoreLocation {
  name: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  hours: Record<string, string>; // day → hours string
  mapUrl: string;
  active: boolean;
}

export interface EyeTestCTA {
  heading: string;
  body: string;
  ctaText: string;
  ctaLink: string;
  image?: string;      // file reference URL (optional)
}

export interface LensOption {
  type: 'lensIndex' | 'coating' | 'tint' | 'mirror';
  name: string;
  description: string;
  price: number;
  sortOrder: number;
  compatibleLensTypes: string[];
  active: boolean;
}
