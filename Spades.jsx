import React, { useState, useEffect, useRef } from 'react';

// ============ SOUND ============
let audioCtx = null;
const getCtx = () => { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } return audioCtx; };
const playTone = (freq, dur, type='sine', vol=0.15) => { const ctx = getCtx(); if (!ctx) return; try { const o=ctx.createOscillator(),g=ctx.createGain(); o.type=type; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0,ctx.currentTime); g.gain.linearRampToValueAtTime(vol,ctx.currentTime+0.01); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur); o.start(ctx.currentTime); o.stop(ctx.currentTime+dur); } catch(e) {} };
const sounds = {
  cardPlay: () => { playTone(800,0.06,'square',0.08); setTimeout(()=>playTone(400,0.08,'square',0.06),30); },
  trickWon: () => { playTone(523,0.1,'sine',0.12); setTimeout(()=>playTone(659,0.1,'sine',0.12),80); setTimeout(()=>playTone(784,0.15,'sine',0.12),160); },
  bidConfirm: () => playTone(440,0.08,'triangle',0.1),
  victory: () => [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,0.2,'sine',0.15),i*100)),
  defeat: () => [400,300,200].forEach((f,i)=>setTimeout(()=>playTone(f,0.25,'sawtooth',0.1),i*150)),
  achievement: () => { [659,784,1047,1319].forEach((f,i)=>setTimeout(()=>playTone(f,0.12,'triangle',0.13),i*70)); },
};

// ============ CARD UTILS ============
const SUITS=['♣','♦','♥','♠'], RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VAL=Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));
const JOKER_VAL={'BJ':16,'RJ':17};
const makeDeck=(j=false)=>{const d=[];for(const s of SUITS)for(const r of RANKS)d.push({suit:s,rank:r,id:`${r}${s}`});if(j){d.push({suit:'♠',rank:'BJ',id:'BJ',isJoker:true});d.push({suit:'♠',rank:'RJ',id:'RJ',isJoker:true});}return d;};
const shuffle=(a)=>{const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;};
const cardValue=(c,s)=>c.isJoker?JOKER_VAL[c.rank]:(s.high2&&c.suit==='♠'&&c.rank==='2')?15:RANK_VAL[c.rank];
const sortHand=(h,s)=>{const o=['♣','♦','♥','♠'];return [...h].sort((a,b)=>{const x=o.indexOf(a.suit)-o.indexOf(b.suit);return x!==0?x:cardValue(a,s)-cardValue(b,s);});};
const deal=(s)=>{const d=shuffle(makeDeck(s.jokers));return [sortHand(d.slice(0,13),s),sortHand(d.slice(13,26),s),sortHand(d.slice(26,39),s),sortHand(d.slice(39,52),s)];};
const teamOf=(p)=>p%2;
const legalPlays=(h,ls,sb,s)=>{const isS=(c)=>c.suit==='♠'||c.isJoker;if(ls){const f=h.filter(c=>ls==='♠'?isS(c):c.suit===ls&&!c.isJoker);if(f.length)return f;return h;}if(!sb){const ns=h.filter(c=>!isS(c));if(ns.length)return ns;}return h;};
const trickWinner=(t,ls,s)=>{let b=t[0];const isS=(c)=>c.suit==='♠'||c.isJoker;for(let i=1;i<t.length;i++){const c=t[i].card,bc=b.card;const cS=isS(c),bS=isS(bc);if(cS&&!bS)b=t[i];else if(cS===bS&&c.suit===bc.suit){if(cardValue(c,s)>cardValue(bc,s))b=t[i];}else if(cS&&bS){if(cardValue(c,s)>cardValue(bc,s))b=t[i];}}return b.player;};

// ============ BOT AI ============
const botBid=(hand,s,d='normal')=>{let bid=0;const isS=(c)=>c.suit==='♠'||c.isJoker;const spades=hand.filter(isS);const hs=spades.filter(c=>cardValue(c,s)>=12).length;spades.forEach(c=>{if(c.isJoker)bid+=1.1;else if(c.rank==='A')bid+=1;else if(c.rank==='K')bid+=0.9;else if(c.rank==='Q')bid+=0.55;else if(c.rank==='J')bid+=0.25;else if(s.high2&&c.rank==='2')bid+=1;});if(spades.length>=5)bid+=spades.length-4;for(const su of ['♣','♦','♥']){const o=hand.filter(c=>c.suit===su&&!c.isJoker);if(o.find(c=>c.rank==='A'))bid+=1;if(o.find(c=>c.rank==='K')&&o.length>1)bid+=0.5;if(o.length===0&&spades.length>=2)bid+=1;else if(o.length===1&&spades.length>=3)bid+=0.5;}let f=Math.round(bid);if(d==='easy')f+=Math.random()>0.5?1:-1;if(d==='hard')f=bid>Math.floor(bid)+0.5?Math.ceil(bid):Math.floor(bid);const a=hand.filter(c=>c.rank==='A'&&!c.isJoker).length,k=hand.filter(c=>c.rank==='K'&&!c.isJoker).length;if(f<=2&&a===0&&hs===0&&k<=1&&spades.length<=3){const nc=d==='easy'?0.1:d==='hard'?0.35:0.25;if(Math.random()<nc)return 0;}return Math.max(1,Math.min(13,f));};
const botPlay=(hand,trick,ls,sb,p,bids,tw,it,s,d='normal')=>{const legal=legalPlays(hand,ls,sb,s);if(legal.length===1)return legal[0];if(d==='easy'&&Math.random()<0.3)return legal[Math.floor(Math.random()*legal.length)];const mt=teamOf(p),pn=(p+2)%4,pb=bids[pn],pNil=pb===0,mNil=bids[p]===0;const ot=tw[mt],ob=(bids[p]===0?0:bids[p])+(pb===0?0:pb),nm=ot<ob;if(pNil){const pit=trick.find(t=>t.player===pn);if(pit){const wpw=(c)=>{const tt=[...trick,{player:p,card:c}];if(tt.length<4)return false;return trickWinner(tt,ls,s)===pn;};const safe=legal.filter(c=>!wpw(c));if(safe.length){const pw=trick.length>0&&trickWinner(trick,ls,s)===pn;const so=[...safe].sort((a,b)=>pw?cardValue(b,s)-cardValue(a,s):cardValue(a,s)-cardValue(b,s));return so[0];}}else if(trick.length===0){const ns=legal.filter(c=>c.suit!=='♠'&&!c.isJoker);const pool=ns.length?ns:legal;return [...pool].sort((a,b)=>cardValue(b,s)-cardValue(a,s))[0];}}if(mNil){const ww=(c)=>trickWinner([...trick,{player:p,card:c}],ls,s)===p;const lose=legal.filter(c=>!ww(c));if(lose.length)return [...lose].sort((a,b)=>cardValue(b,s)-cardValue(a,s))[0];return [...legal].sort((a,b)=>cardValue(a,s)-cardValue(b,s))[0];}if(trick.length===0){const ns=legal.filter(c=>c.suit!=='♠'&&!c.isJoker);if(ns.length&&!sb)return [...ns].sort((a,b)=>cardValue(a,s)-cardValue(b,s))[0];return [...legal].sort((a,b)=>cardValue(a,s)-cardValue(b,s))[0];}const wsf=trickWinner(trick,ls,s),pw=teamOf(wsf)===mt;const ww=(c)=>trickWinner([...trick,{player:p,card:c}],ls,s)===p;const wins=legal.filter(ww),loses=legal.filter(c=>!ww(c));if(pw&&!nm)return [...legal].sort((a,b)=>cardValue(a,s)-cardValue(b,s))[0];const wc=trick.find(t=>t.player===wsf).card;if(pw&&(wc.rank==='A'||wc.rank==='K'||wc.isJoker))return [...legal].sort((a,b)=>cardValue(a,s)-cardValue(b,s))[0];if(nm&&wins.length)return [...wins].sort((a,b)=>cardValue(a,s)-cardValue(b,s))[0];if(loses.length)return [...loses].sort((a,b)=>cardValue(a,s)-cardValue(b,s))[0];return [...wins].sort((a,b)=>cardValue(a,s)-cardValue(b,s))[0];};

// ============ SCORING ============
const computeRoundScore=(bids,it,tt,bags,s)=>{let una=0,tna=0;const nv=(b)=>b===-1?200:100,isN=(b)=>b===0||b===-1,rb=(b)=>isN(b)?0:b;if(isN(bids[0]))una+=it[0]===0?nv(bids[0]):-nv(bids[0]);if(isN(bids[2]))una+=it[2]===0?nv(bids[2]):-nv(bids[2]);if(isN(bids[1]))tna+=it[1]===0?nv(bids[1]):-nv(bids[1]);if(isN(bids[3]))tna+=it[3]===0?nv(bids[3]):-nv(bids[3]);const ub=rb(bids[0])+rb(bids[2]),tb=rb(bids[1])+rb(bids[3]);let up=0,tp=0,ubg=bags[0],tbg=bags[1];const bl=s.bagLimit,bp=s.bagPenalty;if(tt[0]>=ub){up+=ub*10;const o=tt[0]-ub;up+=o;ubg+=o;if(ubg>=bl){up-=bp;ubg-=bl;}}else{up-=ub*10;}up+=una;if(tt[1]>=tb){tp+=tb*10;const o=tt[1]-tb;tp+=o;tbg+=o;if(tbg>=bl){tp-=bp;tbg-=bl;}}else{tp-=tb*10;}tp+=tna;return {usBid:ub,themBid:tb,usPoints:up,themPoints:tp,usNewBags:ubg,themNewBags:tbg};};

// ============ THEMES ============
const THEMES = {
  felt: { name:'Classic Felt', description:'Traditional green card table', background:'radial-gradient(ellipse at center, #1a4d2e 0%, #0d2818 70%, #061309 100%)', accent:'#d4a64a', accentRgb:'212,166,74', cardCircle:'radial-gradient(ellipse, rgba(212,166,74,0.08) 0%, transparent 70%)', cardCircleBorder:'rgba(212,166,74,0.15)', primaryText:'#f5e6c8', secondaryText:'#fde68a', tertiaryText:'rgba(245,230,200,0.6)', headerColor:'#d4a64a', primaryBtn:'bg-amber-600 hover:bg-amber-500' },
  holodeck: { name:'Holodeck', description:'Holographic deck — translucent cyan grid', background:'radial-gradient(ellipse at center, #0a2a3d 0%, #051320 70%, #020a14 100%)', accent:'#22d3ee', accentRgb:'34,211,238', cardCircle:'radial-gradient(ellipse, rgba(34,211,238,0.12) 0%, transparent 70%)', cardCircleBorder:'rgba(34,211,238,0.4)', primaryText:'#cffafe', secondaryText:'#67e8f9', tertiaryText:'rgba(207,250,254,0.6)', headerColor:'#22d3ee', primaryBtn:'bg-cyan-500 hover:bg-cyan-400' },
};
const HolodeckGrid=({theme})=>{if(theme!=='holodeck')return null;return <div className="pointer-events-none fixed inset-0 z-0" style={{opacity:0.15}}><div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(rgba(34,211,238,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.4) 1px, transparent 1px)`,backgroundSize:'40px 40px',maskImage:'radial-gradient(ellipse at center, black 30%, transparent 80%)',WebkitMaskImage:'radial-gradient(ellipse at center, black 30%, transparent 80%)'}}/></div>;};

// ============ DECKS ============
const DECKS = {
  classic_red: {id:'classic_red',name:'Classic Red',description:'Traditional red diamond pattern',locked:false,backBg:'linear-gradient(135deg, #7c1d1d, #5a1414)',backAccent:'#fbbf24',backPattern:'diamond_red',faceBg:'#fafaf9',faceBorder:'#d6d3d1',redSuit:'#b91c1c',blackSuit:'#1c1917',fontFamily:"'Playfair Display', serif"},
  classic_blue: {id:'classic_blue',name:'Classic Blue',description:'Traditional blue diamond pattern',locked:false,backBg:'linear-gradient(135deg, #1e3a8a, #1e1b4b)',backAccent:'#fbbf24',backPattern:'diamond_blue',faceBg:'#fafaf9',faceBorder:'#d6d3d1',redSuit:'#b91c1c',blackSuit:'#1c1917',fontFamily:"'Playfair Display', serif"},
  gold_filigree: {id:'gold_filigree',name:'Gold Filigree',description:'Ornate gold scrollwork',locked:false,backBg:'linear-gradient(135deg, #78350f, #451a03)',backAccent:'#fbbf24',backPattern:'filigree',faceBg:'#fef3c7',faceBorder:'#92400e',redSuit:'#991b1b',blackSuit:'#451a03',fontFamily:"'Playfair Display', serif"},
  holodeck_grid: {id:'holodeck_grid',name:'Holodeck Grid',description:'Cyan circuit pattern',locked:false,backBg:'linear-gradient(135deg, #0e7490, #083344)',backAccent:'#67e8f9',backPattern:'grid',faceBg:'#ecfeff',faceBorder:'#22d3ee',redSuit:'#dc2626',blackSuit:'#0c4a6e',fontFamily:"'Courier New', monospace"},
  saloon: {id:'saloon',name:'Saloon',description:'Wood and leather card-shark style',locked:true,backBg:'linear-gradient(135deg, #422006, #1c1209)',backAccent:'#d97706',backPattern:'leather',faceBg:'#fef3c7',faceBorder:'#92400e',redSuit:'#7c2d12',blackSuit:'#451a03',fontFamily:"'Playfair Display', serif"},
  neon_synthwave: {id:'neon_synthwave',name:'Neon Synthwave',description:'80s magenta and cyan grid',locked:true,backBg:'linear-gradient(135deg, #831843, #1e1b4b)',backAccent:'#ec4899',backPattern:'synthwave',faceBg:'#1e1b4b',faceBorder:'#ec4899',redSuit:'#ec4899',blackSuit:'#22d3ee',fontFamily:"'Courier New', monospace"},
};
const CardBackPattern=({deck,width,height})=>{const w=width,h=height;switch(deck.backPattern){case 'diamond_red':case 'diamond_blue':return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,pointerEvents:'none'}}><defs><pattern id={`diamonds-${deck.id}`} x="0" y="0" width="8" height="12" patternUnits="userSpaceOnUse"><path d="M 4 0 L 8 6 L 4 12 L 0 6 Z" fill={deck.backAccent} fillOpacity="0.3"/></pattern></defs><rect x="2" y="2" width={w-4} height={h-4} rx="2" fill={`url(#diamonds-${deck.id})`}/><rect x="2" y="2" width={w-4} height={h-4} rx="2" fill="none" stroke={deck.backAccent} strokeOpacity="0.5" strokeWidth="0.5"/></svg>;case 'filigree':return <svg width={w} height={h} viewBox="0 0 40 56" style={{position:'absolute',inset:0,pointerEvents:'none'}} preserveAspectRatio="none"><rect x="2" y="2" width="36" height="52" rx="2" fill="none" stroke={deck.backAccent} strokeWidth="0.6"/><rect x="4" y="4" width="32" height="48" rx="1" fill="none" stroke={deck.backAccent} strokeWidth="0.3" strokeOpacity="0.6"/><path d="M 8 10 Q 12 8 16 10 M 24 10 Q 28 8 32 10 M 8 46 Q 12 48 16 46 M 24 46 Q 28 48 32 46" stroke={deck.backAccent} strokeWidth="0.5" fill="none" opacity="0.7"/><circle cx="20" cy="28" r="6" fill="none" stroke={deck.backAccent} strokeWidth="0.5"/><path d="M 20 22 L 20 34 M 14 28 L 26 28 M 16 24 L 24 32 M 24 24 L 16 32" stroke={deck.backAccent} strokeWidth="0.3" opacity="0.5"/><circle cx="20" cy="28" r="2" fill={deck.backAccent} fillOpacity="0.5"/></svg>;case 'grid':return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position:'absolute',inset:0,pointerEvents:'none'}}><defs><pattern id={`grid-${deck.id}`} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M 0 6 L 6 6 M 6 0 L 6 6" stroke={deck.backAccent} strokeWidth="0.3" opacity="0.6" fill="none"/></pattern></defs><rect x="2" y="2" width={w-4} height={h-4} rx="2" fill={`url(#grid-${deck.id})`}/><rect x="2" y="2" width={w-4} height={h-4} rx="2" fill="none" stroke={deck.backAccent} strokeWidth="1" strokeOpacity="0.8"/><circle cx={w/2} cy={h/2} r="3" fill="none" stroke={deck.backAccent} strokeWidth="0.5"/><circle cx={w/2} cy={h/2} r="6" fill="none" stroke={deck.backAccent} strokeWidth="0.3" opacity="0.6"/></svg>;case 'leather':return <svg width={w} height={h} viewBox="0 0 40 56" style={{position:'absolute',inset:0,pointerEvents:'none'}} preserveAspectRatio="none"><rect x="2" y="2" width="36" height="52" rx="3" fill="none" stroke={deck.backAccent} strokeWidth="0.8"/><rect x="4" y="4" width="32" height="48" rx="2" fill="none" stroke={deck.backAccent} strokeWidth="0.3" strokeDasharray="1.5,1.5" opacity="0.6"/><text x="20" y="32" textAnchor="middle" fill={deck.backAccent} fontSize="8" fontFamily="serif" fontWeight="bold" opacity="0.9">♠</text><path d="M 12 16 L 28 16 M 12 44 L 28 44" stroke={deck.backAccent} strokeWidth="0.4" opacity="0.5"/></svg>;case 'synthwave':return <svg width={w} height={h} viewBox="0 0 40 56" style={{position:'absolute',inset:0,pointerEvents:'none'}} preserveAspectRatio="none"><rect x="2" y="2" width="36" height="52" rx="2" fill="none" stroke={deck.backAccent} strokeWidth="0.5"/>{Array.from({length:6}).map((_,i)=><line key={`h${i}`} x1="2" y1={20+i*5} x2="38" y2={20+i*5} stroke={deck.backAccent} strokeWidth="0.3" opacity={0.3+i*0.1}/>)}{Array.from({length:7}).map((_,i)=><line key={`v${i}`} x1={20+(i-3)*8} y1="20" x2={20+(i-3)*3} y2="50" stroke={deck.backAccent} strokeWidth="0.3" opacity="0.4"/>)}<circle cx="20" cy="16" r="6" fill="none" stroke="#22d3ee" strokeWidth="0.5" opacity="0.8"/><line x1="14" y1="16" x2="26" y2="16" stroke="#22d3ee" strokeWidth="0.3"/></svg>;default:return null;}};
const CardBack=({deck,width=44,height=64,glow=false})=>{const w=width,h=height;return <div style={{width:w,height:h,borderRadius:6,position:'relative',background:deck.backBg,border:`1px solid ${deck.backAccent}`,boxShadow:glow?`0 0 8px ${deck.backAccent}aa, 0 4px 6px rgba(0,0,0,0.3)`:'0 4px 6px rgba(0,0,0,0.3)',overflow:'hidden'}}><CardBackPattern deck={deck} width={w} height={h}/></div>;};

// ============ ACHIEVEMENTS ============
const ACHIEVEMENTS = [
  { id:'first_game', name:'First Hand Dealt', description:'Play your first game', tier:'beginner', icon:'🎴', reward:50, check:(s)=>s.gamesPlayed>=1 },
  { id:'first_win', name:'First Victory', description:'Win your first game', tier:'beginner', icon:'🏆', reward:100, check:(s)=>s.wins>=1 },
  { id:'first_nil', name:'Nothing to Lose', description:'Successfully bid Nil (0 tricks)', tier:'beginner', icon:'0️⃣', reward:75, check:(s)=>s.nilsMade>=1 },
  { id:'first_set', name:'Set in Stone', description:'Set the opposing team', tier:'beginner', icon:'✗', reward:50, check:(s)=>s.opponentsSet>=1 },
  { id:'five_games', name:'Getting Started', description:'Play 5 games', tier:'beginner', icon:'🌱', reward:100, check:(s)=>s.gamesPlayed>=5 },
  { id:'win_streak_3', name:'On a Roll', description:'Win 3 games in a row', tier:'skill', icon:'🔥', reward:150, check:(s)=>s.bestWinStreak>=3 },
  { id:'win_streak_5', name:'Hot Hand', description:'Win 5 games in a row', tier:'skill', icon:'🔥', reward:300, check:(s)=>s.bestWinStreak>=5 },
  { id:'win_streak_10', name:'Untouchable', description:'Win 10 games in a row', tier:'skill', icon:'⚡', reward:1000, check:(s)=>s.bestWinStreak>=10 },
  { id:'nil_master', name:'Nil Master', description:'Make 5 successful Nil bids', tier:'skill', icon:'🎯', reward:250, check:(s)=>s.nilsMade>=5 },
  { id:'nil_king', name:'Nil King', description:'Make 20 successful Nil bids', tier:'skill', icon:'👑', reward:750, check:(s)=>s.nilsMade>=20 },
  { id:'comeback_kid', name:'Comeback Kid', description:'Win after being down by 100+', tier:'skill', icon:'📈', reward:300, check:(s)=>s.biggestComeback>=100 },
  { id:'big_comeback', name:'Phoenix Rising', description:'Win after being down by 200+', tier:'skill', icon:'🪶', reward:600, check:(s)=>s.biggestComeback>=200 },
  { id:'bid_master', name:'Right on the Money', description:'Win exactly your bid 5 times in a row', tier:'skill', icon:'🎲', reward:300, check:(s)=>s.exactBidStreak>=5 },
  { id:'wins_25', name:'Veteran', description:'Win 25 games', tier:'mastery', icon:'🎖️', reward:500, check:(s)=>s.wins>=25 },
  { id:'wins_50', name:'Card Shark', description:'Win 50 games', tier:'mastery', icon:'🦈', reward:1000, check:(s)=>s.wins>=50 },
  { id:'wins_100', name:'Centurion', description:'Win 100 games', tier:'mastery', icon:'💯', reward:2000, check:(s)=>s.wins>=100 },
  { id:'wins_500', name:'Legend', description:'Win 500 games', tier:'mastery', icon:'⭐', reward:10000, check:(s)=>s.wins>=500 },
  { id:'all_score_targets', name:'Versatile', description:'Win at all 7 score targets (100-500)', tier:'mastery', icon:'🎲', reward:1500, check:(s)=>Object.keys(s.winsByTier||{}).length>=7 },
  { id:'boston', name:'Boston', description:'Win all 13 tricks in one round', tier:'mastery', icon:'🌹', reward:1500, check:(s)=>s.bostons>=1 },
  { id:'boston_3', name:'Boston Triple', description:'Pull off Boston 3 times', tier:'mastery', icon:'🌹', reward:5000, check:(s)=>s.bostons>=3 },
  { id:'blind_nil', name:'Eyes Closed', description:'Make a Blind Nil bid', tier:'mastery', icon:'🙈', reward:1000, check:(s)=>s.blindNilsMade>=1 },
  { id:'lucky_one', name:'Lucky Day', description:'Win a game by exactly 1 point', tier:'wild', icon:'🍀', reward:200, check:(s)=>s.wonByOne>=1 },
  { id:'sandbagged', name:'Sandbagged', description:'Get hit by bag penalty', tier:'wild', icon:'🪣', reward:50, check:(s)=>s.bagPenaltiesTaken>=1 },
  { id:'no_bags', name:'Clean Hands', description:'Win a game without taking any bags', tier:'wild', icon:'🧼', reward:300, check:(s)=>s.cleanGames>=1 },
  { id:'underdog', name:'Underdog', description:'Win from -100 or lower', tier:'wild', icon:'🐕', reward:500, check:(s)=>s.wonFromNegative>=1 },
  { id:'joker_wild', name:"Joker's Wild", description:'Win a hand with both Jokers in your hand', tier:'wild', icon:'🃏', reward:400, check:(s)=>s.bothJokers>=1 },
  { id:'fast_game', name:'Speed Demon', description:'Win a 100-point game', tier:'wild', icon:'💨', reward:200, check:(s)=>(s.winsByTier?.[100]||0)>=1 },
  { id:'marathon', name:'Marathon', description:'Win a 500-point game', tier:'wild', icon:'🏃', reward:400, check:(s)=>(s.winsByTier?.[500]||0)>=1 },
  { id:'collector', name:'Collector', description:'Unlock 10 achievements', tier:'wild', icon:'📚', reward:500, check:(s,a)=>a.unlocked.length>=10 },
  { id:'completionist', name:'Completionist', description:'Unlock 25 achievements', tier:'wild', icon:'🏅', reward:2500, check:(s,a)=>a.unlocked.length>=25 },
];
const ACHIEVEMENT_TIERS = { beginner:{name:'Beginner',color:'#10b981',bgColor:'rgba(16,185,129,0.15)'}, skill:{name:'Skill',color:'#3b82f6',bgColor:'rgba(59,130,246,0.15)'}, mastery:{name:'Mastery',color:'#a855f7',bgColor:'rgba(168,85,247,0.15)'}, wild:{name:'Wild',color:'#f59e0b',bgColor:'rgba(245,158,11,0.15)'} };
const defaultAchievementProgress = () => ({ unlocked: [], unlockedAt: {} });
const checkAchievements=(stats,prog)=>{const nu=[];for(const a of ACHIEVEMENTS){if(prog.unlocked.includes(a.id))continue;try{if(a.check(stats,prog))nu.push(a.id);}catch(e){}}return nu;};

const AchievementToast=({achievement,onDismiss})=>{useEffect(()=>{const t=setTimeout(onDismiss,4500);return ()=>clearTimeout(t);},[onDismiss]);if(!achievement)return null;const a=ACHIEVEMENTS.find(x=>x.id===achievement);if(!a)return null;const tier=ACHIEVEMENT_TIERS[a.tier];return <div className="fixed top-4 left-4 right-4 z-[100] flex justify-center pointer-events-none"><div className="bg-stone-900/95 backdrop-blur border rounded-lg p-3 shadow-2xl max-w-sm w-full pointer-events-auto" style={{borderColor:tier.color,boxShadow:`0 0 20px ${tier.color}88`}}><div className="flex items-start gap-3"><div className="text-3xl">{a.icon}</div><div className="flex-1"><div className="text-[10px] uppercase tracking-wider font-bold" style={{color:tier.color}}>Achievement Unlocked · {tier.name}</div><div className="text-amber-100 font-bold text-base leading-tight" style={{fontFamily:"'Playfair Display', serif"}}>{a.name}</div><div className="text-amber-200/70 text-xs leading-tight mt-0.5">{a.description}</div><div className="text-amber-300 text-xs mt-1 font-bold">+{a.reward} 🪙</div></div><button onClick={onDismiss} className="text-amber-300/60 text-lg leading-none">×</button></div></div></div>;};

const AchievementsScreen=({progress,stats,onBack,theme})=>{const [ft,setFt]=useState('all');const tk=['all','beginner','skill','mastery','wild'];const filtered=ft==='all'?ACHIEVEMENTS:ACHIEVEMENTS.filter(a=>a.tier===ft);const uc=progress.unlocked.length;const tc=ACHIEVEMENTS.filter(a=>progress.unlocked.includes(a.id)).reduce((s,a)=>s+a.reward,0);const tpc=ACHIEVEMENTS.reduce((s,a)=>s+a.reward,0);return <div className="min-h-screen flex flex-col px-4 py-4" style={{background:THEMES[theme]?.background||THEMES.felt.background,fontFamily:"'Playfair Display', Georgia, serif"}}><HolodeckGrid theme={theme}/><div className="relative z-10 flex items-center justify-between mb-3"><button onClick={onBack} className="text-amber-300/70 text-sm">← Back</button><h1 className="text-xl font-bold text-amber-100 tracking-wider">ACHIEVEMENTS</h1><div className="w-12"/></div><div className="relative z-10 bg-stone-900/60 rounded-lg p-3 mb-3 border border-amber-900/40"><div className="flex justify-between items-center text-sm"><div><div className="text-amber-100 font-bold">{uc} / {ACHIEVEMENTS.length}</div><div className="text-amber-200/60 text-xs">unlocked</div></div><div className="text-right"><div className="text-amber-300 font-bold">{tc} 🪙</div><div className="text-amber-200/60 text-xs">of {tpc} possible</div></div></div><div className="mt-2 h-2 bg-stone-800 rounded overflow-hidden"><div className="h-full bg-amber-500" style={{width:`${(uc/ACHIEVEMENTS.length)*100}%`}}/></div></div><div className="relative z-10 flex gap-1 mb-3 overflow-x-auto pb-1">{tk.map(t=><button key={t} onClick={()=>setFt(t)} className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${ft===t?'bg-amber-500 text-stone-900':'bg-stone-700 text-amber-100'}`}>{t==='all'?'All':ACHIEVEMENT_TIERS[t].name}</button>)}</div><div className="relative z-10 flex-1 overflow-y-auto space-y-2 pr-1">{filtered.map(a=>{const u=progress.unlocked.includes(a.id);const tier=ACHIEVEMENT_TIERS[a.tier];return <div key={a.id} className="bg-stone-800/60 rounded p-3 flex items-start gap-3 border" style={{borderColor:u?tier.color:'transparent',opacity:u?1:0.7}}><div className={`text-3xl ${u?'':'grayscale opacity-40'}`}>{a.icon}</div><div className="flex-1"><div className="flex items-center gap-2"><div className="font-bold text-sm" style={{color:u?'#fde68a':'rgba(245,230,200,0.5)',fontFamily:"'Playfair Display', serif"}}>{a.name}</div><div className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{color:tier.color,background:tier.bgColor}}>{tier.name}</div></div><div className="text-xs text-amber-200/60 leading-tight mt-0.5">{a.description}</div><div className="text-[11px] font-bold mt-1" style={{color:u?'#fbbf24':'rgba(251,191,36,0.4)'}}>{u?'✓ Unlocked':'Locked'} · {a.reward} 🪙</div></div></div>;})}</div></div>;};

// ============ NAME POOL ============
const NAME_POOL = ['Maverick','Sable','Ember','Knox','Phoenix','Reign','Onyx','Rook','Wren','Sage','Kit','Vesper','Echo','Cipher','Ash','Quinn','Indigo','Sterling','Juno','Riot','Saint','Wolf','Storm','Blaze','Lefty','Diamond Joe','Slim','Ace','Big Red','Smokey','Doc','Memphis','Tex','Stax','Boots','Dutch','Cool Hand','Whisper','Cigar','Half-Deck','Velvet','Snake Eyes','Pearl','Queenie','Diamond Lil','Foxy','Lady Luck','Marcus','Diego','Kenji','Rafael','Tomás','Hassan','Jamal','Dmitri','Theo','Andre','Eli','Malik','Cole','Idris','Felix','Ronan','Devon','Xavier','Omar','Soren','Priya','Aaliyah','Imani','Zara','Nia','Soraya','Lucia','Amara','Yusra','Camille','Reina','Anaya','Beatriz','Naledi','Esi','Inez','Sofia','Maya','Talia','Kaia','Saoirse','Esmé','Mei','Layla','Adira','Noor','Freya','Ines'];
const pickRandomNameNot=(cur)=>{let n=cur,t=0;while(n===cur&&t<20){n=NAME_POOL[Math.floor(Math.random()*NAME_POOL.length)];t++;}return n;};
const randomNames=(count,exclude=[])=>{const used=[...exclude],r=[];for(let i=0;i<count;i++){const a=NAME_POOL.filter(n=>!used.includes(n));const n=a[Math.floor(Math.random()*a.length)];r.push(n);used.push(n);}return r;};

// ============ AVATAR ============
const SKIN_TONES=['#f5d5b8','#e6b894','#c89673','#a87554','#8b5a3c','#6b3f24','#4a2818'];
const HAIR_COLORS=['#1a1a1a','#4a3220','#8b5a2b','#c89055','#d4a64a','#b22222','#888888','#e8e8e8','#6b46c1'];
const EYE_COLORS=['#2d1810','#4a3220','#3d5a8c','#4a7c59','#7a5230','#1a4d6b','#5a3b8c'];
const HAIR_STYLES=['short','buzz','wave','curly','long','bun','fade','bald','ponytail','braids','pixie','afro','bob','wavy_long'];
const EYEBROW_STYLES=['normal','thick','thin','arched'];
const EYE_STYLES=['normal','narrow','wide','tired','lashes'];
const MOUTH_STYLES=['smile','smirk','neutral','grin','lipstick_red','lipstick_pink','lipstick_berry'];
const FACE_SHAPES=['round','oval','soft'];
const BEARD_STYLES=['none','stubble','goatee','full'];
const ACCESSORY_STYLES=['none','glasses','shades','earring','hat','blush','freckles'];
const defaultAvatar=()=>({skin:SKIN_TONES[2],hair:HAIR_STYLES[0],hairColor:HAIR_COLORS[0],eyebrow:EYEBROW_STYLES[0],eye:EYE_STYLES[0],eyeColor:EYE_COLORS[0],mouth:MOUTH_STYLES[0],beard:BEARD_STYLES[0],accessory:ACCESSORY_STYLES[0],face:FACE_SHAPES[0]});
const randomAvatar=()=>({skin:SKIN_TONES[Math.floor(Math.random()*SKIN_TONES.length)],hair:HAIR_STYLES[Math.floor(Math.random()*(HAIR_STYLES.length-1))],hairColor:HAIR_COLORS[Math.floor(Math.random()*HAIR_COLORS.length)],eyebrow:EYEBROW_STYLES[Math.floor(Math.random()*EYEBROW_STYLES.length)],eye:EYE_STYLES[Math.floor(Math.random()*EYE_STYLES.length)],eyeColor:EYE_COLORS[Math.floor(Math.random()*EYE_COLORS.length)],mouth:MOUTH_STYLES[Math.floor(Math.random()*MOUTH_STYLES.length)],beard:Math.random()>0.6?BEARD_STYLES[Math.floor(Math.random()*BEARD_STYLES.length)]:'none',accessory:Math.random()>0.5?ACCESSORY_STYLES[Math.floor(Math.random()*ACCESSORY_STYLES.length)]:'none',face:FACE_SHAPES[Math.floor(Math.random()*FACE_SHAPES.length)]});

const AvatarSVG=React.memo(function AvatarSVG({avatar,photo,name,size=60}){if(photo)return <div className="rounded-full overflow-hidden bg-stone-700 border-2 border-amber-700/40" style={{width:size,height:size}}><img src={photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>;if(!avatar&&name){const i=name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();let h=0;for(let k=0;k<name.length;k++)h=name.charCodeAt(k)+((h<<5)-h);const hu=Math.abs(h)%360;return <div className="rounded-full flex items-center justify-center font-bold border-2 border-amber-700/40" style={{width:size,height:size,background:`hsl(${hu},45%,35%)`,color:'#f5e6c8',fontSize:size*0.4,fontFamily:"'Playfair Display', serif"}}>{i}</div>;}const a=avatar||defaultAvatar();const fy=a.face==='oval'?28:a.face==='soft'?25:26;const hs=()=>{switch(a.hair){case 'bald':return null;case 'buzz':return <path d="M 25 35 Q 50 18 75 35 L 75 42 Q 50 32 25 42 Z" fill={a.hairColor}/>;case 'short':return <path d="M 22 38 Q 50 15 78 38 L 78 48 Q 70 38 50 36 Q 30 38 22 48 Z" fill={a.hairColor}/>;case 'wave':return <path d="M 20 42 Q 25 18 50 16 Q 75 18 80 42 Q 78 38 70 36 Q 65 30 50 28 Q 35 30 30 36 Q 22 38 20 42 Z" fill={a.hairColor}/>;case 'curly':return <g fill={a.hairColor}><circle cx="30" cy="32" r="8"/><circle cx="42" cy="22" r="9"/><circle cx="58" cy="22" r="9"/><circle cx="70" cy="32" r="8"/><circle cx="25" cy="42" r="7"/><circle cx="75" cy="42" r="7"/></g>;case 'long':return <path d="M 18 42 Q 22 18 50 16 Q 78 18 82 42 L 82 80 Q 78 68 75 62 L 75 42 Q 50 32 25 42 L 25 62 Q 22 68 18 80 Z" fill={a.hairColor}/>;case 'bun':return <g fill={a.hairColor}><circle cx="50" cy="14" r="10"/><path d="M 25 38 Q 50 22 75 38 L 75 45 Q 50 35 25 45 Z"/></g>;case 'fade':return <path d="M 28 36 Q 50 22 72 36 L 72 42 Q 50 36 28 42 Z" fill={a.hairColor}/>;case 'ponytail':return <g fill={a.hairColor}><path d="M 22 40 Q 50 16 78 40 L 78 48 Q 50 36 22 48 Z"/><path d="M 75 42 Q 88 50 86 68 Q 84 80 80 82 Q 78 70 76 56 Z"/></g>;case 'braids':return <g fill={a.hairColor}><path d="M 22 40 Q 50 18 78 40 L 78 46 Q 50 36 22 46 Z"/><ellipse cx="24" cy="55" rx="3.5" ry="8"/><ellipse cx="24" cy="70" rx="3.5" ry="8"/><ellipse cx="24" cy="83" rx="3" ry="6"/><ellipse cx="76" cy="55" rx="3.5" ry="8"/><ellipse cx="76" cy="70" rx="3.5" ry="8"/><ellipse cx="76" cy="83" rx="3" ry="6"/></g>;case 'pixie':return <path d="M 24 40 Q 30 22 50 18 Q 70 22 76 40 Q 70 32 60 32 L 58 38 L 50 30 L 42 38 L 40 32 Q 30 32 24 40 Z" fill={a.hairColor}/>;case 'afro':return <g fill={a.hairColor}><circle cx="50" cy="32" r="22"/><circle cx="30" cy="38" r="9"/><circle cx="70" cy="38" r="9"/><circle cx="38" cy="22" r="9"/><circle cx="62" cy="22" r="9"/></g>;case 'bob':return <path d="M 22 40 Q 26 18 50 16 Q 74 18 78 40 L 78 62 Q 74 56 70 56 L 70 42 Q 50 32 30 42 L 30 56 Q 26 56 22 62 Z" fill={a.hairColor}/>;case 'wavy_long':return <g fill={a.hairColor}><path d="M 18 42 Q 22 18 50 16 Q 78 18 82 42 Q 80 38 75 38 L 75 42 Q 50 32 25 42 L 25 38 Q 20 38 18 42 Z"/><path d="M 18 42 L 18 82 Q 22 70 24 76 Q 26 82 22 86 Q 28 84 26 78 L 28 60 Q 25 50 25 42 Z"/><path d="M 82 42 L 82 82 Q 78 70 76 76 Q 74 82 78 86 Q 72 84 74 78 L 72 60 Q 75 50 75 42 Z"/></g>;default:return null;}};const eb=(cx)=>{switch(a.eyebrow){case 'thick':return <rect x={cx-7} y="44" width="14" height="3.5" rx="1.5" fill={a.hairColor}/>;case 'thin':return <rect x={cx-6} y="45" width="12" height="1.5" rx="0.75" fill={a.hairColor}/>;case 'arched':return <path d={`M ${cx-7} 47 Q ${cx} 42 ${cx+7} 47`} stroke={a.hairColor} strokeWidth="2" fill="none"/>;default:return <rect x={cx-6} y="45" width="12" height="2.5" rx="1" fill={a.hairColor}/>;}};const ey=(cx)=>{switch(a.eye){case 'narrow':return <g><ellipse cx={cx} cy="53" rx="2.8" ry="0.9" fill="#f8f4ec"/><circle cx={cx} cy="53" r="1.1" fill={a.eyeColor}/></g>;case 'wide':return <g><ellipse cx={cx} cy="53" rx="3" ry="2.2" fill="#f8f4ec"/><circle cx={cx} cy="53" r="1.7" fill={a.eyeColor}/></g>;case 'tired':return <g><ellipse cx={cx} cy="54" rx="2.8" ry="1.4" fill="#f8f4ec"/><circle cx={cx} cy="54" r="1.3" fill={a.eyeColor}/><path d={`M ${cx-3.5} 50.5 L ${cx+3.5} 51.2`} stroke={a.hairColor} strokeWidth="0.8" fill="none"/></g>;case 'lashes':return <g><ellipse cx={cx} cy="53" rx="2.8" ry="1.7" fill="#f8f4ec"/><circle cx={cx} cy="53" r="1.4" fill={a.eyeColor}/><path d={`M ${cx-3} 51 L ${cx-4} 49 M ${cx} 50.5 L ${cx} 48.5 M ${cx+3} 51 L ${cx+4} 49`} stroke="#1a1a1a" strokeWidth="0.6" fill="none" strokeLinecap="round"/></g>;default:return <g><ellipse cx={cx} cy="53" rx="2.8" ry="1.7" fill="#f8f4ec"/><circle cx={cx} cy="53" r="1.4" fill={a.eyeColor}/></g>;}};const mo=()=>{const lc={lipstick_red:'#c41e3a',lipstick_pink:'#e85aa3',lipstick_berry:'#7c2848'};if(a.mouth.startsWith('lipstick_'))return <path d="M 42 68 Q 46 65 50 67 Q 54 65 58 68 Q 54 73 50 73 Q 46 73 42 68 Z" fill={lc[a.mouth]}/>;switch(a.mouth){case 'smirk':return <path d="M 44 70 Q 52 73 58 69" stroke="#5a2418" strokeWidth="1.8" fill="none" strokeLinecap="round"/>;case 'neutral':return <rect x="44" y="69" width="12" height="1.5" rx="0.75" fill="#5a2418"/>;case 'grin':return <path d="M 42 67 Q 50 75 58 67 L 58 68 Q 50 74 42 68 Z" fill="#5a2418"/>;default:return <path d="M 42 67 Q 50 73 58 67" stroke="#5a2418" strokeWidth="1.8" fill="none" strokeLinecap="round"/>;}};const bd=()=>{switch(a.beard){case 'stubble':return <path d="M 32 65 Q 35 74 50 76 Q 65 74 68 65 Q 60 70 50 70 Q 40 70 32 65 Z" fill={a.hairColor} opacity="0.25"/>;case 'goatee':return <path d="M 46 72 Q 50 79 54 72 Q 52 77 50 77 Q 48 77 46 72 Z" fill={a.hairColor}/>;case 'full':return <path d="M 33 65 Q 34 76 50 79 Q 66 76 67 65 Q 60 71 50 71 Q 40 71 33 65 Z" fill={a.hairColor}/>;default:return null;}};const ac=()=>{switch(a.accessory){case 'glasses':return <g stroke="#2a2a2a" strokeWidth="1.5" fill="none"><circle cx="38" cy="53" r="6"/><circle cx="62" cy="53" r="6"/><line x1="44" y1="53" x2="56" y2="53"/></g>;case 'shades':return <g><rect x="32" y="48" width="14" height="9" rx="2" fill="#1a1a1a"/><rect x="54" y="48" width="14" height="9" rx="2" fill="#1a1a1a"/><line x1="46" y1="52" x2="54" y2="52" stroke="#1a1a1a" strokeWidth="1.5"/></g>;case 'earring':return <g><circle cx="22" cy="62" r="1.8" fill="#d4a64a"/><circle cx="78" cy="62" r="1.8" fill="#d4a64a"/></g>;case 'hat':return <g><ellipse cx="50" cy="26" rx="32" ry="4" fill="#2a1810"/><path d="M 28 26 Q 28 10 50 8 Q 72 10 72 26 Z" fill="#2a1810"/><rect x="28" y="22" width="44" height="3" fill="#d4a64a"/></g>;case 'blush':return <g><ellipse cx="32" cy="62" rx="4" ry="2.5" fill="#e85aa3" opacity="0.4"/><ellipse cx="68" cy="62" rx="4" ry="2.5" fill="#e85aa3" opacity="0.4"/></g>;case 'freckles':return <g fill="#8b5a3c" opacity="0.6"><circle cx="36" cy="60" r="0.7"/><circle cx="40" cy="62" r="0.6"/><circle cx="44" cy="60" r="0.7"/><circle cx="56" cy="60" r="0.6"/><circle cx="60" cy="62" r="0.7"/><circle cx="64" cy="60" r="0.6"/><circle cx="48" cy="63" r="0.5"/><circle cx="52" cy="63" r="0.5"/></g>;default:return null;}};return <svg viewBox="0 0 100 100" style={{width:size,height:size}} className="rounded-full"><rect x="0" y="0" width="100" height="100" fill="#3a2415"/><rect x="40" y="78" width="20" height="22" fill={a.skin}/><ellipse cx="50" cy="55" rx="22" ry={fy} fill={a.skin}/><ellipse cx="27" cy="57" rx="3" ry="5" fill={a.skin}/><ellipse cx="73" cy="57" rx="3" ry="5" fill={a.skin}/>{hs()}{eb(38)}{eb(62)}{ey(38)}{ey(62)}<path d="M 50 56 Q 48 62 50 64 Q 52 62 50 56" fill="none" stroke="#5a2418" strokeWidth="0.8" opacity="0.5"/>{mo()}{bd()}{ac()}<circle cx="50" cy="50" r="49" fill="none" stroke="rgba(212,166,74,0.4)" strokeWidth="2"/></svg>;});

// ============ ROLODEX ============
const RolodexSpinner=({items,value,onChange,size='normal'})=>{const ci=items.findIndex(i=>i.value===value);const idx=ci>=0?ci:0;const [spinning,setSpinning]=useState(false);const [dir,setDir]=useState(0);const tref=useRef(null);const next=()=>{if(spinning)return;setSpinning(true);setDir(1);if(audioCtx)playTone(600,0.04,'square',0.05);tref.current=setTimeout(()=>{onChange(items[(idx+1)%items.length].value);setSpinning(false);setDir(0);},250);};const prev=()=>{if(spinning)return;setSpinning(true);setDir(-1);if(audioCtx)playTone(600,0.04,'square',0.05);tref.current=setTimeout(()=>{onChange(items[(idx-1+items.length)%items.length].value);setSpinning(false);setDir(0);},250);};useEffect(()=>()=>tref.current&&clearTimeout(tref.current),[]);const current=items[idx];const cs=size==='compact'?{w:140,h:70}:{w:260,h:120};const fs=size==='compact'?{title:13,sub:9}:{title:22,sub:11};return <div className="flex items-center justify-center gap-2 select-none"><button onClick={prev} disabled={spinning} className="w-8 h-8 rounded-full bg-stone-800/80 hover:bg-stone-700 text-amber-200 flex items-center justify-center text-lg font-bold transition-all active:scale-90 disabled:opacity-50">‹</button><div style={{width:cs.w,height:cs.h,perspective:'600px'}}><div style={{width:'100%',height:'100%',position:'relative',transformStyle:'preserve-3d',transform:spinning?`rotateY(${dir*90}deg)`:'rotateY(0deg)',transition:'transform 0.25s ease-in'}}><div className="absolute inset-0 rounded-lg flex flex-col items-center justify-center p-2 shadow-lg border" style={{background:current.bgGradient||'linear-gradient(135deg, #1a4d2e, #0d2818)',borderColor:current.accent||'#d4a64a',color:current.textColor||'#f5e6c8',backfaceVisibility:'hidden'}}>{current.preview&&<div className="mb-1">{current.preview}</div>}<div className="font-bold tracking-wide text-center" style={{fontSize:fs.title,fontFamily:"'Playfair Display', serif"}}>{current.label}{current.locked&&' 🔒'}</div>{current.description&&<div className="text-center opacity-70 mt-1 px-2" style={{fontSize:fs.sub}}>{current.description}</div>}</div></div></div><button onClick={next} disabled={spinning} className="w-8 h-8 rounded-full bg-stone-800/80 hover:bg-stone-700 text-amber-200 flex items-center justify-center text-lg font-bold transition-all active:scale-90 disabled:opacity-50">›</button></div>;};

const themeItems=Object.entries(THEMES).map(([k,t])=>({value:k,label:t.name,description:t.description,bgGradient:k==='holodeck'?'linear-gradient(135deg, #0a2a3d, #051320)':'linear-gradient(135deg, #1a4d2e, #0d2818)',accent:t.accent,textColor:t.primaryText}));
const deckItems=Object.entries(DECKS).map(([k,d])=>({value:k,label:d.name,description:d.locked?'Locked — coming soon':d.description,bgGradient:d.backBg,accent:d.backAccent,textColor:'#fff',locked:d.locked,preview:<CardBack deck={d} width={36} height={50} glow={false}/>}));

// ============ AVATAR BUILDER ============
const AvatarBuilder=({avatar,setAvatar})=>{const sections=[{key:'skin',label:'Skin',options:SKIN_TONES,type:'color'},{key:'face',label:'Face Shape',options:FACE_SHAPES,type:'style'},{key:'hair',label:'Hair Style',options:HAIR_STYLES,type:'style'},{key:'hairColor',label:'Hair Color',options:HAIR_COLORS,type:'color'},{key:'eyebrow',label:'Brows',options:EYEBROW_STYLES,type:'style'},{key:'eye',label:'Eyes',options:EYE_STYLES,type:'style'},{key:'eyeColor',label:'Eye Color',options:EYE_COLORS,type:'color'},{key:'mouth',label:'Mouth',options:MOUTH_STYLES,type:'style'},{key:'beard',label:'Beard',options:BEARD_STYLES,type:'style'},{key:'accessory',label:'Accessory',options:ACCESSORY_STYLES,type:'style'}];const lab=(s)=>s.replace(/_/g,' ');return <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">{sections.map(s=><div key={s.key} className="bg-stone-800/60 rounded p-2"><div className="text-amber-200/80 text-[10px] uppercase tracking-wider mb-1.5">{s.label}</div><div className="flex gap-1.5 flex-wrap">{s.options.map(opt=>{const sel=avatar[s.key]===opt;if(s.type==='color')return <button key={opt} onClick={()=>setAvatar({...avatar,[s.key]:opt})} className={`w-7 h-7 rounded-full border-2 ${sel?'border-amber-400 scale-110':'border-stone-600'}`} style={{background:opt}}/>;return <button key={opt} onClick={()=>setAvatar({...avatar,[s.key]:opt})} className={`px-2.5 py-1 rounded text-[11px] capitalize ${sel?'bg-amber-500 text-stone-900 font-bold':'bg-stone-700 text-amber-100 hover:bg-stone-600'}`}>{lab(opt)}</button>;})}</div></div>)}</div>;};

// ============ CREATE PLAYER ============
const CreatePlayerScreen=({existingProfile,onConfirm,onCancel})=>{const [name,setName]=useState(()=>existingProfile?.name||NAME_POOL[Math.floor(Math.random()*NAME_POOL.length)]);const [editingName,setEditingName]=useState(false);const [tempName,setTempName]=useState(name);const im=existingProfile?.photo?'photo':existingProfile&&!existingProfile.avatar&&!existingProfile.photo?'none':'avatar';const [mode,setMode]=useState(im);const [avatar,setAvatar]=useState(existingProfile?.avatar||defaultAvatar());const [photo,setPhoto]=useState(existingProfile?.photo||null);const fr=useRef(null);const hp=(e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{setPhoto(ev.target.result);setMode('photo');};r.readAsDataURL(f);};return <div className="min-h-screen flex flex-col px-4 py-4" style={{background:THEMES.felt.background,fontFamily:"'Playfair Display', Georgia, serif"}}><div className="flex items-center justify-between mb-3">{onCancel?<button onClick={onCancel} className="text-amber-300/70 text-sm">← Back</button>:<div/>}<h1 className="text-xl font-bold text-amber-100 tracking-wider">CREATE PLAYER</h1><div className="w-12"/></div><div className="flex flex-col items-center mb-3"><AvatarSVG avatar={mode==='avatar'?avatar:null} photo={mode==='photo'?photo:null} name={mode==='none'?name:null} size={100}/>{!editingName?<div className="mt-2 flex items-center gap-2"><span className="text-2xl text-amber-100 font-bold">{name}</span><button onClick={()=>{setTempName(name);setEditingName(true);}} className="text-amber-300/70 text-xs underline">edit</button></div>:<div className="mt-2 flex items-center gap-2"><input type="text" value={tempName} onChange={(e)=>setTempName(e.target.value.slice(0,20))} className="bg-stone-800 text-amber-100 px-2 py-1 rounded border border-amber-700/40 text-center" autoFocus maxLength={20}/><button onClick={()=>{setName(tempName.trim()||'Player');setEditingName(false);}} className="text-amber-300 text-xs font-bold">ok</button></div>}<div className="flex gap-2 mt-2"><button onClick={()=>setName(c=>pickRandomNameNot(c))} className="text-xs px-3 py-1 bg-stone-800 hover:bg-stone-700 text-amber-200 rounded border border-amber-900/40">🎲 Reroll Name</button></div></div><div className="flex gap-1 mb-3 bg-stone-900/60 p-1 rounded"><button onClick={()=>setMode('avatar')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider ${mode==='avatar'?'bg-amber-600 text-stone-900':'text-amber-200/70'}`}>Avatar</button><button onClick={()=>{if(photo)setMode('photo');else fr.current?.click();}} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider ${mode==='photo'?'bg-amber-600 text-stone-900':'text-amber-200/70'}`}>{photo?'Photo':'Upload'}</button><button onClick={()=>setMode('none')} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider ${mode==='none'?'bg-amber-600 text-stone-900':'text-amber-200/70'}`}>Initials</button><input ref={fr} type="file" accept="image/*" onChange={hp} className="hidden"/></div><div className="flex-1 mb-3">{mode==='avatar'&&<><div className="flex gap-2 mb-2"><button onClick={()=>setAvatar(randomAvatar())} className="flex-1 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-200 text-xs rounded border border-amber-900/40">🎲 Randomize</button><button onClick={()=>setAvatar(defaultAvatar())} className="flex-1 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-200 text-xs rounded border border-amber-900/40">Reset</button></div><AvatarBuilder avatar={avatar} setAvatar={setAvatar}/></>}{mode==='photo'&&<div className="flex flex-col items-center gap-3 pt-4"><div className="text-amber-100/70 text-xs">{photo?'Photo loaded':'No photo yet'}</div><button onClick={()=>fr.current?.click()} className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-amber-200 text-sm rounded border border-amber-900/40">{photo?'Change':'Choose'} Photo</button>{photo&&<button onClick={()=>{setPhoto(null);setMode('avatar');}} className="text-rose-300/70 text-xs underline">Remove photo</button>}</div>}{mode==='none'&&<div className="flex flex-col items-center gap-3 pt-6 text-center px-4"><div className="text-amber-100/70 text-sm">No avatar — your initials will represent you.</div></div>}</div><button onClick={()=>onConfirm({name:name.trim()||'Player',avatar:mode==='avatar'?avatar:null,photo:mode==='photo'?photo:null})} disabled={mode==='photo'&&!photo} className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-stone-900 font-bold rounded shadow-xl tracking-wider uppercase text-sm">Take Your Seat</button></div>;};

// ============ SETTINGS ============
const defaultSettings=()=>({scoreTarget:500,high2:false,jokers:false,allowBlindNil:false,bagLimit:10,bagPenalty:100,botDifficulty:'normal',theme:'felt',sound:false,deck:'classic_red'});
const SettingsScreen=({settings,onSave,onBack})=>{const [s,setS]=useState(settings);const Section=({title,children})=><div className="bg-stone-800/60 rounded p-3 mb-3"><div className="text-amber-200/80 text-[10px] uppercase tracking-wider mb-2 font-bold">{title}</div>{children}</div>;const ButtonRow=({value,options,onChange,labels})=><div className="flex gap-1.5 flex-wrap">{options.map((o,i)=><button key={o} onClick={()=>onChange(o)} className={`px-3 py-1.5 rounded text-xs font-bold ${value===o?'bg-amber-500 text-stone-900':'bg-stone-700 text-amber-100 hover:bg-stone-600'}`}>{labels?labels[i]:o}</button>)}</div>;const Toggle=({label,description,value,onChange})=><div className="flex items-start justify-between gap-3 py-2"><div className="flex-1"><div className="text-amber-100 text-sm font-bold">{label}</div>{description&&<div className="text-amber-200/50 text-[11px] leading-tight mt-0.5">{description}</div>}</div><button onClick={()=>onChange(!value)} className={`relative w-11 h-6 rounded-full flex-shrink-0 ${value?'bg-amber-500':'bg-stone-600'}`}><div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value?'left-[22px]':'left-0.5'}`}/></button></div>;const hd=(v)=>{if(DECKS[v]?.locked)return;setS({...s,deck:v});};return <div className="min-h-screen flex flex-col px-4 py-4" style={{background:THEMES[s.theme]?.background||THEMES.felt.background,fontFamily:"'Playfair Display', Georgia, serif"}}><HolodeckGrid theme={s.theme}/><div className="relative z-10 flex items-center justify-between mb-4"><button onClick={onBack} className="text-amber-300/70 text-sm">← Back</button><h1 className="text-xl font-bold text-amber-100 tracking-wider">GAME SETTINGS</h1><div className="w-12"/></div><div className="relative z-10 flex-1 overflow-y-auto pr-1"><Section title="Table Theme"><div className="py-2"><RolodexSpinner items={themeItems} value={s.theme} onChange={(v)=>setS({...s,theme:v})} size="normal"/></div></Section><Section title="Card Deck"><div className="py-2"><RolodexSpinner items={deckItems} value={s.deck} onChange={hd} size="normal"/></div>{DECKS[s.deck]?.locked&&<div className="text-rose-400 text-[11px] text-center mt-2">🔒 This deck is locked.</div>}</Section><Section title="Sound Effects"><Toggle label="Sound" description="Card play, trick won, victory chimes. Default off." value={s.sound} onChange={(v)=>{setS({...s,sound:v});if(v)sounds.bidConfirm();}}/></Section><Section title="Score Target"><ButtonRow value={s.scoreTarget} options={[100,150,200,250,300,400,500]} onChange={(v)=>setS({...s,scoreTarget:v})}/></Section><Section title="Bag Penalty"><div className="mb-2"><div className="text-amber-200/70 text-[11px] mb-1.5">Bags allowed before penalty:</div><ButtonRow value={s.bagLimit} options={[5,10]} onChange={(v)=>setS({...s,bagLimit:v,bagPenalty:v===5?50:100})} labels={['5 bags','10 bags']}/></div><div><div className="text-amber-200/70 text-[11px] mb-1.5">Penalty when hit:</div><ButtonRow value={s.bagPenalty} options={[50,100]} onChange={(v)=>setS({...s,bagPenalty:v})} labels={['–50 pts','–100 pts']}/></div></Section><Section title="Rule Variants"><Toggle label="High 2 of Spades" description="The 2♠ becomes the highest card." value={s.high2} onChange={(v)=>setS({...s,high2:v})}/><div className="border-t border-stone-700 my-1"/><Toggle label="Jokers" description="Add Big and Little Jokers." value={s.jokers} onChange={(v)=>setS({...s,jokers:v})}/><div className="border-t border-stone-700 my-1"/><Toggle label="Blind Nil" description="Bid Nil without looking for ±200 pts." value={s.allowBlindNil} onChange={(v)=>setS({...s,allowBlindNil:v})}/></Section><Section title="Bot Difficulty"><ButtonRow value={s.botDifficulty} options={['easy','normal','hard']} onChange={(v)=>setS({...s,botDifficulty:v})} labels={['Easy','Normal','Hard']}/></Section></div><div className="relative z-10 flex gap-2 mt-3"><button onClick={()=>setS(defaultSettings())} className="px-4 py-3 bg-stone-700 hover:bg-stone-600 text-amber-100 font-bold rounded text-sm">Reset</button><button onClick={()=>onSave(s)} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wider text-sm">Save Settings</button></div></div>;};

// ============ FANNED HAND + TABLE CARD ============
// dealAnim: 'in' | 'idle' | null. When 'in', hand animates from collapsed (rotated, off-bottom) to fanned out.
const FannedHand=({hand,playableIds,onPlay,disabled,deck,dealAnim})=>{
  const n=hand.length;
  if(n===0)return <div className="h-20"/>;
  const il=typeof window!=='undefined'&&window.innerWidth>window.innerHeight&&window.innerWidth>600;
  const aw=il?Math.min(window.innerWidth-40,720):Math.min(window.innerWidth-20,380);
  const ma=il?40:30;
  const cs=il?{w:64,h:96}:{w:44,h:64};
  const ah=il?30:20;
  const isAnimating = dealAnim === 'in';
  return <div className="relative mx-auto" style={{width:aw,height:cs.h+ah+10}}>
    {hand.map((card,i)=>{
      const tt=n===1?0.5:i/(n-1);
      const finalAngle=(tt-0.5)*ma;
      const finalX=tt*(aw-cs.w);
      const finalYLift=Math.abs(tt-0.5)*2*ah;
      const playable=!disabled&&playableIds&&playableIds.has(card.id)&&!isAnimating;
      const isRed=(card.suit==='♥'||card.suit==='♦'||card.rank==='RJ');
      const dispR=card.isJoker?'🃏':card.rank;
      const dispS=card.isJoker?'':card.suit;
      // During deal-in: cards stacked at center bottom, rotated random direction, then snap to fan
      const animatedAngle = isAnimating ? 0 : finalAngle;
      const animatedX = isAnimating ? (aw/2 - cs.w/2) : finalX;
      const animatedBottom = isAnimating ? -cs.h : ah - finalYLift;
      const animatedScale = isAnimating ? 0.7 : 1;
      const transitionDelay = isAnimating ? '0ms' : `${i * 20}ms`; // stagger fan-out
      const animatedOpacity = isAnimating ? 0 : 1;
      return <button key={card.id} onClick={playable?()=>onPlay(card):undefined} disabled={!playable}
        style={{position:'absolute',left:animatedX,bottom:animatedBottom,width:cs.w,height:cs.h,transform:`rotate(${animatedAngle}deg) scale(${animatedScale})`,transformOrigin:'center bottom',transition:`left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), bottom 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out`,transitionDelay,zIndex:i,background:deck.faceBg,borderColor:deck.faceBorder,boxShadow:`0 4px 6px rgba(0,0,0,0.3)`,opacity:animatedOpacity}}
        className={`rounded-md border shadow-md flex flex-col items-start justify-between p-1 ${playable?'hover:-translate-y-3 active:scale-95 cursor-pointer':''} ${!playable&&!disabled&&!isAnimating?'opacity-40':''}`}>
        <div className="leading-none font-bold" style={{fontFamily:deck.fontFamily,fontSize:il?14:11,color:isRed?deck.redSuit:deck.blackSuit}}><div>{dispR}</div><div style={{fontSize:il?16:13,lineHeight:1}}>{dispS}</div></div>
        <div className="self-end rotate-180 font-bold" style={{fontSize:il?16:13,lineHeight:1,color:isRed?deck.redSuit:deck.blackSuit}}>{dispS}</div>
      </button>;
    })}
  </div>;
};

// Opponent hand stub: shows card backs stacked, animates them flying in from center during deal
const OpponentHandDeal = ({ deck, count, dealAnim, side }) => {
  // side: 'top' | 'left' | 'right' — determines stack orientation
  const isAnimating = dealAnim === 'in';
  if (!isAnimating) return null; // After deal completes, opponent hand is implicit (CPU plays from it)
  const cardSize = { w: 22, h: 32 };
  return (
    <div style={{position:'absolute', pointerEvents:'none', zIndex:50}}
      className={side==='top' ? 'top-0 left-1/2 -translate-x-1/2' : side==='left' ? 'left-2 top-1/2 -translate-y-1/2' : 'right-2 top-1/2 -translate-y-1/2'}>
      <div style={{position:'relative', width:cardSize.w*1.5, height:cardSize.h}}>
        {[0,1,2].map(i => (
          <div key={i} style={{position:'absolute', left:i*4, top:0, transform:`rotate(${(i-1)*5}deg)`, transition:'all 0.4s', transitionDelay:`${i*30}ms`, opacity:isAnimating?1:0}}>
            <CardBack deck={deck} width={cardSize.w} height={cardSize.h}/>
          </div>
        ))}
      </div>
    </div>
  );
};

const TableCard=({card,deck})=>{if(!card)return null;const isRed=(card.suit==='♥'||card.suit==='♦'||card.rank==='RJ');const dispR=card.isJoker?'🃏':card.rank;const dispS=card.isJoker?'':card.suit;return <div className="w-12 h-16 rounded-md border shadow-md flex flex-col items-start justify-between p-1" style={{fontFamily:deck.fontFamily,background:deck.faceBg,borderColor:deck.faceBorder}}><div className="leading-none font-bold text-xs" style={{color:isRed?deck.redSuit:deck.blackSuit}}><div>{dispR}</div><div className="text-sm leading-none">{dispS}</div></div><div className="self-end text-sm leading-none rotate-180 font-bold" style={{color:isRed?deck.redSuit:deck.blackSuit}}>{dispS}</div></div>;};

// Deck stack visual for the deal animation — shown in center of table during deal
const DeckStack = ({ deck, visible }) => {
  if (!visible) return null;
  return (
    <div style={{position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)', zIndex:60, pointerEvents:'none'}}>
      <div style={{position:'relative', width:50, height:70}}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{position:'absolute', left:i*2, top:-i*2}}>
            <CardBack deck={deck} width={50} height={70} glow={true}/>
          </div>
        ))}
      </div>
    </div>
  );
};

const BidSelector=({onBid,allowBlindNil,hasPeeked,onPeek,onBlindNil})=>{const [selected,setSelected]=useState(null);if(allowBlindNil&&!hasPeeked)return <div className="bg-stone-900/95 backdrop-blur rounded-lg p-4 border border-amber-700/40 shadow-xl"><div className="text-amber-100 text-sm mb-2 text-center font-bold">Blind Nil Opportunity</div><div className="text-amber-200/70 text-xs text-center mb-3">Bid Blind Nil for ±200 pts, or peek.</div><div className="flex gap-2"><button onClick={onBlindNil} className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded text-sm">Blind Nil 🎲</button><button onClick={onPeek} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded text-sm">Peek & Bid</button></div></div>;return <div className="bg-stone-900/95 backdrop-blur rounded-lg p-4 border border-amber-700/40 shadow-xl"><div className="text-amber-100 text-sm mb-3 text-center" style={{fontFamily:"'Playfair Display', serif"}}>Your Bid</div><div className="grid grid-cols-7 gap-1.5 mb-3">{Array.from({length:14},(_,i)=>i).map(n=><button key={n} onClick={()=>setSelected(n)} className={`h-9 rounded font-bold text-sm ${selected===n?'bg-amber-500 text-stone-900 scale-105':'bg-stone-700 text-amber-100 hover:bg-stone-600'}`} style={{fontFamily:"'Playfair Display', serif"}}>{n===0?'Nil':n}</button>)}</div><button disabled={selected===null} onClick={()=>onBid(selected)} className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-stone-900 font-bold rounded">Confirm Bid</button></div>;};

// ============ STATS ============
const defaultStats=()=>({gamesPlayed:0,wins:0,losses:0,currentStreak:0,bestWinStreak:0,worstLossStreak:0,roundsPlayed:0,bidsMade:0,bidsFailed:0,nilsAttempted:0,nilsMade:0,blindNilsMade:0,totalBags:0,bestRoundScore:-999,highestGameScore:0,biggestComeback:0,exactBidStreak:0,opponentsSet:0,bostons:0,wonByOne:0,bagPenaltiesTaken:0,cleanGames:0,wonFromNegative:0,bothJokers:0,winsByTier:{}});
const StatsScreen=({stats,profile,onBack,theme})=>{const wp=stats.gamesPlayed>0?Math.round((stats.wins/stats.gamesPlayed)*100):0;const bp=(stats.bidsMade+stats.bidsFailed)>0?Math.round((stats.bidsMade/(stats.bidsMade+stats.bidsFailed))*100):0;const np=stats.nilsAttempted>0?Math.round((stats.nilsMade/stats.nilsAttempted)*100):0;const Stat=({label,value,sub})=><div className="bg-stone-800/60 rounded p-3"><div className="text-amber-200/60 text-[10px] uppercase tracking-wider">{label}</div><div className="text-amber-100 text-xl font-bold leading-tight">{value}</div>{sub&&<div className="text-amber-200/50 text-[10px]">{sub}</div>}</div>;return <div className="min-h-screen flex flex-col px-4 py-4" style={{background:THEMES[theme]?.background||THEMES.felt.background,fontFamily:"'Playfair Display', Georgia, serif"}}><HolodeckGrid theme={theme}/><div className="relative z-10 flex items-center justify-between mb-4"><button onClick={onBack} className="text-amber-300/70 text-sm">← Back</button><h1 className="text-xl font-bold text-amber-100 tracking-wider">YOUR STATS</h1><div className="w-12"/></div><div className="relative z-10 flex flex-col items-center mb-4"><AvatarSVG avatar={profile?.avatar} photo={profile?.photo} name={!profile?.avatar&&!profile?.photo?profile?.name:null} size={64}/><div className="text-amber-100 font-bold text-lg mt-2">{profile?.name}</div></div>{stats.gamesPlayed===0?<div className="relative z-10 flex-1 flex flex-col items-center justify-center text-amber-100/60 text-sm text-center px-4"><div className="text-4xl mb-3">♠</div><div>No games played yet.</div></div>:<div className="relative z-10 space-y-3 overflow-y-auto flex-1"><div className="grid grid-cols-2 gap-2"><Stat label="Games" value={stats.gamesPlayed}/><Stat label="Win %" value={`${wp}%`} sub={`${stats.wins}W - ${stats.losses}L`}/></div><div className="grid grid-cols-2 gap-2"><Stat label="Current Streak" value={stats.currentStreak===0?'—':(stats.currentStreak>0?`${stats.currentStreak}W`:`${Math.abs(stats.currentStreak)}L`)}/><Stat label="Best Streak" value={`${stats.bestWinStreak}W`}/></div><div className="grid grid-cols-2 gap-2"><Stat label="Bid %" value={`${bp}%`} sub={`${stats.bidsMade}/${stats.bidsMade+stats.bidsFailed}`}/><Stat label="Nils Made" value={stats.nilsAttempted>0?`${stats.nilsMade}/${stats.nilsAttempted}`:'—'} sub={stats.nilsAttempted>0?`${np}%`:'None'}/></div><div className="grid grid-cols-2 gap-2"><Stat label="Bostons" value={stats.bostons||0}/><Stat label="Best Comeback" value={stats.biggestComeback>0?`+${stats.biggestComeback}`:'—'}/></div></div>}</div>;};

// ============ MAIN APP ============
export default function SpadesApp() {
  const [profile,setProfile]=useState(null);
  const [stats,setStats]=useState(defaultStats());
  const [settings,setSettings]=useState(defaultSettings());
  const [achievements,setAchievements]=useState(defaultAchievementProgress());
  const [achievementToast,setAchievementToast]=useState(null);
  const [pendingAchievements,setPendingAchievements]=useState([]);
  const [showCreatePlayerCancellable,setShowCreatePlayerCancellable]=useState(false);
  const [appPhase,setAppPhase]=useState('loading');
  const [botProfiles,setBotProfiles]=useState([]);
  const [humanPeeked,setHumanPeeked]=useState(false);
  // NEW: deal animation state. 'in' = cards flying in from deck. null = no animation.
  const [dealAnim, setDealAnim] = useState(null);

  const initialGameState=()=>({phase:'bidding',hands:[[],[],[],[]],bids:[null,null,null,null],teamTricks:[0,0],indivTricks:[0,0,0,0],trick:[],leadSuit:null,spadesBroken:false,actor:0,dealer:3,scores:[0,0],bags:[0,0],roundNum:1,message:'',lastTrick:null,roundSummary:null,winnerTeam:null,statsRecorded:false,startingHand:[],gameLowestScore:0,exactBidsThisGame:0,bagsThisGame:0});

  const [gs,setGs]=useState(initialGameState);
  const gsRef=useRef(gs),settingsRef=useRef(settings),statsRef=useRef(stats),achievementsRef=useRef(achievements),timerRef=useRef(null),dealTimeoutRef=useRef(null);
  useEffect(()=>{gsRef.current=gs;},[gs]);
  useEffect(()=>{settingsRef.current=settings;},[settings]);
  useEffect(()=>{statsRef.current=stats;},[stats]);
  useEffect(()=>{achievementsRef.current=achievements;},[achievements]);

  const playSound=(k)=>{if(settingsRef.current.sound&&sounds[k])sounds[k]();};

  useEffect(() => {
    if (!achievementToast && pendingAchievements.length > 0) {
      const next = pendingAchievements[0];
      setAchievementToast(next);
      setPendingAchievements(pendingAchievements.slice(1));
      playSound('achievement');
    }
  }, [achievementToast, pendingAchievements]);

  useEffect(()=>{
    const load=async()=>{
      try{const r=await window.storage.get('player_profile');if(r?.value)setProfile(JSON.parse(r.value));}catch(e){}
      try{const r=await window.storage.get('player_stats');if(r?.value)setStats({...defaultStats(),...JSON.parse(r.value)});}catch(e){}
      try{const r=await window.storage.get('game_settings');if(r?.value){const loaded=JSON.parse(r.value);const merged={...defaultSettings(),...loaded};if(DECKS[merged.deck]?.locked)merged.deck='classic_red';setSettings(merged);}}catch(e){}
      try{const r=await window.storage.get('achievements');if(r?.value)setAchievements({...defaultAchievementProgress(),...JSON.parse(r.value)});}catch(e){}
      try{const r=await window.storage.get('player_profile');setAppPhase(r?.value?'menu':'createPlayer');}catch(e){setAppPhase('createPlayer');}
    };
    load();
  },[]);

  const saveProfile=async(p)=>{try{await window.storage.set('player_profile',JSON.stringify(p));}catch(e){}};
  const saveStats=async(s)=>{try{await window.storage.set('player_stats',JSON.stringify(s));}catch(e){}};
  const saveSettings=async(s)=>{try{await window.storage.set('game_settings',JSON.stringify(s));}catch(e){}};
  const saveAchievements=async(a)=>{try{await window.storage.set('achievements',JSON.stringify(a));}catch(e){}};

  const updateStatsAndCheckAchievements = (statsUpdater) => {
    setStats((current) => {
      const newStats = statsUpdater(current);
      saveStats(newStats);
      statsRef.current = newStats;
      const newlyUnlocked = checkAchievements(newStats, achievementsRef.current);
      if (newlyUnlocked.length > 0) {
        const newAch = { ...achievementsRef.current };
        newAch.unlocked = [...newAch.unlocked, ...newlyUnlocked];
        newAch.unlockedAt = { ...newAch.unlockedAt };
        const now = Date.now();
        newlyUnlocked.forEach(id => { newAch.unlockedAt[id] = now; });
        setAchievements(newAch);
        saveAchievements(newAch);
        achievementsRef.current = newAch;
        setPendingAchievements(prev => [...prev, ...newlyUnlocked]);
        setTimeout(() => {
          const recheck = checkAchievements(statsRef.current, achievementsRef.current);
          if (recheck.length > 0) {
            const final = { ...achievementsRef.current };
            final.unlocked = [...final.unlocked, ...recheck];
            recheck.forEach(id => { final.unlockedAt[id] = Date.now(); });
            setAchievements(final);
            saveAchievements(final);
            achievementsRef.current = final;
            setPendingAchievements(prev => [...prev, ...recheck]);
          }
        }, 100);
      }
      return newStats;
    });
  };

  const playerName=(idx)=>{if(idx===0)return profile?.name||'You';const b=botProfiles[idx===1?0:idx===2?1:2];return b?.name||['West','Partner','East'][idx-1];};
  const playerAvatar=(idx)=>{if(idx===0)return{avatar:profile?.avatar,photo:profile?.photo,name:profile?.name};const b=botProfiles[idx===1?0:idx===2?1:2];return b?{avatar:b.avatar,photo:b.photo,name:b.name}:{avatar:defaultAvatar(),photo:null,name:'Bot'};};

  // Trigger deal animation
  const triggerDealAnimation = (afterCallback) => {
    if (dealTimeoutRef.current) clearTimeout(dealTimeoutRef.current);
    setDealAnim('in');
    // Animation takes ~500ms: 100ms hold + 400ms fan out
    dealTimeoutRef.current = setTimeout(() => {
      setDealAnim(null);
      if (afterCallback) afterCallback();
    }, 600);
  };

  const advance=(event)=>{
    const state=gsRef.current,stg=settingsRef.current;let next={...state};
    if(event.type==='startRound'){
      const nh=deal(stg);const fb=(state.dealer+1)%4;setHumanPeeked(false);
      next={...next,phase:'bidding',hands:nh,bids:[null,null,null,null],teamTricks:[0,0],indivTricks:[0,0,0,0],trick:[],leadSuit:null,spadesBroken:false,actor:fb,lastTrick:null,roundSummary:null,startingHand:nh[0],message:`Round ${state.roundNum} — bidding begins`};
      gsRef.current=next;setGs(next);
      // Trigger deal animation, defer scheduleNext until after animation completes
      triggerDealAnimation(() => scheduleNext(gsRef.current));
      return;
    }
    else if(event.type==='bid'){const nb=[...state.bids];nb[event.player]=event.value;if(event.player===0)playSound('bidConfirm');const comp=nb.filter(b=>b!==null).length;if(comp===4){const ldr=(state.dealer+1)%4;next={...next,bids:nb,phase:'playing',actor:ldr,message:`${playerName(ldr)} leads`};}else{const na=(event.player+1)%4;const lbl=event.value===-1?'Blind Nil':event.value===0?'Nil':event.value;next={...next,bids:nb,actor:na,message:`${playerName(event.player)} bids ${lbl}`};}}
    else if(event.type==='play'){const nh=state.hands.map((h,i)=>i===event.player?h.filter(c=>c.id!==event.card.id):h);const nt=[...state.trick,{player:event.player,card:event.card}];const nls=nt.length===1?(event.card.isJoker?'♠':event.card.suit):state.leadSuit;const nb=state.spadesBroken||event.card.suit==='♠'||event.card.isJoker;playSound('cardPlay');const lbl=event.card.isJoker?(event.card.rank==='RJ'?'Red Joker':'Black Joker'):`${event.card.rank}${event.card.suit}`;if(nt.length===4){next={...next,hands:nh,trick:nt,leadSuit:nls,spadesBroken:nb,phase:'trickEnd',actor:-1,message:`${playerName(event.player)} plays ${lbl}`};}else{const na=(event.player+1)%4;next={...next,hands:nh,trick:nt,leadSuit:nls,spadesBroken:nb,actor:na,message:`${playerName(event.player)} plays ${lbl}`};}}
    else if(event.type==='resolveTrick'){const w=trickWinner(state.trick,state.leadSuit,stg);const ntt=[...state.teamTricks];ntt[teamOf(w)]+=1;const nit=[...state.indivTricks];nit[w]+=1;const he=state.hands.every(h=>h.length===0);if(teamOf(w)===0)playSound('trickWon');
      if(he){const r=computeRoundScore(state.bids,nit,ntt,state.bags,stg);const ns=[state.scores[0]+r.usPoints,state.scores[1]+r.themPoints];const tg=stg.scoreTarget;const go=ns[0]>=tg||ns[1]>=tg||ns[0]<=-200||ns[1]<=-200;const ubt=(state.bids[0]===0||state.bids[0]===-1?0:state.bids[0])+(state.bids[2]===0||state.bids[2]===-1?0:state.bids[2]);const tbt=(state.bids[1]===0||state.bids[1]===-1?0:state.bids[1])+(state.bids[3]===0||state.bids[3]===-1?0:state.bids[3]);const ubm=ntt[0]>=ubt;const tbm=ntt[1]>=tbt;const hbn=state.bids[0]===0||state.bids[0]===-1;const hmn=hbn&&nit[0]===0;const hBlindNil=state.bids[0]===-1&&nit[0]===0;const ov=Math.max(0,ntt[0]-ubt);const exactBid=ubm&&ntt[0]===ubt;
        const newLowest = Math.min(state.gameLowestScore, ns[0]);
        const newExactStreak = exactBid ? state.exactBidsThisGame + 1 : 0;
        const newBagsThisGame = state.bagsThisGame + ov;
        const isBoston = ntt[0]===13;
        const wasBagHit = (state.bags[0]+ov)>=stg.bagLimit;
        const hasBothJokers = stg.jokers && state.startingHand?.filter(c=>c.isJoker).length===2;
        updateStatsAndCheckAchievements(s=>({...s,roundsPlayed:s.roundsPlayed+1,bidsMade:s.bidsMade+(ubm?1:0),bidsFailed:s.bidsFailed+(ubm?0:1),nilsAttempted:s.nilsAttempted+(hbn?1:0),nilsMade:s.nilsMade+(hmn?1:0),blindNilsMade:s.blindNilsMade+(hBlindNil?1:0),totalBags:s.totalBags+ov,bestRoundScore:Math.max(s.bestRoundScore,r.usPoints),opponentsSet:s.opponentsSet+(!tbm&&tbt>0?1:0),bostons:s.bostons+(isBoston?1:0),bagPenaltiesTaken:s.bagPenaltiesTaken+(wasBagHit?1:0),exactBidStreak: Math.max(s.exactBidStreak, newExactStreak),bothJokers: s.bothJokers + (hasBothJokers?1:0)}));
        next={...next,teamTricks:ntt,indivTricks:nit,lastTrick:state.trick,trick:[],leadSuit:null,scores:ns,bags:[r.usNewBags,r.themNewBags],roundSummary:{usBid:r.usBid,themBid:r.themBid,usTricks:ntt[0],themTricks:ntt[1],usPoints:r.usPoints,themPoints:r.themPoints},phase:go?'gameEnd':'roundEnd',winnerTeam:go?(ns[0]>ns[1]?0:1):null,actor:-1,message:`${playerName(w)} wins the trick`,gameLowestScore:newLowest,exactBidsThisGame:newExactStreak,bagsThisGame:newBagsThisGame};
        if(go&&!state.statsRecorded){const won=ns[0]>ns[1];if(won)playSound('victory');else playSound('defeat');const margin = Math.abs(ns[0]-ns[1]);const wonByOne = won && margin === 1;const comeback = won ? Math.max(0, -newLowest + ns[0]) : 0;const wonFromNeg = won && newLowest <= -100;const cleanGame = won && newBagsThisGame === 0;const winTier = won ? stg.scoreTarget : null;updateStatsAndCheckAchievements(s=>{const nst=won?Math.max(1,s.currentStreak+1):Math.min(-1,s.currentStreak-1);const newWinsByTier = { ...(s.winsByTier || {}) };if (winTier) newWinsByTier[winTier] = (newWinsByTier[winTier] || 0) + 1;return {...s,gamesPlayed:s.gamesPlayed+1,wins:s.wins+(won?1:0),losses:s.losses+(won?0:1),currentStreak:nst,bestWinStreak:Math.max(s.bestWinStreak,nst>0?nst:0),worstLossStreak:Math.max(s.worstLossStreak,nst<0?-nst:0),highestGameScore:Math.max(s.highestGameScore,ns[0]),biggestComeback: Math.max(s.biggestComeback, comeback),wonByOne: s.wonByOne + (wonByOne?1:0),cleanGames: s.cleanGames + (cleanGame?1:0),wonFromNegative: s.wonFromNegative + (wonFromNeg?1:0),winsByTier: newWinsByTier};});next.statsRecorded=true;}
      } else { next={...next,teamTricks:ntt,indivTricks:nit,lastTrick:state.trick,trick:[],leadSuit:null,phase:'playing',actor:w,message:`${playerName(w)} wins the trick`}; }
    }
    else if(event.type==='nextRound'){
      const nd=(state.dealer+1)%4;const nr=state.roundNum+1;const nh=deal(stg);const fb=(nd+1)%4;setHumanPeeked(false);
      next={...next,dealer:nd,roundNum:nr,hands:nh,bids:[null,null,null,null],teamTricks:[0,0],indivTricks:[0,0,0,0],trick:[],leadSuit:null,spadesBroken:false,phase:'bidding',actor:fb,lastTrick:null,roundSummary:null,startingHand:nh[0],message:`Round ${nr} — bidding begins`};
      gsRef.current=next;setGs(next);
      triggerDealAnimation(() => scheduleNext(gsRef.current));
      return;
    }
    gsRef.current=next;setGs(next);scheduleNext(next);
  };

  const scheduleNext=(state)=>{
    if(timerRef.current)clearTimeout(timerRef.current);
    // Don't schedule actions during deal animation
    if (dealAnim === 'in') return;
    const stg=settingsRef.current;
    if(state.phase==='trickEnd')timerRef.current=setTimeout(()=>advance({type:'resolveTrick'}),1200);
    else if(state.phase==='bidding'&&state.actor!==0)timerRef.current=setTimeout(()=>{const s=gsRef.current;if(s.phase!=='bidding')return;advance({type:'bid',player:s.actor,value:botBid(s.hands[s.actor],stg,stg.botDifficulty)});},800);
    else if(state.phase==='playing'&&state.actor!==0&&state.actor!==-1)timerRef.current=setTimeout(()=>{const s=gsRef.current;if(s.phase!=='playing')return;advance({type:'play',player:s.actor,card:botPlay(s.hands[s.actor],s.trick,s.leadSuit,s.spadesBroken,s.actor,s.bids,s.teamTricks,s.indivTricks,stg,stg.botDifficulty)});},800);
  };

  const startGame=()=>{if(timerRef.current)clearTimeout(timerRef.current);if(dealTimeoutRef.current)clearTimeout(dealTimeoutRef.current);const nb=randomNames(3,[profile.name]).map(n=>({name:n,avatar:randomAvatar(),photo:null}));setBotProfiles(nb);const fresh=initialGameState();gsRef.current=fresh;setGs(fresh);setAppPhase('inGame');setDealAnim(null);setTimeout(()=>advance({type:'startRound'}),50);};
  const onHumanBid=(v)=>{if(gsRef.current.phase==='bidding'&&gsRef.current.actor===0&&!dealAnim)advance({type:'bid',player:0,value:v});};
  const onHumanBlindNil=()=>{if(gsRef.current.phase==='bidding'&&gsRef.current.actor===0&&!dealAnim)advance({type:'bid',player:0,value:-1});};
  const onHumanPlay=(c)=>{const s=gsRef.current,stg=settingsRef.current;if(s.phase!=='playing'||s.actor!==0||dealAnim)return;const legal=legalPlays(s.hands[0],s.leadSuit,s.spadesBroken,stg);if(!legal.find(cc=>cc.id===c.id))return;advance({type:'play',player:0,card:c});};
  const onNextRound=()=>advance({type:'nextRound'});
  const onExit=()=>{if(timerRef.current)clearTimeout(timerRef.current);if(dealTimeoutRef.current)clearTimeout(dealTimeoutRef.current);setDealAnim(null);setAppPhase('menu');};

  if(appPhase==='loading')return <div className="min-h-screen flex items-center justify-center" style={{background:'#0d2818'}}><div className="text-amber-200 text-3xl animate-pulse">♠</div></div>;
  if(appPhase==='createPlayer')return <CreatePlayerScreen existingProfile={profile} onConfirm={(p)=>{setProfile(p);saveProfile(p);setShowCreatePlayerCancellable(false);setAppPhase('menu');}} onCancel={showCreatePlayerCancellable?()=>{setShowCreatePlayerCancellable(false);setAppPhase('menu');}:null}/>;
  if(appPhase==='stats')return <StatsScreen stats={stats} profile={profile} theme={settings.theme} onBack={()=>setAppPhase('menu')}/>;
  if(appPhase==='achievements')return <AchievementsScreen progress={achievements} stats={stats} theme={settings.theme} onBack={()=>setAppPhase('menu')}/>;
  if(appPhase==='settings')return <SettingsScreen settings={settings} onSave={(s)=>{setSettings(s);saveSettings(s);setAppPhase('menu');}} onBack={()=>setAppPhase('menu')}/>;

  const currentTheme=THEMES[settings.theme]||THEMES.felt;
  const currentDeck=DECKS[settings.deck]||DECKS.classic_red;

  if(appPhase==='menu'){
    return <div className="min-h-screen flex flex-col items-center justify-center px-6 relative" style={{background:currentTheme.background,fontFamily:"'Playfair Display', Georgia, serif"}}>
      <HolodeckGrid theme={settings.theme}/>
      <AchievementToast achievement={achievementToast} onDismiss={()=>setAchievementToast(null)}/>
      <div className="relative z-10 text-center mb-6"><div className="text-6xl mb-2" style={{color:currentTheme.headerColor}}>♠</div><h1 className="text-4xl font-bold mb-1" style={{color:currentTheme.primaryText,letterSpacing:'0.05em'}}>OG SPADES</h1><div className="text-xs tracking-widest uppercase" style={{color:currentTheme.tertiaryText}}>Partners · First to {settings.scoreTarget}</div></div>
      <div className="relative z-10 bg-stone-900/60 backdrop-blur rounded-lg p-4 mb-4 border flex items-center gap-3 min-w-[240px]" style={{borderColor:`rgba(${currentTheme.accentRgb},0.3)`}}>
        <AvatarSVG avatar={profile?.avatar} photo={profile?.photo} name={!profile?.avatar&&!profile?.photo?profile?.name:null} size={56}/>
        <div className="flex-1">
          <div className="font-bold text-lg" style={{color:currentTheme.primaryText}}>{profile?.name}</div>
          <div className="flex gap-2 text-xs flex-wrap">
            <button onClick={()=>{setShowCreatePlayerCancellable(true);setAppPhase('createPlayer');}} className="underline" style={{color:currentTheme.tertiaryText}}>Edit</button>
            <button onClick={()=>setAppPhase('stats')} className="underline" style={{color:currentTheme.tertiaryText}}>Stats</button>
            <button onClick={()=>setAppPhase('achievements')} className="underline" style={{color:currentTheme.tertiaryText}}>🏆 {achievements.unlocked.length}</button>
            <button onClick={()=>setAppPhase('settings')} className="underline" style={{color:currentTheme.tertiaryText}}>Settings</button>
          </div>
        </div>
      </div>
      <div className="relative z-10 mb-4 flex flex-col gap-3 items-center">
        <div><div className="text-[10px] uppercase tracking-widest text-center mb-1" style={{color:currentTheme.tertiaryText}}>Table</div><RolodexSpinner items={themeItems} value={settings.theme} onChange={(v)=>{const ns={...settings,theme:v};setSettings(ns);saveSettings(ns);}} size="compact"/></div>
        <div><div className="text-[10px] uppercase tracking-widest text-center mb-1" style={{color:currentTheme.tertiaryText}}>Deck</div><RolodexSpinner items={deckItems} value={settings.deck} onChange={(v)=>{if(DECKS[v]?.locked)return;const ns={...settings,deck:v};setSettings(ns);saveSettings(ns);}} size="compact"/></div>
      </div>
      {stats.gamesPlayed>0&&<div className="relative z-10 text-xs mb-4" style={{color:currentTheme.tertiaryText}}>{stats.wins}W · {stats.losses}L{stats.currentStreak!==0&&<span className="ml-2">· {stats.currentStreak>0?`🔥 ${stats.currentStreak}W streak`:`${Math.abs(stats.currentStreak)}L streak`}</span>}</div>}
      <button onClick={startGame} className={`relative z-10 px-12 py-3 ${currentTheme.primaryBtn} text-stone-900 font-bold rounded shadow-xl tracking-wider uppercase text-sm transition-all hover:scale-105`}>Deal Cards</button>
    </div>;
  }

  const PlayerSeat=({player,compact})=>{const ic=gs.actor===player&&(gs.phase==='bidding'||gs.phase==='playing')&&!dealAnim;const ip=teamOf(player)===0;const ib=player!==0;const{avatar,photo,name}=playerAvatar(player);const db=gs.bids[player]===-1?'BN':gs.bids[player]===0?'Nil':gs.bids[player];const showStreak=player===0&&stats.currentStreak>=3;return <div className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded transition-all ${ic?'bg-amber-500/30 ring-1 ring-amber-400':''}`}><AvatarSVG avatar={avatar} photo={photo} name={!avatar&&!photo?name:null} size={compact?30:36}/><div className="flex items-center gap-1"><div className={`text-[10px] uppercase tracking-wider font-bold ${ip?'text-emerald-200':'text-rose-200'}`}>{playerName(player)}</div>{ib&&<span className="text-[8px] bg-stone-700 text-amber-200/80 px-1 rounded font-bold tracking-wider">CPU</span>}{showStreak&&<span className="text-[9px]" title={`${stats.currentStreak} win streak`}>🔥{stats.currentStreak}</span>}</div><div className="flex gap-1.5 text-[10px]" style={{color:currentTheme.tertiaryText}}>{gs.bids[player]!==null&&<span><span className="opacity-70">Bid</span> <span className="font-bold" style={{color:currentTheme.secondaryText}}>{db}</span></span>}{(gs.phase==='playing'||gs.phase==='trickEnd'||gs.phase==='roundEnd')&&<span><span className="opacity-70">Won</span> <span className="font-bold" style={{color:currentTheme.secondaryText}}>{gs.indivTricks[player]}</span></span>}</div></div>;};

  const trickToShow=gs.phase==='trickEnd'?gs.trick:(gs.lastTrick&&gs.trick.length===0?gs.lastTrick:gs.trick);
  const getTrickCard=(p)=>{const f=trickToShow.find(t=>t.player===p);return f?f.card:null;};
  const blindNilEligible=settings.allowBlindNil&&gs.phase==='bidding'&&gs.actor===0&&gs.bids[0]===null&&!humanPeeked&&!dealAnim;
  const displayedHand=blindNilEligible?[]:gs.hands[0];
  const humanLegal=gs.phase==='playing'&&gs.actor===0?legalPlays(gs.hands[0],gs.leadSuit,gs.spadesBroken,settings):[];
  const legalIds=new Set(humanLegal.map(c=>c.id));

  return <GameScreen gs={gs} settings={settings} theme={currentTheme} deck={currentDeck} PlayerSeat={PlayerSeat} getTrickCard={getTrickCard} legalIds={legalIds} onHumanBid={onHumanBid} onHumanBlindNil={onHumanBlindNil} onHumanPeek={()=>setHumanPeeked(true)} onHumanPlay={onHumanPlay} onNextRound={onNextRound} onExit={onExit} onPlayAgain={startGame} onBackToMenu={()=>setAppPhase('menu')} blindNilEligible={blindNilEligible} displayedHand={displayedHand} achievementToast={achievementToast} setAchievementToast={setAchievementToast} dealAnim={dealAnim}/>;
}

const GameScreen=({gs,settings,theme,deck,PlayerSeat,getTrickCard,legalIds,onHumanBid,onHumanBlindNil,onHumanPeek,onHumanPlay,onNextRound,onExit,onPlayAgain,onBackToMenu,blindNilEligible,displayedHand,achievementToast,setAchievementToast,dealAnim})=>{
  const [showExitConfirm,setShowExitConfirm]=useState(false);
  const isDealing = dealAnim === 'in';
  return <div className="min-h-screen flex flex-col relative" style={{background:theme.background,fontFamily:"'Playfair Display', Georgia, serif"}}>
    <HolodeckGrid theme={settings.theme}/>
    <AchievementToast achievement={achievementToast} onDismiss={()=>setAchievementToast(null)}/>
    <div className="relative z-10 flex justify-between items-center px-3 py-2 bg-black/40 backdrop-blur border-b" style={{borderColor:`rgba(${theme.accentRgb},0.2)`}}>
      <button onClick={()=>setShowExitConfirm(true)} className="text-xs px-2 py-1 rounded bg-stone-800/60 hover:bg-stone-700" style={{color:theme.secondaryText}}>✕ Exit</button>
      <div className="flex items-center gap-4">
        <div className="text-center"><div className="text-[10px] uppercase tracking-widest text-emerald-300/80">Us</div><div className="text-lg font-bold leading-none" style={{color:theme.primaryText}}>{gs.scores[0]}</div><div className="text-[9px]" style={{color:theme.tertiaryText}}>Bags: {gs.bags[0]}/{settings.bagLimit}</div></div>
        <div className="text-center px-1"><div className="text-[10px] uppercase tracking-widest" style={{color:theme.tertiaryText}}>R{gs.roundNum}</div><div className="text-[10px]" style={{color:theme.tertiaryText}}>{gs.teamTricks[0]}–{gs.teamTricks[1]}</div><div className="text-[9px] opacity-60" style={{color:theme.tertiaryText}}>to {settings.scoreTarget}</div></div>
        <div className="text-center"><div className="text-[10px] uppercase tracking-widest text-rose-300/80">Them</div><div className="text-lg font-bold leading-none" style={{color:theme.primaryText}}>{gs.scores[1]}</div><div className="text-[9px]" style={{color:theme.tertiaryText}}>Bags: {gs.bags[1]}/{settings.bagLimit}</div></div>
      </div>
      <div className="w-12"/>
    </div>
    <div className="relative z-10 flex justify-center pt-1"><PlayerSeat player={2}/></div>
    <div className="relative z-10 flex-1 flex items-center justify-center px-2 min-h-[180px]">
      <div className="absolute left-1 top-1/2 -translate-y-1/2"><PlayerSeat player={1} compact/></div>
      <div className="absolute right-1 top-1/2 -translate-y-1/2"><PlayerSeat player={3} compact/></div>
      <OpponentHandDeal deck={deck} dealAnim={dealAnim} side="top"/>
      <OpponentHandDeal deck={deck} dealAnim={dealAnim} side="left"/>
      <OpponentHandDeal deck={deck} dealAnim={dealAnim} side="right"/>
      <div className="relative w-48 h-48 rounded-full flex items-center justify-center" style={{background:theme.cardCircle,border:`1px solid ${theme.cardCircleBorder}`,boxShadow:settings.theme==='holodeck'?`inset 0 0 20px rgba(${theme.accentRgb},0.15)`:'none'}}>
        <DeckStack deck={deck} visible={isDealing}/>
        <div className="absolute top-1"><TableCard card={getTrickCard(2)} deck={deck}/></div>
        <div className="absolute bottom-1"><TableCard card={getTrickCard(0)} deck={deck}/></div>
        <div className="absolute left-1"><TableCard card={getTrickCard(1)} deck={deck}/></div>
        <div className="absolute right-1"><TableCard card={getTrickCard(3)} deck={deck}/></div>
        {gs.trick.length===0&&gs.phase==='playing'&&!isDealing&&<div className="text-[10px] text-center px-4" style={{color:theme.tertiaryText}}>{gs.spadesBroken?'Spades broken':'Spades not broken'}</div>}
      </div>
    </div>
    <div className="relative z-10 text-center text-xs py-1 px-4 italic min-h-[1.25rem]" style={{color:theme.primaryText}}>{isDealing ? 'Dealing...' : gs.message}</div>
    <div className="relative z-10 pb-8">
      <div className="flex justify-center mb-2"><PlayerSeat player={0} compact/></div>
      {gs.phase==='bidding'&&gs.actor===0&&!isDealing&&<div className="px-4 mb-3"><BidSelector onBid={onHumanBid} allowBlindNil={settings.allowBlindNil} hasPeeked={!blindNilEligible} onPeek={onHumanPeek} onBlindNil={onHumanBlindNil}/></div>}
      <div className="mb-3"><FannedHand hand={displayedHand} playableIds={legalIds} onPlay={onHumanPlay} disabled={gs.phase!=='playing'||gs.actor!==0||isDealing} deck={deck} dealAnim={dealAnim}/></div>
    </div>
    {showExitConfirm&&<div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center px-6 z-50"><div className="bg-stone-900 border border-amber-700/50 rounded-lg p-5 max-w-sm w-full shadow-2xl"><h3 className="text-lg font-bold text-amber-200 mb-2 text-center">Leave Game?</h3><p className="text-amber-100/70 text-sm text-center mb-4">This game will end. It will count as a loss.</p><div className="flex gap-2"><button onClick={()=>setShowExitConfirm(false)} className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 text-amber-100 font-bold rounded text-sm">Keep Playing</button><button onClick={()=>{setShowExitConfirm(false);onExit();}} className="flex-1 py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded text-sm">Exit to Menu</button></div></div></div>}
    {gs.phase==='roundEnd'&&gs.roundSummary&&<div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center px-6 z-50"><div className="bg-stone-900 border border-amber-700/50 rounded-lg p-6 max-w-sm w-full shadow-2xl"><h2 className="text-2xl font-bold text-amber-200 mb-4 text-center">Round {gs.roundNum} Complete</h2><div className="space-y-3 text-amber-100"><div className="flex justify-between border-b border-amber-900/30 pb-2 text-sm"><span className="text-emerald-300">Us</span><span>Bid {gs.roundSummary.usBid} · Won {gs.roundSummary.usTricks}</span><span className={gs.roundSummary.usPoints>=0?'text-amber-200':'text-rose-400'}>{gs.roundSummary.usPoints>0?'+':''}{gs.roundSummary.usPoints}</span></div><div className="flex justify-between border-b border-amber-900/30 pb-2 text-sm"><span className="text-rose-300">Them</span><span>Bid {gs.roundSummary.themBid} · Won {gs.roundSummary.themTricks}</span><span className={gs.roundSummary.themPoints>=0?'text-amber-200':'text-rose-400'}>{gs.roundSummary.themPoints>0?'+':''}{gs.roundSummary.themPoints}</span></div><div className="flex justify-between pt-2"><span className="font-bold">Total</span><span></span><span className="font-bold text-amber-200">{gs.scores[0]} – {gs.scores[1]}</span></div></div><button onClick={onNextRound} className="w-full mt-5 py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wider text-sm">Deal Next Round</button><button onClick={()=>setShowExitConfirm(true)} className="w-full mt-2 py-2 text-amber-300/70 text-xs underline">Exit to menu</button></div></div>}
    {gs.phase==='gameEnd'&&<div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center px-6 z-50"><div className="bg-stone-900 border border-amber-700/50 rounded-lg p-8 max-w-sm w-full shadow-2xl text-center"><div className="text-6xl mb-3">{gs.winnerTeam===0?'♠':'♣'}</div><h2 className="text-3xl font-bold text-amber-200 mb-2">{gs.winnerTeam===0?'Victory':'Defeat'}</h2><div className="text-amber-100 mb-6">Final: <span className="font-bold">{gs.scores[0]}</span> – <span className="font-bold">{gs.scores[1]}</span></div><button onClick={onPlayAgain} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wider text-sm">Play Again</button><button onClick={onBackToMenu} className="w-full mt-2 py-2 text-amber-300/70 text-xs underline">Back to menu</button></div></div>}
  </div>;
};
