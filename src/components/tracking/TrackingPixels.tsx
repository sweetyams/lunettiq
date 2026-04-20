'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * Tracking pixels — loads config dynamically from /api/account/pixels.
 * 
 * Keys come from DB (staff-configured via CRM) with env var fallback.
 * No rebuild needed when staff adds/removes pixels.
 * 
 * Performance:
 * - Single fetch on mount (CDN-cached 60s server-side)
 * - Cookieless pixels load immediately
 * - Consent-gated pixels wait for localStorage consent
 */

interface PixelConfig {
  NEXT_PUBLIC_POLAR_SITE_ID?: string;
  NEXT_PUBLIC_POSTHOG_KEY?: string;
  NEXT_PUBLIC_POSTHOG_HOST?: string;
  NEXT_PUBLIC_META_PIXEL_ID?: string;
  NEXT_PUBLIC_TIKTOK_PIXEL_ID?: string;
  NEXT_PUBLIC_GA4_ID?: string;
  NEXT_PUBLIC_PINTEREST_TAG_ID?: string;
  NEXT_PUBLIC_SNAPCHAT_PIXEL_ID?: string;
}

export default function TrackingPixels() {
  const [config, setConfig] = useState<PixelConfig | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    setConsent(localStorage.getItem('lunettiq_tracking_consent') === 'granted');
    fetch('/api/account/pixels')
      .then(r => r.json())
      .then(d => setConfig(d.data ?? {}))
      .catch(() => {});
  }, []);

  if (!config) return null;

  const { NEXT_PUBLIC_POLAR_SITE_ID, NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST, NEXT_PUBLIC_META_PIXEL_ID, NEXT_PUBLIC_TIKTOK_PIXEL_ID, NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_PINTEREST_TAG_ID, NEXT_PUBLIC_SNAPCHAT_PIXEL_ID } = config;
  const posthogHost = NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  return (
    <>
      {/* ─── No consent needed (cookieless) ─── */}

      {NEXT_PUBLIC_POLAR_SITE_ID && (
        <Script
          src="https://cdn.polaranalytics.com/tracking.js"
          data-site-id={NEXT_PUBLIC_POLAR_SITE_ID}
          strategy="lazyOnload"
        />
      )}

      {NEXT_PUBLIC_POSTHOG_KEY && (
        <Script id="posthog-init" strategy="lazyOnload">{`
          !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onFeatureFlags".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
          posthog.init('${NEXT_PUBLIC_POSTHOG_KEY}',{api_host:'${posthogHost}',autocapture:false,capture_pageview:true,persistence:'memory'});
        `}</Script>
      )}

      {/* ─── Consent required ─── */}

      {consent && NEXT_PUBLIC_META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="lazyOnload">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${NEXT_PUBLIC_META_PIXEL_ID}');fbq('track','PageView');
        `}</Script>
      )}

      {consent && NEXT_PUBLIC_TIKTOK_PIXEL_ID && (
        <Script id="tiktok-pixel" strategy="lazyOnload">{`
          !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${NEXT_PUBLIC_TIKTOK_PIXEL_ID}');ttq.page();}(window,document,'ttq');
        `}</Script>
      )}

      {consent && NEXT_PUBLIC_GA4_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${NEXT_PUBLIC_GA4_ID}`} strategy="lazyOnload" />
          <Script id="ga4-init" strategy="lazyOnload">{`
            window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${NEXT_PUBLIC_GA4_ID}',{send_page_view:true});
          `}</Script>
        </>
      )}

      {consent && NEXT_PUBLIC_PINTEREST_TAG_ID && (
        <Script id="pinterest-tag" strategy="lazyOnload">{`
          !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','${NEXT_PUBLIC_PINTEREST_TAG_ID}');pintrk('page');
        `}</Script>
      )}

      {consent && NEXT_PUBLIC_SNAPCHAT_PIXEL_ID && (
        <Script id="snapchat-pixel" strategy="lazyOnload">{`
          (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${NEXT_PUBLIC_SNAPCHAT_PIXEL_ID}',{});snaptr('track','PAGE_VIEW');
        `}</Script>
      )}
    </>
  );
}
