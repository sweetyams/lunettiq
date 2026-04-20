import{n as e}from"./chunk-CzyJ72yW.js";import{t,u as n}from"./storyData-JooGbszH.js";import{o as r,t as i}from"./RxFields-VxJfPqAw.js";var a,o,s,c,l;e((()=>{r(),t(),a={component:i,title:`PDP/Configurator/RxSelect`},o={args:{label:`Sphere (SPH)`,value:0,onChange:n,options:[{value:0,label:`0.00 (Plano)`},{value:-1,label:`-1.00`},{value:1,label:`+1.00`}]}},s={args:{...o.args,error:`Value out of range`}},c={args:{...o.args,warning:`High prescription — consider 1.67 index`}},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Sphere (SPH)',
    value: 0,
    onChange: noop,
    options: [{
      value: 0,
      label: '0.00 (Plano)'
    }, {
      value: -1,
      label: '-1.00'
    }, {
      value: 1,
      label: '+1.00'
    }]
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    error: 'Value out of range'
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    ...Default.args,
    warning: 'High prescription — consider 1.67 index'
  }
}`,...c.parameters?.docs?.source}}},l=[`Default`,`WithError`,`WithWarning`]}))();export{o as Default,s as WithError,c as WithWarning,l as __namedExportsOrder,a as default};