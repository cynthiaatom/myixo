import {useMemo} from 'react';
import {timelineFromMemory} from '../intelligence/derive';
import type {MemoryPayload} from '../intelligence/types';

export default function TimelineView({memory}:{memory:MemoryPayload}){
  const events=useMemo(()=>timelineFromMemory(memory),[memory]);
  return <section className="intelligenceView">
    <div className="viewHero"><div className="eyebrow">PERSONAL INTELLIGENCE TIMELINE</div><h1>HOW iXo'S UNDERSTANDING <em>EVOLVES</em></h1><p>This is not chat history. Every event below comes from an actual durable-memory timestamp or revision relationship.</p></div>
    <div className="timeline">{events.map(e=><article key={e.id}><time>{new Date(e.at).toLocaleString()}</time><div className="timelineDot"/><div><span>{e.type} · {e.category}</span><p>{e.value}</p></div></article>)}</div>
  </section>
}
