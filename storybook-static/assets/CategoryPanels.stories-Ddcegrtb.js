import{n as e,s as t}from"./chunk-CzyJ72yW.js";import{_ as n}from"./iframe-BOb_YaGJ.js";import{t as r}from"./link-CFnhLlkG.js";import{n as i,t as a}from"./image-QU13H8ke.js";import{n as o,t as s}from"./storyData-JooGbszH.js";function c({panels:e}){if(!e.length)return null;let t=e.slice(0,2),n=e.slice(2);return(0,u.jsxs)(u.Fragment,{children:[t.length>0&&(0,u.jsx)(`section`,{className:`grid grid-cols-1 md:grid-cols-2 w-full`,children:t.map(e=>(0,u.jsx)(l,{panel:e},e.collectionHandle))}),n.length>0&&(0,u.jsx)(`section`,{className:`grid grid-cols-1 md:grid-cols-3 w-full`,children:n.map(e=>(0,u.jsx)(l,{panel:e},e.collectionHandle))})]})}function l({panel:e}){return(0,u.jsxs)(d.default,{href:`/collections/${e.collectionHandle}`,className:`relative group aspect-[4/5] overflow-hidden block`,children:[e.image&&(0,u.jsx)(i,{src:e.image,alt:e.title,fill:!0,className:`object-cover transition-transform duration-500 group-hover:scale-105`,sizes:`(max-width: 768px) 100vw, 50vw`}),(0,u.jsx)(`div`,{className:`absolute inset-0 bg-black/10`}),(0,u.jsx)(`span`,{className:`absolute bottom-6 left-6 text-white text-lg md:text-xl tracking-wide uppercase transition-transform duration-300 group-hover:-translate-y-1`,children:e.title})]})}var u,d,f=e((()=>{u=n(),a(),d=t(r()),c.__docgenInfo={description:``,methods:[],displayName:`CategoryPanels`,props:{panels:{required:!0,tsType:{name:`Array`,elements:[{name:`CategoryPanel`}],raw:`CategoryPanel[]`},description:``}}}})),p,m,h;e((()=>{f(),s(),p={component:c},m={args:{panels:[o,{...o,title:`Sun`,collectionHandle:`sunglasses`,sortOrder:1},{...o,title:`Signature`,collectionHandle:`signature`,sortOrder:2},{...o,title:`Permanent`,collectionHandle:`permanent`,sortOrder:3},{...o,title:`Archives`,collectionHandle:`archives`,sortOrder:4}]}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    panels: [mockCategoryPanel, {
      ...mockCategoryPanel,
      title: 'Sun',
      collectionHandle: 'sunglasses',
      sortOrder: 1
    }, {
      ...mockCategoryPanel,
      title: 'Signature',
      collectionHandle: 'signature',
      sortOrder: 2
    }, {
      ...mockCategoryPanel,
      title: 'Permanent',
      collectionHandle: 'permanent',
      sortOrder: 3
    }, {
      ...mockCategoryPanel,
      title: 'Archives',
      collectionHandle: 'archives',
      sortOrder: 4
    }]
  }
}`,...m.parameters?.docs?.source}}},h=[`Default`]}))();export{m as Default,h as __namedExportsOrder,p as default};