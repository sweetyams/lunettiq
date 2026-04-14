'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Product } from '@/types/shopify';
import type { EyeTestCTA, LensOption } from '@/types/metaobjects';
import type { LensConfiguration, ConfiguratorStep } from '@/types/configurator';
import { requiresPrescription, isReaders } from '@/components/pdp/LensConfigurator';
import ImageGallery from '@/components/pdp/ImageGallery';
import ProductInfoPanel from '@/components/pdp/ProductInfoPanel';
import ColourSelector from '@/components/pdp/ColourSelector';
import AccordionSection from '@/components/pdp/AccordionSection';
import AddToCartButton from '@/components/pdp/AddToCartButton';
import LazyLoad from '@/components/shared/LazyLoad';

const LensConfigurator = dynamic(() => import('@/components/pdp/LensConfigurator'), {
  loading: () => <div className="h-48 skeleton-shimmer rounded" />,
});

const Recommendations = dynamic(() => import('@/components/pdp/Recommendations'), { ssr: false });
const OnFacesSection = dynamic(() => import('@/components/pdp/OnFacesSection'), { ssr: false });
const EyeTestCTABlock = dynamic(() => import('@/components/pdp/EyeTestCTA'), { ssr: false });

interface ProductClientProps {
  product: Product;
  lensOptions: LensOption[];
}

export function BelowFoldPDP({
  recommendations,
  eyeTestCTAs,
}: {
  recommendations: Product[];
  eyeTestCTAs: EyeTestCTA[];
}) {
  const eyeTestCTA = eyeTestCTAs[0] ?? null;
  return (
    <div className="px-4 md:px-8">
      {recommendations.length > 0 && (
        <LazyLoad>
          <div className="py-12">
            <Recommendations products={recommendations} />
          </div>
        </LazyLoad>
      )}
      {eyeTestCTA && (
        <LazyLoad>
          <div className="py-12">
            <EyeTestCTABlock cta={eyeTestCTA} />
          </div>
        </LazyLoad>
      )}
    </div>
  );
}

export default function ProductClient({ product, lensOptions }: ProductClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const colourOption = product.options.find(
    (opt) => opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour'
  );
  const colours = colourOption?.values ?? [];
  const initialColour = searchParams.get('color') ?? colours[0] ?? null;
  const [selectedColour, setSelectedColour] = useState<string | null>(initialColour);

  const isSunglasses = useMemo(
    () => product.collections?.some((c) => c.handle.toLowerCase().includes('sun')) ?? false,
    [product.collections]
  );

  const selectedVariant = useMemo(() => {
    if (!selectedColour) return product.variants[0] ?? null;
    return (
      product.variants.find((v) =>
        v.selectedOptions.some(
          (opt) =>
            (opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour') &&
            opt.value.toLowerCase() === selectedColour.toLowerCase()
        )
      ) ?? product.variants[0] ?? null
    );
  }, [selectedColour, product.variants]);

  const handleColourChange = useCallback(
    (colour: string) => {
      setSelectedColour(colour);
      const params = new URLSearchParams(searchParams.toString());
      params.set('color', colour);
      router.replace(`/products/${product.handle}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, product.handle]
  );

  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const toggleAccordion = useCallback((id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  }, []);

  const [lensConfig, setLensConfig] = useState<LensConfiguration>({
    lensType: null,
    lensIndex: null,
    coatings: [],
    sunOptions: null,
    prescription: null,
    prescriptionMethod: null,
  });
  const [configStep, setConfigStep] = useState<ConfiguratorStep>('lensType');

  const handleConfigChange = useCallback((config: LensConfiguration, step: ConfiguratorStep) => {
    setLensConfig(config);
    setConfigStep(step);
  }, []);

  const isConfigComplete = useMemo(() => {
    if (configStep !== 'summary') return false;
    if (!lensConfig.lensType || !lensConfig.lensIndex) return false;
    if (requiresPrescription(lensConfig.lensType) && !lensConfig.prescriptionMethod) return false;
    if (isReaders(lensConfig.lensType) && !lensConfig.prescriptionMethod) return false;
    return true;
  }, [lensConfig, configStep]);

  const isOutOfStock = selectedVariant ? !selectedVariant.availableForSale : true;
  const collection = product.collections?.[0];

  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 px-4 md:px-8 py-4 md:py-8">
          <ImageGallery
            images={product.images}
            variants={product.variants}
            selectedColour={selectedColour}
            productTitle={product.title}
            productHandle={product.handle}
            tryOnImageUrl={product.metafields.tryOnImage || product.images[0]?.url}
          />
        </div>

        <div className="w-full md:w-1/2 px-4 md:px-8 py-4 md:py-8">
          <div className="md:sticky md:top-8">
            {collection && (
              <nav aria-label="Breadcrumb" className="mb-4">
                <ol className="flex items-center gap-2 text-xs text-gray-500">
                  <li><a href="/" className="hover:text-black transition-colors">Home</a></li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <a href={`/collections/${collection.handle}`} className="hover:text-black transition-colors">
                      {collection.title}
                    </a>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li className="text-black">{product.title}</li>
                </ol>
              </nav>
            )}

            <ProductInfoPanel product={product} selectedVariant={selectedVariant} />

            {colours.length > 0 && (
              <div className="mt-6">
                <ColourSelector
                  colours={colours}
                  variants={product.variants}
                  selectedColour={selectedColour}
                  onColourChange={handleColourChange}
                />
              </div>
            )}

            <div className="mt-6">
              <LensConfigurator
                lensOptions={lensOptions}
                isSunglasses={isSunglasses}
                frameBasePrice={parseFloat(selectedVariant?.price.amount ?? '0')}
                frameName={product.title}
                frameColour={selectedColour}
                onConfigChange={handleConfigChange}
              />
            </div>

            <div className="mt-4">
              <AddToCartButton
                variantId={selectedVariant?.id ?? null}
                isConfigComplete={isConfigComplete}
                isOutOfStock={isOutOfStock}
                lensConfiguration={lensConfig}
                lensOptions={lensOptions}
                frameBasePrice={parseFloat(selectedVariant?.price.amount ?? '0')}
              />
            </div>

            <div className="mt-8 border-t border-gray-200">
              <AccordionSection id="details" title="Details" isOpen={openAccordion === 'details'} onToggle={toggleAccordion}>
                <div className="space-y-2 text-sm text-gray-600">
                  {product.metafields.material && <p><span className="text-black">Material:</span> {product.metafields.material}</p>}
                  {product.metafields.origin && <p><span className="text-black">Origin:</span> {product.metafields.origin}</p>}
                  {!product.metafields.material && !product.metafields.origin && <p>No additional details available.</p>}
                </div>
              </AccordionSection>

              <AccordionSection id="dimensions" title="Dimensions" isOpen={openAccordion === 'dimensions'} onToggle={toggleAccordion}>
                <div className="space-y-2 text-sm text-gray-600">
                  {product.metafields.bridgeWidth != null && <p><span className="text-black">Bridge:</span> {product.metafields.bridgeWidth} mm</p>}
                  {product.metafields.lensWidth != null && <p><span className="text-black">Lens Width:</span> {product.metafields.lensWidth} mm</p>}
                  {product.metafields.templeLength != null && <p><span className="text-black">Temple:</span> {product.metafields.templeLength} mm</p>}
                  {product.metafields.bridgeWidth == null && product.metafields.lensWidth == null && product.metafields.templeLength == null && <p>No dimension data available.</p>}
                </div>
              </AccordionSection>

              <AccordionSection id="care" title="Care" isOpen={openAccordion === 'care'} onToggle={toggleAccordion}>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Clean lenses with the included microfibre cloth and lens spray.</p>
                  <p>Store in the provided hard case when not in use.</p>
                  <p>Avoid placing lenses face-down on hard surfaces.</p>
                </div>
              </AccordionSection>

              <AccordionSection id="shipping" title="Shipping" isOpen={openAccordion === 'shipping'} onToggle={toggleAccordion}>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Free standard shipping on all orders within Canada.</p>
                  <p>Express shipping available at checkout.</p>
                  <p>International shipping rates calculated at checkout.</p>
                </div>
              </AccordionSection>
            </div>
          </div>
        </div>
      </div>

      {/* OnFaces — still inline since it uses product metafields directly */}
      <div className="px-4 md:px-8">
        <LazyLoad>
          <OnFacesSection
            onFaceImages={product.metafields.onFaceImages}
            faceNotes={product.metafields.faceNotes}
          />
        </LazyLoad>
      </div>
    </div>
  );
}
