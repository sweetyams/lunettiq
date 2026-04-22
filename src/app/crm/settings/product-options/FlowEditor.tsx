'use client';

import { useState, useMemo } from 'react';
import { Entity, str, num, hasChannel, getPrice, friendlyGroupLabel, countCustomRules } from './flow-helpers';
import { StepList, GroupEditor, Inspector } from './FlowPanels';

interface Props {
  steps: Entity[]; groups: Entity[]; options: Entity[];
  priceRules: Entity[]; constraintRules: Entity[]; onReload: () => void;
}

export default function FlowEditor(props: Props) {
  const { steps, groups, options, priceRules, constraintRules, onReload } = props;
  const [channel, setChannel] = useState('optical');
  const [selGroup, setSelGroup] = useState('');
  const [selChoice, setSelChoice] = useState('');

  const cSteps = useMemo(
    () => steps.filter(s => s.channel === channel && s.active !== false).sort((a, b) => num(a.sortOrder) - num(b.sortOrder)),
    [steps, channel],
  );

  const gMap = useMemo(() => {
    const m = new Map();
    groups.forEach(g => m.set(str(g.code), g));
    return m as Map<string, Entity>;
  }, [groups]);

  const lblMap = useMemo(() => {
    const m = new Map();
    options.forEach(o => m.set(str(o.code), str(o.label)));
    return m as Map<string, string>;
  }, [options]);

  const firstCode = cSteps.flatMap(s => (s.optionGroupCodes as string[]) || []).at(0) || '';
  const activeCode = (selGroup && gMap.has(selGroup)) ? selGroup : firstCode;
  const activeGroup = gMap.get(activeCode) || null;

  const gOpts = activeGroup
    ? options.filter(o => o.groupId === activeGroup.id && o.active !== false && hasChannel(o.channels, channel)).sort((a, b) => num(a.sortOrder) - num(b.sortOrder))
    : [];
  const gCodes = useMemo(() => new Set(gOpts.map(o => str(o.code))), [gOpts]);

  const selChoiceEntity = selChoice ? gOpts.find(o => str(o.code) === selChoice) || null : null;

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 500 }}>
      <StepList
        channel={channel} setChannel={c => { setChannel(c); setSelGroup(''); setSelChoice(''); }}
        cSteps={cSteps} gMap={gMap} activeCode={activeCode}
        setSelGroup={c => { setSelGroup(c); setSelChoice(''); }}
        options={options} constraintRules={constraintRules}
      />
      <GroupEditor
        group={activeGroup} channel={channel} gOpts={gOpts} gCodes={gCodes}
        priceRules={priceRules} constraintRules={constraintRules} lblMap={lblMap}
        selChoice={selChoice} setSelChoice={setSelChoice} onReload={onReload}
      />
      <Inspector
        choice={selChoiceEntity} channel={channel} gCodes={gCodes}
        constraintRules={constraintRules} priceRules={priceRules}
        options={options} lblMap={lblMap} onReload={onReload}
      />
    </div>
  );
}
