import React,{useEffect,useState} from 'react';
import './style.css';
type Market={name:string;revenue:number;occupancy:number;role:string};
type Result={revenue:number;operating:number;rent:number;debt:number;annualCashFlow:number;monthlyCashFlow:number;breakEvenGrossRevenue:number|null};
const money=(n:number)=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(n);
export function App(){
 const [markets,setMarkets]=useState<Market[]>([]);
 const [model,setModel]=useState<'owned'|'arbitrage'|'management'>('arbitrage');
 const [revenue,setRevenue]=useState(40000);
 const [expenseRatio,setExpenseRatio]=useState(.325);
 const [monthlyRent,setMonthlyRent]=useState(2000);
 const [monthlyDebt,setMonthlyDebt]=useState(2000);
 const [managementFee,setManagementFee]=useState(.20);
 const [result,setResult]=useState<Result|null>(null);
 const [error,setError]=useState('');
 const [scenarioError,setScenarioError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/markets',{signal:controller.signal}).then(async r=>{
   if(!r.ok) throw new Error('Market request failed');
   const data=await r.json();
   if(!Array.isArray(data.markets)||!data.markets.every((m: Market)=>m&&typeof m.name==='string'&&typeof m.role==='string'&&Number.isFinite(m.revenue)&&Number.isFinite(m.occupancy)&&m.occupancy>=0&&m.occupancy<=100)) throw new Error('Invalid market response');
   if(!controller.signal.aborted) setMarkets(data.markets);
  }).catch(()=>{if(!controller.signal.aborted)setError('Market data could not be loaded. Please reload to retry.');});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  setResult(null);setScenarioError('');
  fetch('/api/scenarios/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,grossRevenue:revenue,expenseRatio,monthlyRent,monthlyDebt,managementFee}),signal:controller.signal}).then(async r=>{
   if(!r.ok) throw new Error('Scenario request failed');
   const data=await r.json();
   if(!['revenue','operating','rent','debt','annualCashFlow','monthlyCashFlow'].every(key=>typeof data[key]==='number'&&Number.isFinite(data[key])) || !(data.breakEvenGrossRevenue===null || (typeof data.breakEvenGrossRevenue==='number'&&Number.isFinite(data.breakEvenGrossRevenue)))) throw new Error('Invalid scenario response');
   if(!controller.signal.aborted)setResult(data);
  }).catch(()=>{if(!controller.signal.aborted)setScenarioError('Scenario could not be calculated. Adjust an assumption to retry.');});
  return()=>controller.abort();
 },[model,revenue,expenseRatio,monthlyRent,monthlyDebt,managementFee]);
 return <><header className="top"><a className="brand" href="#">ALBERTA <span>STAYS</span></a><nav><a href="#thesis">Thesis</a><a href="#markets">Markets</a><a href="#calculator">Calculator</a><a href="#roadmap">Roadmap</a></nav></header>
 <main><section className="hero" id="thesis"><p className="eyebrow">THREE-FOUNDER INVESTMENT PLATFORM</p><h1>Build a scalable<br/><em>Alberta stays</em> portfolio.</h1><p className="lede">A disciplined $75,000 launch plan combining permitted property management, selective rental arbitrage, and future ownership.</p><div className="metrics"><div><strong>$75K</strong><small>Starting capital</small></div><div><strong>3</strong><small>Equal founders</small></div><div><strong>5–10</strong><small>Long-term units</small></div></div><p className="disclaimer">Illustrative planning framework, not a promise of returns or legal advice.</p></section>
 <section id="markets"><p className="eyebrow">MARKET INTELLIGENCE</p><h2>Where to start</h2><p>Indicative historical benchmarks from prior pitch research. Refresh from licensed sources before investment.</p><div className="cards">{markets.map(m=><article className="card" key={m.name}><div className="cardtop"><h3>{m.name}</h3><span>{m.role}</span></div><p className="big">{money(m.revenue)}</p><p className="muted">Indicative annual gross listing revenue</p><div className="occupancy"><span>Occupancy</span><b>{m.occupancy}%</b></div><div className="bar"><i style={{width:m.occupancy+'%'}}/></div></article>)}</div>{error&&<p role="alert">{error}</p>}</section>
 <section id="calculator" className="calc-section"><p className="eyebrow">INVESTMENT MODEL</p><h2>Stress-test unit economics</h2><p>Adjust assumptions. Values are annual unless specified; excludes corporate overhead, initial capital and income tax.</p><div className="calculator"><div className="inputs"><label>Operating model<select value={model} onChange={e=>setModel(e.target.value as typeof model)}><option value="arbitrage">Rental arbitrage</option><option value="management">Property management</option><option value="owned">Owned property</option></select></label><label>Annual guest revenue <b>{money(revenue)}</b><input type="range" min="10000" max="125000" step="2500" value={revenue} onChange={e=>setRevenue(Number(e.target.value))}/></label><label>Operating cost ratio of {model==='management'?'management fee income':'guest revenue'} <b>{(expenseRatio*100).toFixed(1)}%</b><input type="range" min="0" max=".6" step=".025" value={expenseRatio} onChange={e=>setExpenseRatio(Number(e.target.value))}/></label>{model==='arbitrage'&&<label>Monthly lease rent <b>{money(monthlyRent)}</b><input type="range" min="500" max="5000" step="100" value={monthlyRent} onChange={e=>setMonthlyRent(Number(e.target.value))}/></label>}{model==='owned'&&<label>Monthly mortgage debt service <b>{money(monthlyDebt)}</b><input type="range" min="500" max="6000" step="100" value={monthlyDebt} onChange={e=>setMonthlyDebt(Number(e.target.value))}/></label>}{model==='management'&&<label>Management fee <b>{(managementFee*100).toFixed(0)}%</b><input type="range" min=".1" max=".35" step=".01" value={managementFee} onChange={e=>setManagementFee(Number(e.target.value))}/></label>}</div><div className="results" aria-live="polite">{scenarioError&&<p role="alert">{scenarioError}</p>}<p>PROJECTED ANNUAL CASH CONTRIBUTION</p><div className={'cash '+(result&&result.annualCashFlow<0?'negative':'')}>{result?money(result.annualCashFlow):'—'}</div><div className="resultrow"><span>Monthly contribution</span><strong>{result?money(result.monthlyCashFlow):'—'}</strong></div><div className="resultrow"><span>Operating expense allowance</span><strong>{result?money(result.operating):'—'}</strong></div><div className="resultrow"><span>Annual fixed rent / debt</span><strong>{result?money(result.rent+result.debt):'—'}</strong></div><div className="resultrow"><span>Break-even guest revenue</span><strong>{result?.breakEvenGrossRevenue!=null?money(result.breakEvenGrossRevenue):'N/A'}</strong></div><p className="small">Management costs apply to fee income; owner-paid property costs are excluded. Scenario calculator only. Confirm licensing, applicable taxes, setup costs and property-specific estimates.</p></div></div></section>
 <section id="roadmap"><p className="eyebrow">EXECUTION</p><h2>From pilot to portfolio</h2><div className="steps">{[['0–3 months','Incorporate, validate licensing, source pilots'],['4–12 months','Launch 2–4 compliant units'],['Year 2','Operationalize 4–6 units'],['Year 3','Evaluate first acquisition'],['Years 4–5','Target 5–10 managed, leased and owned units']].map(([t,d])=><div className="step" key={t}><strong>{t}</strong><p>{d}</p></div>)}</div></section></main><footer>ALBERTA STAYS · Founders investment research · Not investment or legal advice</footer></>;
}
