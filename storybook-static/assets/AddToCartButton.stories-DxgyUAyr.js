import{n as e,s as t}from"./chunk-CzyJ72yW.js";import{t as n}from"./react-CUIZZadK.js";import{_ as r}from"./iframe-BOb_YaGJ.js";import{n as i,r as a,t as o}from"./es-BAsWxe7d.js";import{a as s,i as c,n as l,o as u,r as d,t as f}from"./CartDrawerContext-BNsA6ItS.js";import{o as p,t as m}from"./storyData-JooGbszH.js";import{a as h,i as g,n as _,o as v,r as y,s as b}from"./RunningPriceTotal-D9n8YRlS.js";function x(e,t,n){let r=[];r.push({key:`_lensType`,value:e.lensType??``}),r.push({key:`_lensIndex`,value:e.lensIndex??``}),r.push({key:`_coatings`,value:e.coatings.join(`,`)}),r.push({key:`_sunTint`,value:e.sunOptions?.tintColour??``}),r.push({key:`_polarized`,value:e.sunOptions?.polarized?`true`:`false`}),r.push({key:`_mirrorCoating`,value:e.sunOptions?.mirrorCoating??``});let i=e.prescriptionMethod??`none`;r.push({key:`_rxStatus`,value:i}),r.push({key:`_rxData`,value:e.prescription?JSON.stringify(e.prescription):``});let a=g(e.lensIndex,t),o=0;for(let n of e.coatings)o+=y(n,t);e.sunOptions?.polarized&&(o+=v(t)),o+=h(e.sunOptions?.mirrorCoating??null,t);let s=_(e,t,n);return r.push({key:`_lensUpgradePrice`,value:a.toFixed(2)}),r.push({key:`_coatingsPrice`,value:o.toFixed(2)}),r.push({key:`_totalConfigPrice`,value:s.toFixed(2)}),r}var S=e((()=>{b()}));function C({variantId:e,isConfigComplete:t,isOutOfStock:n,lensConfiguration:r,lensOptions:o,frameBasePrice:s}){let{addToCart:c}=u(),{openCart:l}=d(),[f,p]=(0,T.useState)(!1),[m,h]=(0,T.useState)(!1),[g,_]=(0,T.useState)(null),v=!t||n||!e||f,y=`Add to Cart`;return n?y=`Sold Out`:t?f&&(y=`Adding…`):y=`Complete configuration to add to cart`,(0,w.jsxs)(`div`,{children:[(0,w.jsx)(`button`,{type:`button`,disabled:v,onClick:(0,T.useCallback)(async()=>{if(!(v||!e)){_(null),p(!0);try{await c(e,1,x(r,o,s)),h(!0),setTimeout(()=>{h(!1),l()},800)}catch(e){_(e instanceof Error?e.message:`Could not add to cart. Please try again.`)}finally{p(!1)}}},[v,e,r,o,s,c,l]),className:`
          relative w-full py-3 text-sm font-medium transition-colors overflow-hidden
          ${v?`bg-gray-200 text-gray-500 cursor-not-allowed`:m?`bg-green-600 text-white`:`bg-black text-white hover:bg-gray-800 cursor-pointer`}
        `,"aria-disabled":v,children:(0,w.jsx)(a,{mode:`wait`,children:m?(0,w.jsxs)(i.span,{initial:{scale:0},animate:{scale:1},exit:{scale:0},className:`flex items-center justify-center gap-2`,children:[(0,w.jsx)(`svg`,{width:`18`,height:`18`,viewBox:`0 0 24 24`,fill:`none`,stroke:`currentColor`,strokeWidth:`2.5`,strokeLinecap:`round`,strokeLinejoin:`round`,children:(0,w.jsx)(`polyline`,{points:`20 6 9 17 4 12`})}),`Added`]},`check`):(0,w.jsx)(i.span,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},children:y},`label`)})}),g&&(0,w.jsx)(`p`,{className:`mt-2 text-xs text-red-600`,role:`alert`,children:g})]})}var w,T,E=e((()=>{w=r(),T=t(n()),o(),s(),l(),S(),C.__docgenInfo={description:``,methods:[],displayName:`AddToCartButton`,props:{variantId:{required:!0,tsType:{name:`union`,raw:`string | null`,elements:[{name:`string`},{name:`null`}]},description:``},isConfigComplete:{required:!0,tsType:{name:`boolean`},description:``},isOutOfStock:{required:!0,tsType:{name:`boolean`},description:``},lensConfiguration:{required:!0,tsType:{name:`LensConfiguration`},description:``},lensOptions:{required:!0,tsType:{name:`Array`,elements:[{name:`LensOption`}],raw:`LensOption[]`},description:``},frameBasePrice:{required:!0,tsType:{name:`number`},description:``}}}})),D,O,k,A,j,M;e((()=>{D=r(),E(),s(),l(),m(),O={component:C,decorators:[e=>(0,D.jsx)(c,{children:(0,D.jsx)(f,{children:(0,D.jsx)(e,{})})})]},k={args:{variantId:`gid://shopify/ProductVariant/1001`,isConfigComplete:!0,isOutOfStock:!1,lensConfiguration:{lensType:`nonPrescription`,lensIndex:`1.50`,coatings:[],sunOptions:null,prescription:null,prescriptionMethod:null},lensOptions:p,frameBasePrice:295}},A={args:{...k.args,isConfigComplete:!1}},j={args:{...k.args,isOutOfStock:!0}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    variantId: 'gid://shopify/ProductVariant/1001',
    isConfigComplete: true,
    isOutOfStock: false,
    lensConfiguration: {
      lensType: 'nonPrescription',
      lensIndex: '1.50',
      coatings: [],
      sunOptions: null,
      prescription: null,
      prescriptionMethod: null
    },
    lensOptions: mockLensOptions,
    frameBasePrice: 295
  }
}`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    ...Ready.args,
    isConfigComplete: false
  }
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  args: {
    ...Ready.args,
    isOutOfStock: true
  }
}`,...j.parameters?.docs?.source}}},M=[`Ready`,`Incomplete`,`OutOfStock`]}))();export{A as Incomplete,j as OutOfStock,k as Ready,M as __namedExportsOrder,O as default};