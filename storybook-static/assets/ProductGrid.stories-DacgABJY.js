import{n as e,s as t}from"./chunk-CzyJ72yW.js";import{t as n}from"./react-CUIZZadK.js";import{_ as r}from"./iframe-BOb_YaGJ.js";import{c as i,r as a,t as o}from"./storyData-JooGbszH.js";import{n as s,t as c}from"./EditorialPanel-DdpLBSJi.js";import{i as l,r as u}from"./FavouriteIcon-CgXRupTB.js";import{n as d,t as f}from"./ProductCard-BvexJz-q.js";function p({products:e,editorialPanels:t,editorialInterval:n,skipAnimation:r=!1}){let i=(0,h.useMemo)(()=>{let r=[],i=0;return e.forEach((e,a)=>{r.push({type:`product`,product:e,key:`product-${e.id}`,index:a}),(a+1)%n===0&&i<t.length&&(r.push({type:`editorial`,panel:t[i],key:`editorial-${i}`,index:a+1}),i++)}),r},[e,t,n]);return e.length===0?(0,m.jsxs)(`div`,{className:`flex flex-col items-center justify-center py-20`,children:[(0,m.jsx)(`p`,{className:`text-gray-500 text-lg`,children:`No products found.`}),(0,m.jsx)(`p`,{className:`text-gray-400 text-sm mt-2`,children:`Try adjusting your filters.`})]}):(0,m.jsx)(`div`,{className:`grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6`,children:i.map(e=>{let t=e.type===`editorial`?(0,m.jsx)(`div`,{className:`col-span-1 sm:col-span-2 lg:col-span-3`,children:(0,m.jsx)(c,{panel:e.panel})}):(0,m.jsx)(f,{product:e.product,className:`w-full`,prefetch:!1});return r?(0,m.jsx)(`div`,{children:t},e.key):(0,m.jsx)(`div`,{className:`plp-animate`,style:{animationDelay:`${e.index*.06}s`},children:t},e.key)})})}var m,h,g=e((()=>{m=r(),h=t(n()),d(),s(),p.__docgenInfo={description:``,methods:[],displayName:`ProductGrid`,props:{products:{required:!0,tsType:{name:`Array`,elements:[{name:`Product`}],raw:`Product[]`},description:``},editorialPanels:{required:!0,tsType:{name:`Array`,elements:[{name:`EditorialPanelType`}],raw:`EditorialPanelType[]`},description:``},editorialInterval:{required:!0,tsType:{name:`number`},description:``},skipAnimation:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`false`,computed:!1}}}}})),_,v,y,b,x,S;e((()=>{_=r(),g(),l(),o(),v={component:p,decorators:[e=>(0,_.jsx)(u,{children:(0,_.jsx)(e,{})})]},y={args:{products:i,editorialPanels:[a],editorialInterval:6}},b={args:{products:i,editorialPanels:[],editorialInterval:6,skipAnimation:!0}},x={args:{products:[],editorialPanels:[],editorialInterval:6}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    products: mockProducts,
    editorialPanels: [mockEditorialPanel],
    editorialInterval: 6
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    products: mockProducts,
    editorialPanels: [],
    editorialInterval: 6,
    skipAnimation: true
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    products: [],
    editorialPanels: [],
    editorialInterval: 6
  }
}`,...x.parameters?.docs?.source}}},S=[`Default`,`SkipAnimation`,`Empty`]}))();export{y as Default,x as Empty,b as SkipAnimation,S as __namedExportsOrder,v as default};