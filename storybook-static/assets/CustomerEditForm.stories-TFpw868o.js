import{n as e,s as t}from"./chunk-CzyJ72yW.js";import{t as n}from"./react-CUIZZadK.js";import{_ as r}from"./iframe-BOb_YaGJ.js";import{t as i,u as a}from"./storyData-JooGbszH.js";function o({customerId:e,field:t,label:n,value:r,type:i=`text`,options:a,isMetafield:o,metafieldType:l,onSaved:u}){let[d,f]=(0,c.useState)(!1),[p,m]=(0,c.useState)(r),[h,g]=(0,c.useState)(r),[_,v]=(0,c.useState)(!1);async function y(){if(h===p){f(!1);return}v(!0);let n=o?{metafields:{[t]:{value:h,type:l||`single_line_text_field`}}}:{[t]:h};(await fetch(`/api/crm/clients/${e}`,{credentials:`include`,method:`PATCH`,headers:{"Content-Type":`application/json`},body:JSON.stringify(n)})).ok&&(m(h),f(!1),u?.(h)),v(!1)}return d?(0,s.jsxs)(`div`,{className:`py-1`,children:[(0,s.jsx)(`span`,{className:`text-xs text-neutral-400`,children:n}),(0,s.jsxs)(`div`,{className:`flex gap-1.5 mt-0.5`,children:[i===`select`&&a?(0,s.jsxs)(`select`,{value:h,onChange:e=>g(e.target.value),className:`flex-1 px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400`,children:[(0,s.jsx)(`option`,{value:``,children:`—`}),a.map(e=>(0,s.jsx)(`option`,{value:e.value,children:e.label},e.value))]}):(0,s.jsx)(`input`,{type:i,value:h,onChange:e=>g(e.target.value),className:`flex-1 px-2 py-1 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400`,onKeyDown:e=>{e.key===`Enter`&&y(),e.key===`Escape`&&f(!1)},autoFocus:!0}),(0,s.jsx)(`button`,{onClick:y,disabled:_,className:`px-2 py-1 bg-neutral-900 text-white text-xs rounded hover:bg-neutral-800 disabled:opacity-50`,children:_?`…`:`✓`}),(0,s.jsx)(`button`,{onClick:()=>f(!1),className:`px-2 py-1 text-xs text-neutral-400 hover:text-neutral-600`,children:`✕`})]})]}):(0,s.jsxs)(`div`,{className:`group flex items-center justify-between py-1`,children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`span`,{className:`text-xs text-neutral-400`,children:n}),(0,s.jsx)(`div`,{className:`text-sm`,children:p||`—`})]}),(0,s.jsx)(`button`,{onClick:()=>{g(p),f(!0)},className:`text-xs text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-neutral-600 transition-opacity`,children:`Edit`})]})}var s,c,l=e((()=>{s=r(),c=t(n()),o.__docgenInfo={description:``,methods:[],displayName:`CustomerEditForm`,props:{customerId:{required:!0,tsType:{name:`string`},description:``},field:{required:!0,tsType:{name:`string`},description:``},label:{required:!0,tsType:{name:`string`},description:``},value:{required:!0,tsType:{name:`string`},description:``},type:{required:!1,tsType:{name:`union`,raw:`'text' | 'email' | 'tel' | 'date' | 'select'`,elements:[{name:`literal`,value:`'text'`},{name:`literal`,value:`'email'`},{name:`literal`,value:`'tel'`},{name:`literal`,value:`'date'`},{name:`literal`,value:`'select'`}]},description:``,defaultValue:{value:`'text'`,computed:!1}},options:{required:!1,tsType:{name:`Array`,elements:[{name:`signature`,type:`object`,raw:`{ value: string; label: string }`,signature:{properties:[{key:`value`,value:{name:`string`,required:!0}},{key:`label`,value:{name:`string`,required:!0}}]}}],raw:`{ value: string; label: string }[]`},description:``},isMetafield:{required:!1,tsType:{name:`boolean`},description:``},metafieldType:{required:!1,tsType:{name:`string`},description:``},onSaved:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(newValue: string) => void`,signature:{arguments:[{type:{name:`string`},name:`newValue`}],return:{name:`void`}}},description:``}}}})),u,d,f,p;e((()=>{l(),i(),u={component:o},d={args:{customerId:`cust_123`,field:`firstName`,label:`First Name`,value:`Sophie`,onSaved:a}},f={args:{customerId:`cust_123`,field:`preferred_store`,label:`Preferred Store`,value:`plateau`,type:`select`,options:[{value:`plateau`,label:`Plateau`},{value:`dix30`,label:`Dix30`}],onSaved:a}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    customerId: 'cust_123',
    field: 'firstName',
    label: 'First Name',
    value: 'Sophie',
    onSaved: noop
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    customerId: 'cust_123',
    field: 'preferred_store',
    label: 'Preferred Store',
    value: 'plateau',
    type: 'select',
    options: [{
      value: 'plateau',
      label: 'Plateau'
    }, {
      value: 'dix30',
      label: 'Dix30'
    }],
    onSaved: noop
  }
}`,...f.parameters?.docs?.source}}},p=[`Text`,`Select`]}))();export{f as Select,d as Text,p as __namedExportsOrder,u as default};