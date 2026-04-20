import{n as e}from"./chunk-CzyJ72yW.js";import{o as t,t as n,u as r}from"./storyData-JooGbszH.js";import{n as i,t as a}from"./CoatingsStep-P88Bw6g_.js";var o,s,c,l;e((()=>{i(),n(),o={component:a},s={args:{selectedCoatings:[],sunOptions:null,isSunglasses:!1,lensType:`singleVision`,lensOptions:t,onCoatingsChange:r,onSunOptionsChange:r,onNext:r,onBack:r}},c={args:{...s.args,isSunglasses:!0,lensType:`nonPrescriptionSun`,sunOptions:{tintColour:`gray`,polarized:!1,mirrorCoating:null}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    selectedCoatings: [],
    sunOptions: null,
    isSunglasses: false,
    lensType: 'singleVision',
    lensOptions: mockLensOptions,
    onCoatingsChange: noop,
    onSunOptionsChange: noop,
    onNext: noop,
    onBack: noop
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    ...Optical.args,
    isSunglasses: true,
    lensType: 'nonPrescriptionSun',
    sunOptions: {
      tintColour: 'gray',
      polarized: false,
      mirrorCoating: null
    }
  }
}`,...c.parameters?.docs?.source}}},l=[`Optical`,`SunWithOptions`]}))();export{s as Optical,c as SunWithOptions,l as __namedExportsOrder,o as default};