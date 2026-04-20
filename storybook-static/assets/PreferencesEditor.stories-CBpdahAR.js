import{n as e,s as t}from"./chunk-CzyJ72yW.js";import{t as n}from"./react-CUIZZadK.js";import{_ as r}from"./iframe-BOb_YaGJ.js";function i({label:e,options:t,selected:n,onChange:r}){let i=e=>{r(n.includes(e)?n.filter(t=>t!==e):[...n,e])};return(0,o.jsxs)(`div`,{children:[(0,o.jsx)(`label`,{className:`text-xs text-neutral-400 block mb-1`,children:e}),(0,o.jsx)(`div`,{className:`flex flex-wrap gap-1`,children:t.map(e=>(0,o.jsx)(`button`,{type:`button`,onClick:()=>i(e),className:`px-2 py-0.5 rounded text-xs transition-colors ${n.includes(e)?`bg-neutral-900 text-white`:`bg-neutral-100 text-neutral-600 hover:bg-neutral-200`}`,children:e},e))})]})}function a({customerId:e,stated:t,derived:n}){let[r,a]=(0,s.useState)(!1),[d,f]=(0,s.useState)(t),[p,m]=(0,s.useState)(!1);async function h(){m(!0),(await fetch(`/api/crm/clients/${e}`,{credentials:`include`,method:`PATCH`,headers:{"Content-Type":`application/json`},body:JSON.stringify({metafields:{preferences_json:{value:JSON.stringify(d),type:`json`}}})})).ok&&a(!1),m(!1)}let g=(e,t)=>f(n=>({...n,[e]:t}));return(0,o.jsxs)(`div`,{className:`space-y-3`,children:[(0,o.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,o.jsx)(`h3`,{className:`text-sm font-medium`,children:`Preferences`}),(0,o.jsx)(`button`,{onClick:()=>r?h():a(!0),disabled:p,className:`text-xs text-neutral-400 hover:text-neutral-600`,children:p?`Saving…`:r?`Save`:`Edit`})]}),r?(0,o.jsxs)(`div`,{className:`space-y-3`,children:[(0,o.jsx)(i,{label:`Shapes`,options:c,selected:d.shapes??[],onChange:e=>g(`shapes`,e)}),(0,o.jsx)(i,{label:`Materials`,options:l,selected:d.materials??[],onChange:e=>g(`materials`,e)}),(0,o.jsx)(i,{label:`Colours`,options:u,selected:d.colours??[],onChange:e=>g(`colours`,e)}),(0,o.jsx)(i,{label:`Avoid`,options:[...l,...c],selected:d.avoid??[],onChange:e=>g(`avoid`,e)}),(0,o.jsxs)(`div`,{children:[(0,o.jsx)(`label`,{className:`text-xs text-neutral-400 block mb-1`,children:`Notes`}),(0,o.jsx)(`textarea`,{value:d.notes??``,onChange:e=>g(`notes`,e.target.value),rows:2,className:`w-full px-2 py-1 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400`})]}),(0,o.jsx)(`button`,{onClick:()=>a(!1),className:`text-xs text-neutral-400 hover:text-neutral-600`,children:`Cancel`})]}):(0,o.jsxs)(`div`,{className:`space-y-2 text-xs`,children:[[`shapes`,`materials`,`colours`].map(e=>(0,o.jsxs)(`div`,{children:[(0,o.jsx)(`span`,{className:`text-neutral-400 capitalize`,children:e}),(0,o.jsx)(`div`,{className:`flex flex-wrap gap-1 mt-0.5`,children:(d[e]??[]).length?(d[e]??[]).map(e=>(0,o.jsx)(`span`,{className:`px-1.5 py-0.5 bg-neutral-100 rounded`,children:e},e)):(0,o.jsx)(`span`,{className:`text-neutral-300`,children:`—`})})]},e)),(d.avoid??[]).length>0&&(0,o.jsxs)(`div`,{children:[(0,o.jsx)(`span`,{className:`text-neutral-400`,children:`Avoid`}),(0,o.jsx)(`div`,{className:`flex flex-wrap gap-1 mt-0.5`,children:(d.avoid??[]).map(e=>(0,o.jsx)(`span`,{className:`px-1.5 py-0.5 bg-red-50 text-red-600 rounded`,children:e},e))})]}),d.notes&&(0,o.jsxs)(`div`,{children:[(0,o.jsx)(`span`,{className:`text-neutral-400`,children:`Notes:`}),` `,d.notes]})]}),n&&(0,o.jsxs)(`div`,{className:`pt-2 border-t border-neutral-100`,children:[(0,o.jsx)(`h4`,{className:`text-xs text-neutral-400 mb-1`,children:`Derived from purchases`}),(0,o.jsxs)(`div`,{className:`text-xs space-y-1`,children:[n.derivedShapes?(0,o.jsxs)(`div`,{children:[`Shapes: `,JSON.stringify(n.derivedShapes)]}):null,n.derivedMaterials?(0,o.jsxs)(`div`,{children:[`Materials: `,JSON.stringify(n.derivedMaterials)]}):null,n.derivedColours?(0,o.jsxs)(`div`,{children:[`Colours: `,JSON.stringify(n.derivedColours)]}):null]})]})]})}var o,s,c,l,u,d=e((()=>{o=r(),s=t(n()),c=[`Round`,`Square`,`Aviator`,`Cat-eye`,`Rectangular`,`Oval`,`Browline`,`Geometric`],l=[`Acetate`,`Metal`,`Titanium`,`Wood`,`Horn`,`Mixed`],u=[`Black`,`Tortoise`,`Gold`,`Silver`,`Clear`,`Blue`,`Red`,`Green`,`Pink`,`White`],a.__docgenInfo={description:``,methods:[],displayName:`PreferencesEditor`,props:{customerId:{required:!0,tsType:{name:`string`},description:``},stated:{required:!0,tsType:{name:`Preferences`},description:``},derived:{required:!1,tsType:{name:`union`,raw:`DerivedPrefs | null`,elements:[{name:`DerivedPrefs`},{name:`null`}]},description:``}}}})),f,p,m,h;e((()=>{d(),f={component:a},p={args:{customerId:`cust_123`,stated:{shapes:[`Round`,`Cat-eye`],materials:[`Acetate`],colours:[`Black`,`Tortoise`],avoid:[`Aviator`],notes:`Prefers lightweight frames`},derived:{derivedShapes:[`Round`],derivedMaterials:[`Acetate`],derivedColours:[`Black`]}}},m={args:{customerId:`cust_123`,stated:{shapes:[],materials:[],colours:[],avoid:[],notes:``},derived:null}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    customerId: 'cust_123',
    stated: {
      shapes: ['Round', 'Cat-eye'],
      materials: ['Acetate'],
      colours: ['Black', 'Tortoise'],
      avoid: ['Aviator'],
      notes: 'Prefers lightweight frames'
    },
    derived: {
      derivedShapes: ['Round'],
      derivedMaterials: ['Acetate'],
      derivedColours: ['Black']
    }
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    customerId: 'cust_123',
    stated: {
      shapes: [],
      materials: [],
      colours: [],
      avoid: [],
      notes: ''
    },
    derived: null
  }
}`,...m.parameters?.docs?.source}}},h=[`Default`,`Empty`]}))();export{p as Default,m as Empty,h as __namedExportsOrder,f as default};