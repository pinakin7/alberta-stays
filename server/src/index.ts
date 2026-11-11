import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';

const app=express();
app.use(cors());
app.use(express.json({limit:'100kb'}));
const markets=[
{name:'Calgary',revenue:22200,occupancy:65,role:'Operating hub'},
{name:'Edmonton',revenue:17700,occupancy:64,role:'Lower-cost entry'},
{name:'Hinton',revenue:33800,occupancy:65,role:'Tourism pilot'},
{name:'Canmore',revenue:74700,occupancy:72,role:'Premium management'},
{name:'Sylvan Lake',revenue:30400,occupancy:57,role:'Seasonal'},
{name:'Grande Prairie',revenue:20000,occupancy:74,role:'Workforce stays'}];
const properties=[{id:'sample-edmonton',name:'Edmonton example',market:'Edmonton',price:219900,annualRevenue:17700,verified:false,source:'Illustrative example — verify price, availability, and short-term rental eligibility.'}];
const scenario=z.object({model:z.enum(['owned','arbitrage','management']),grossRevenue:z.number().min(0).max(10000000),expenseRatio:z.number().min(0).max(1),monthlyRent:z.number().min(0).default(0),monthlyDebt:z.number().min(0).default(0),managementFee:z.number().min(0).max(1).default(.2)});
app.get('/api/health',(_req,res)=>res.json({ok:true}));
app.get('/api/markets',(_req,res)=>res.json({markets,disclaimer:'Illustrative historical pitch benchmarks; not live market data.'}));
app.get('/api/properties',(_req,res)=>res.json({properties,disclaimer:'Sample data only; not live listings.'}));
app.post('/api/scenarios/calculate',(req,res)=>{
 const parsed=scenario.safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:parsed.error.flatten()});return;}
 const v=parsed.data;
 const revenue=v.model==='management'?v.grossRevenue*v.managementFee:v.grossRevenue;
 const operating=v.grossRevenue*v.expenseRatio;
 const rent=v.model==='arbitrage'?v.monthlyRent*12:0;
 const debt=v.model==='owned'?v.monthlyDebt*12:0;
 const annualCashFlow=revenue-operating-rent-debt;
 const effectiveMargin=v.model==='management'?v.managementFee-v.expenseRatio:1-v.expenseRatio;
 res.json({revenue,operating,rent,debt,annualCashFlow,monthlyCashFlow:annualCashFlow/12,breakEvenGrossRevenue:effectiveMargin>0?(rent+debt)/effectiveMargin:null});
});
const dist=path.resolve(process.cwd(),'client/dist');
if(fs.existsSync(dist)){app.use(express.static(dist));app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));}
const port=Number(process.env.PORT||3001);
app.listen(port,()=>console.log('Alberta Stays listening on '+port));