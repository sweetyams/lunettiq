import{n as e,s as t}from"./chunk-CzyJ72yW.js";import{t as n}from"./react-CUIZZadK.js";import{_ as r}from"./iframe-BOb_YaGJ.js";import{t as i,u as a}from"./storyData-JooGbszH.js";function o({fields:e,onSave:t}){let[n,r]=(0,c.useState)(!1),[i,a]=(0,c.useState)(``),[o,l]=(0,c.useState)(``);function u(){i.trim()&&(t([...e,{key:i.trim(),value:o.trim()}]),a(``),l(``),r(!1))}return(0,s.jsxs)(`div`,{children:[e.map((e,t)=>(0,s.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,padding:`var(--crm-space-2) 0`,borderBottom:`1px solid var(--crm-border-light)`,fontSize:`var(--crm-text-sm)`},children:[(0,s.jsx)(`span`,{style:{color:`var(--crm-text-secondary)`},children:e.key}),(0,s.jsx)(`span`,{style:{color:`var(--crm-text-primary)`},children:e.value})]},t)),n?(0,s.jsxs)(`div`,{style:{display:`flex`,gap:`var(--crm-space-2)`,marginTop:`var(--crm-space-3)`,alignItems:`center`},children:[(0,s.jsx)(`input`,{value:i,onChange:e=>a(e.target.value),className:`crm-input`,placeholder:`Key`,style:{flex:1}}),(0,s.jsx)(`input`,{value:o,onChange:e=>l(e.target.value),className:`crm-input`,placeholder:`Value`,style:{flex:1}}),(0,s.jsx)(`button`,{onClick:u,disabled:!i.trim(),className:`crm-btn crm-btn-primary`,style:{whiteSpace:`nowrap`},children:`Save`}),(0,s.jsx)(`button`,{onClick:()=>r(!1),className:`crm-btn crm-btn-secondary`,children:`✕`})]}):(0,s.jsx)(`button`,{onClick:()=>r(!0),className:`crm-btn crm-btn-secondary`,style:{marginTop:`var(--crm-space-3)`,fontSize:`var(--crm-text-sm)`},children:`+ Add field`})]})}var s,c,l=e((()=>{s=r(),c=t(n()),o.__docgenInfo={description:``,methods:[],displayName:`CustomFields`,props:{customerId:{required:!0,tsType:{name:`string`},description:``},fields:{required:!0,tsType:{name:`Array`,elements:[{name:`Field`}],raw:`Field[]`},description:``},onSave:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(fields: Field[]) => void`,signature:{arguments:[{type:{name:`Array`,elements:[{name:`Field`}],raw:`Field[]`},name:`fields`}],return:{name:`void`}}},description:``}}}})),u,d,f,p;e((()=>{l(),i(),u={component:o},d={args:{customerId:`cust_123`,fields:[{key:`preferred_store`,value:`Plateau`},{key:`insurance_provider`,value:`Sun Life`}],onSave:a}},f={args:{customerId:`cust_123`,fields:[],onSave:a}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    customerId: 'cust_123',
    fields: [{
      key: 'preferred_store',
      value: 'Plateau'
    }, {
      key: 'insurance_provider',
      value: 'Sun Life'
    }],
    onSave: noop
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    customerId: 'cust_123',
    fields: [],
    onSave: noop
  }
}`,...f.parameters?.docs?.source}}},p=[`Default`,`Empty`]}))();export{d as Default,f as Empty,p as __namedExportsOrder,u as default};