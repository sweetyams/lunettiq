import{n as e}from"./chunk-CzyJ72yW.js";import{_ as t}from"./iframe-BOb_YaGJ.js";import{t as n,u as r}from"./storyData-JooGbszH.js";function i({selected:e,onClick:t,children:n}){return(0,o.jsx)(`button`,{onClick:t,className:`crm-btn`,style:{padding:`4px 12px`,fontSize:`var(--crm-text-sm)`,borderRadius:`var(--crm-radius-full)`,border:`1px solid ${e?`var(--crm-text-primary)`:`var(--crm-border)`}`,background:e?`var(--crm-text-primary)`:`var(--crm-surface)`,color:e?`var(--crm-text-inverse)`:`var(--crm-text-secondary)`},children:n})}function a({staff:e,value:t,onChange:n}){return(0,o.jsxs)(`div`,{style:{display:`flex`,gap:`var(--crm-space-2)`,flexWrap:`wrap`},children:[(0,o.jsx)(i,{selected:!t,onClick:()=>n(null),children:`All`}),e.map(e=>(0,o.jsx)(i,{selected:t===e.id,onClick:()=>n(t===e.id?null:e.id),children:(0,o.jsxs)(`span`,{style:{display:`inline-flex`,alignItems:`center`,gap:`var(--crm-space-2)`},children:[e.imageUrl&&(0,o.jsx)(`img`,{src:e.imageUrl,alt:``,style:{width:18,height:18,borderRadius:`50%`}}),e.firstName??`Staff`]})},e.id))]})}var o,s=e((()=>{o=t(),a.__docgenInfo={description:``,methods:[],displayName:`StaffPicker`,props:{staff:{required:!0,tsType:{name:`Array`,elements:[{name:`StaffMember`}],raw:`StaffMember[]`},description:``},value:{required:!0,tsType:{name:`union`,raw:`string | null`,elements:[{name:`string`},{name:`null`}]},description:``},onChange:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(staffId: string | null) => void`,signature:{arguments:[{type:{name:`union`,raw:`string | null`,elements:[{name:`string`},{name:`null`}]},name:`staffId`}],return:{name:`void`}}},description:``}}}})),c,l,u;e((()=>{s(),n(),c={component:a},l={args:{staff:[{id:`staff_1`,firstName:`Marie`,lastName:`Dupont`,imageUrl:null},{id:`staff_2`,firstName:`Jean`,lastName:`Lavoie`,imageUrl:null}],value:`staff_1`,onChange:r}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    staff: [{
      id: 'staff_1',
      firstName: 'Marie',
      lastName: 'Dupont',
      imageUrl: null
    }, {
      id: 'staff_2',
      firstName: 'Jean',
      lastName: 'Lavoie',
      imageUrl: null
    }],
    value: 'staff_1',
    onChange: noop
  }
}`,...l.parameters?.docs?.source}}},u=[`Default`]}))();export{l as Default,u as __namedExportsOrder,c as default};