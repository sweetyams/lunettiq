import{n as e,s as t}from"./chunk-CzyJ72yW.js";import{_ as n}from"./iframe-BOb_YaGJ.js";import{t as r}from"./link-CFnhLlkG.js";function i({loyalty:e}){if(!e)return(0,a.jsxs)(`div`,{children:[(0,a.jsx)(`h2`,{className:`text-lg font-medium mb-4`,children:`Loyalty`}),(0,a.jsxs)(`div`,{className:`border border-gray-200 rounded-lg p-6 text-center`,children:[(0,a.jsx)(`p`,{className:`text-lg mb-1`,children:`◆`}),(0,a.jsx)(`p`,{className:`text-sm font-medium mb-1`,children:`Join Lunettiq Membership`}),(0,a.jsx)(`p`,{className:`text-sm text-gray-500 mb-4`,children:`Monthly credits, exclusive access, and a named optician who knows your style.`}),(0,a.jsx)(o.default,{href:`/pages/membership`,className:`inline-block px-6 py-2.5 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors`,children:`View Plans`})]})]});let t=s[e.tier]??s.essential,n=e.nextTierThreshold>0?Math.min(e.points/e.nextTierThreshold*100,100):100,r=e.tier===`vault`;return(0,a.jsxs)(`div`,{children:[(0,a.jsx)(`h2`,{className:`text-lg font-medium mb-4`,children:`Loyalty`}),(0,a.jsxs)(`div`,{className:`border border-gray-200 rounded-lg p-6`,children:[(0,a.jsxs)(`div`,{className:`flex items-center gap-3 mb-4`,children:[(0,a.jsx)(`span`,{className:`inline-block px-3 py-1 rounded-full text-xs font-semibold ${e.tier===`vault`?`text-white`:`text-black`} ${t.color}`,children:t.label}),(0,a.jsxs)(`span`,{className:`text-sm text-gray-500`,children:[e.points,` points`]})]}),!r&&(0,a.jsxs)(`div`,{className:`mb-4`,children:[(0,a.jsxs)(`div`,{className:`flex items-center justify-between text-xs text-gray-500 mb-1`,children:[(0,a.jsxs)(`span`,{children:[e.points,` pts`]}),(0,a.jsxs)(`span`,{children:[e.nextTierThreshold,` pts`]})]}),(0,a.jsx)(`div`,{className:`w-full h-2 bg-gray-100 rounded-full overflow-hidden`,children:(0,a.jsx)(`div`,{className:`h-full bg-black rounded-full transition-all duration-500`,style:{width:`${n}%`}})}),(0,a.jsxs)(`p`,{className:`text-xs text-gray-500 mt-1`,children:[e.nextTierThreshold-e.points,` points to next tier`]})]}),r&&(0,a.jsx)(`p`,{className:`text-xs text-gray-500 mb-4`,children:`You've reached the highest tier!`}),(0,a.jsxs)(`div`,{children:[(0,a.jsx)(`h3`,{className:`text-xs font-medium text-gray-500 mb-2`,children:`Your Benefits`}),(0,a.jsx)(`ul`,{className:`space-y-1`,children:t.benefits.map(e=>(0,a.jsxs)(`li`,{className:`text-sm flex items-center gap-2`,children:[(0,a.jsx)(`span`,{className:`text-green-600`,children:`✓`}),e]},e))})]})]})]})}var a,o,s,c=e((()=>{a=n(),o=t(r()),s={essential:{label:`Essential`,color:`bg-gray-200`,benefits:[`Free standard shipping`,`Birthday reward`,`Early access to sales`]},cult:{label:`CULT`,color:`bg-amber-400`,benefits:[`Free express shipping`,`Birthday reward`,`Early access to sales`,`Exclusive member pricing`,`Priority customer support`]},vault:{label:`VAULT`,color:`bg-black`,benefits:[`Free express shipping`,`Birthday reward`,`Early access to sales`,`Exclusive member pricing`,`Priority customer support`,`Complimentary lens upgrades`,`VIP styling sessions`]}},i.__docgenInfo={description:``,methods:[],displayName:`LoyaltySection`,props:{loyalty:{required:!0,tsType:{name:`union`,raw:`LoyaltyData | null`,elements:[{name:`LoyaltyData`},{name:`null`}]},description:``}}}})),l,u,d,f;e((()=>{c(),l={component:i},u={args:{loyalty:{tier:`cult`,status:`active`,creditBalance:125,memberSince:`2024-01-15`,nextRenewal:`2026-05-15`,pointsBalance:2400,referralCount:3}}},d={args:{loyalty:{tier:`essential`,status:`active`,creditBalance:0,memberSince:`2025-06-01`,nextRenewal:`2026-06-01`,pointsBalance:800,referralCount:0}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    loyalty: {
      tier: 'cult',
      status: 'active',
      creditBalance: 125,
      memberSince: '2024-01-15',
      nextRenewal: '2026-05-15',
      pointsBalance: 2400,
      referralCount: 3
    }
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    loyalty: {
      tier: 'essential',
      status: 'active',
      creditBalance: 0,
      memberSince: '2025-06-01',
      nextRenewal: '2026-06-01',
      pointsBalance: 800,
      referralCount: 0
    }
  }
}`,...d.parameters?.docs?.source}}},f=[`CultMember`,`Essential`]}))();export{u as CultMember,d as Essential,f as __namedExportsOrder,l as default};