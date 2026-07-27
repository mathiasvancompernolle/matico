import React, { useState, useEffect, useRef } from 'react';
import kapitasLogo from '../assets/kapitas-logo.png';

export default function Landing({ onNaarApp, onPrivacybeleid }) {
  const [faqOpen, setFaqOpen] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.l-animate').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const toggleFaq = (i) => setFaqOpen(faqOpen === i ? null : i);

  const faqs = [
    ['Is Kapitas veilig? Worden mijn gegevens gedeeld?',
     'Kapitas slaat enkel de gegevens op die je zelf invoert. We verkopen nooit je data aan derden. Je portefeuillegegevens worden versleuteld opgeslagen en zijn enkel voor jou zichtbaar.'],
    ['Werkt Kapitas met mijn broker (Saxo, Bolero, Degiro)?',
     'Ja! Kapitas werkt met alle Belgische en Europese brokers. Je voert je posities manueel in met aankoopprijs en datum. Automatische koppeling via broker-API is in ontwikkeling.'],
    ['Zijn de belastingberekeningen correct en up-to-date?',
     'De belastingregels zijn gebaseerd op de Belgische fiscale wetgeving voor aanslagjaar 2025-2026, inclusief de nieuwe meerwaardebelasting van 10%. Let op: Kapitas biedt geen fiscaal advies.'],
    ['Kan ik annuleren wanneer ik wil?',
     'Ja, je kan je abonnement op elk moment opzeggen. Je behoudt toegang tot het einde van de betaalde periode. Geen verborgen kosten of annuleringsvergoedingen.'],
    ['Hoe nauwkeurig zijn de live koersen?',
     'Koersen worden live bijgewerkt tijdens beursuren. Europese beurzen worden elke minuut bijgewerkt. Buiten beursuren tonen we de laatste slotkoers.'],
    ['Is er een mobiele app?',
     'Kapitas is volledig mobiel-responsive en werkt uitstekend in je mobiele browser. Een native iOS en Android app is gepland voor later dit jaar.'],
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: '#0f172a', background: '#fff', lineHeight: 1.6 }}>
      <style>{`
        .l-btn { display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all 0.2s; }
        .l-btn-primary { background:#1e3a8a;color:white; }
        .l-btn-primary:hover { background:#14275e;transform:translateY(-2px);box-shadow:0 8px 20px rgba(30,58,138,0.35); }
        .l-btn-outline { background:white;color:#1e3a8a;border:2px solid #1e3a8a; }
        .l-btn-outline:hover { background:#1e3a8a;color:white; }
        .l-btn-white { background:white;color:#1e3a8a; }
        .l-btn-white:hover { background:#f8fafc;transform:translateY(-1px); }
        .l-btn-ghost-white { background:rgba(255,255,255,0.15);color:white;border:1.5px solid rgba(255,255,255,0.4); }
        .l-btn-ghost-white:hover { background:rgba(255,255,255,0.25); }
        .l-section-label { display:inline-block;background:#eef1f8;color:#1e3a8a;padding:4px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:14px; }
        .l-feature-card { background:white;border:1px solid #e2e8f0;border-radius:12px;padding:28px;transition:box-shadow 0.2s,transform 0.2s; }
        .l-feature-card:hover { box-shadow:0 20px 60px rgba(0,0,0,0.1);transform:translateY(-4px); }
        .l-pricing-card { background:white;border:1px solid #e2e8f0;border-radius:16px;padding:32px;position:relative; }
        .l-pricing-popular { border:2px solid #1e3a8a;box-shadow:0 0 0 4px rgba(30,58,138,0.08); }
        .l-check { color:#22c55e;font-size:15px;flex-shrink:0; }
        .l-cross { color:#cbd5e1;font-size:15px;flex-shrink:0; }
        .l-faq-item { background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:10px;overflow:hidden; }
        .l-faq-q { padding:18px 20px;font-size:15px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none; }
        .l-faq-a { padding:0 20px 16px;font-size:14px;color:#64748b;line-height:1.7; }
        .l-mockup-bar { flex:1;border-radius:3px 3px 0 0;background:linear-gradient(180deg,#1e3a8a,#3b5998);opacity:0.8; }
        @media(max-width:768px){
          .l-hide-mobile{display:none!important;}
          .l-col-2{grid-template-columns:1fr!important;}
          .l-hero-actions{flex-direction:column;align-items:center;}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:'sticky',top:0,zIndex:100,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(12px)',borderBottom:'1px solid #e2e8f0',padding:'0 24px',height:64,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
        <img src={kapitasLogo} alt="Kapitas" style={{ height: 40, width: 'auto', display: 'block' }} />
        <ul className="l-hide-mobile" style={{ display:'flex',gap:32,listStyle:'none' }}>
          {['#features','#hoe-werkt-het','#belgisch','#prijzen','#faq'].map((h,i) => (
            <li key={i}><a href={h} style={{ textDecoration:'none',color:'#64748b',fontSize:14,fontWeight:500 }}>{['Features','Hoe werkt het','Belgisch','Prijzen','FAQ'][i]}</a></li>
          ))}
        </ul>
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={onNaarApp} className="l-btn" style={{ background:'none',color:'#64748b',fontSize:14 }}>Inloggen</button>
          <button onClick={onNaarApp} className="l-btn l-btn-primary" style={{ fontSize:14,padding:'9px 18px' }}>Probeer gratis →</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight:'90vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'80px 24px 60px',background:'linear-gradient(180deg,#eef1f8 0%,#f8fafc 60%,white 100%)',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-200,left:'50%',transform:'translateX(-50%)',width:800,height:800,borderRadius:'50%',background:'radial-gradient(circle,rgba(30,58,138,0.08) 0%,transparent 70%)',pointerEvents:'none' }} />
        
        <div style={{ display:'inline-flex',alignItems:'center',gap:8,background:'white',border:'1px solid #e2e8f0',padding:'6px 16px',borderRadius:100,fontSize:13,fontWeight:500,color:'#64748b',marginBottom:28,boxShadow:'0 4px 12px rgba(0,0,0,0.06)' }}>
          <span style={{ width:8,height:8,borderRadius:'50%',background:'#22c55e',display:'inline-block',animation:'pulse 2s infinite' }} />
          Speciaal gebouwd voor Belgische beleggers
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

        <h1 style={{ fontSize:'clamp(36px,6vw,66px)',fontWeight:800,letterSpacing:'-2px',lineHeight:1.1,marginBottom:24,maxWidth:780 }}>
          Je beleggingen.<br />Eindelijk <span style={{ color:'#1e3a8a' }}>overzichtelijk</span>.
        </h1>
        <p style={{ fontSize:'clamp(16px,2vw,19px)',color:'#64748b',maxWidth:540,marginBottom:40,lineHeight:1.7 }}>
          Kapitas bundelt je portfolio, ETFs en aandelen in één slim dashboard. Met automatische Belgische belastingberekeningen, live koersen en AI-analyses.
        </p>
        <div className="l-hero-actions" style={{ display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center',marginBottom:14 }}>
          <button onClick={onNaarApp} className="l-btn l-btn-primary" style={{ fontSize:17,padding:'16px 36px',borderRadius:12 }}>Start gratis — 14 dagen ✦</button>
          <a href="#features" className="l-btn l-btn-outline" style={{ fontSize:17,padding:'16px 36px',borderRadius:12 }}>Bekijk features</a>
        </div>
        <p style={{ fontSize:13,color:'#94a3b8' }}>
          <span style={{ color:'#22c55e',fontWeight:600 }}>✓</span> Geen betaalgegevens nodig &nbsp;·&nbsp;
          <span style={{ color:'#22c55e',fontWeight:600 }}>✓</span> 14 dagen gratis &nbsp;·&nbsp;
          <span style={{ color:'#22c55e',fontWeight:600 }}>✓</span> Annuleer altijd
        </p>

        {/* Dashboard Mockup */}
        <div style={{ marginTop:64,maxWidth:900,width:'100%',position:'relative' }}>
          <div style={{ position:'absolute',top:20,left:'50%',transform:'translateX(-50%)',width:'80%',height:'80%',borderRadius:'50%',background:'radial-gradient(circle,rgba(30,58,138,0.12) 0%,transparent 70%)',filter:'blur(40px)',pointerEvents:'none' }} />
          <div style={{ background:'white',borderRadius:16,boxShadow:'0 32px 80px rgba(0,0,0,0.14),0 0 0 1px rgba(0,0,0,0.05)',overflow:'hidden',position:'relative' }}>
            {/* Browser bar */}
            <div style={{ background:'#f1f5f9',padding:'12px 16px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid #e2e8f0' }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width:12,height:12,borderRadius:'50%',background:c }} />)}
              <div style={{ flex:1,background:'white',borderRadius:6,padding:'4px 12px',fontSize:12,color:'#94a3b8',border:'1px solid #e2e8f0',margin:'0 12px',textAlign:'left' }}>kapitas.be/dashboard</div>
            </div>
            {/* Screen */}
            <div style={{ display:'grid',gridTemplateColumns:'220px 1fr',height:400,background:'#f8fafc' }}>
              {/* Sidebar mockup */}
              <div className="l-hide-mobile" style={{ background:'white',borderRight:'1px solid #e2e8f0',padding:'20px 12px',display:'flex',flexDirection:'column',gap:4 }}>
                <div style={{ fontSize:18,fontWeight:800,color:'#1e3a8a',padding:'0 8px 20px',letterSpacing:'-0.5px' }}>Kapitas</div>
                {[['Dashboard',true],['Portfolio',false],['Markten',false],['ETFs',false],['Belastingen',false],['Dividend',false]].map(([naam,actief]) => (
                  <div key={naam} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,fontSize:13,fontWeight:actief?600:500,color:actief?'#1e3a8a':'#64748b',background:actief?'#eef1f8':'none' }}>
                    <div style={{ width:16,height:16,borderRadius:actief?'50%':4,background:actief?'#1e3a8a':'#94a3b8',opacity:actief?1:0.4,flexShrink:0 }} />
                    {naam}
                  </div>
                ))}
              </div>
              {/* Content mockup */}
              <div style={{ padding:20,overflow:'hidden' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:15,fontWeight:700 }}>Welkom terug 👋</div>
                    <div style={{ fontSize:12,color:'#94a3b8' }}>Jouw portefeuille vandaag</div>
                  </div>
                  <div style={{ fontSize:11,color:'#94a3b8' }}>ma 14 jul 2026</div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14 }}>
                  {[['Totale waarde','€24.847','▲ +3,14% YTD','#22c55e'],['Vandaag','+€312','▲ +1,27%','#22c55e'],['Meerwaardebel.','€847','⚠ Verschuldigd','#f59e0b']].map(([l,v,c,col]) => (
                    <div key={l} style={{ background:'white',borderRadius:10,padding:12,border:'1px solid #e2e8f0' }}>
                      <div style={{ fontSize:10,color:'#94a3b8',marginBottom:4 }}>{l}</div>
                      <div style={{ fontSize:16,fontWeight:700 }}>{v}</div>
                      <div style={{ fontSize:10,fontWeight:600,color:col,marginTop:2 }}>{c}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:10 }}>
                  <div style={{ background:'white',borderRadius:10,padding:12,border:'1px solid #e2e8f0' }}>
                    <div style={{ fontSize:11,fontWeight:600,color:'#64748b',marginBottom:8 }}>Portefeuille evolutie (1J)</div>
                    <div style={{ display:'flex',alignItems:'flex-end',gap:3,height:60 }}>
                      {[35,45,40,55,50,65,58,72,68,80,75,100].map((h,i) => (
                        <div key={i} className="l-mockup-bar" style={{ height:`${h}%` }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ background:'white',borderRadius:10,border:'1px solid #e2e8f0',overflow:'hidden' }}>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 70px 50px',padding:'7px 10px',background:'#f8fafc',fontSize:9,fontWeight:600,color:'#94a3b8',borderBottom:'1px solid #e2e8f0' }}>
                      <span>Positie</span><span>Koers</span><span>%</span>
                    </div>
                    {[['ETF','VWCE','€138,42','+1,2%','#22c55e'],['ETF','IWDA','€98,15','+0,8%','#22c55e'],['EQ','ABI','€54,30','-0,4%','#ef4444'],['EQ','KBC','€71,80','+2,1%','#22c55e']].map(([type,naam,koers,pct,col]) => (
                      <div key={naam} style={{ display:'grid',gridTemplateColumns:'1fr 70px 50px',padding:'6px 10px',fontSize:11,borderBottom:'1px solid #f1f5f9',alignItems:'center' }}>
                        <span style={{ fontWeight:500 }}>
                          <span style={{ background:type==='ETF'?'#eef1f8':'#fef3c7',color:type==='ETF'?'#1e3a8a':'#d97706',padding:'1px 5px',borderRadius:4,fontSize:9,fontWeight:700,marginRight:4 }}>{type}</span>
                          {naam}
                        </span>
                        <span style={{ fontSize:10 }}>{koers}</span>
                        <span style={{ fontWeight:600,color:col,fontSize:10 }}>{pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div style={{ background:'#1e3a8a',padding:'48px 24px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:32,textAlign:'center' }}>
        {[['270+','Belgische & Europese ETFs'],['3','BEL indices (20, Mid, Small)'],['100%','Belgische belastingregels 2026'],['Live','Koersen tijdens beursuren']].map(([v,l]) => (
          <div key={l}>
            <div style={{ fontSize:40,fontWeight:800,color:'white',lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:13,color:'rgba(255,255,255,0.75)',marginTop:6 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding:'96px 24px',maxWidth:1100,margin:'0 auto' }}>
        <div className="l-section-label">Features</div>
        <h2 style={{ fontSize:'clamp(28px,4vw,42px)',fontWeight:800,letterSpacing:'-1px',lineHeight:1.2,marginBottom:16 }}>Alles wat je nodig hebt<br />als Belgische belegger</h2>
        <p style={{ fontSize:17,color:'#64748b',maxWidth:540,lineHeight:1.7 }}>Geen generieke tool die niet past bij de Belgische markt. Kapitas is van bij het begin gebouwd voor beleggers in België.</p>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:24,marginTop:56 }}>
          {[
            ['📊','Portfolio tracker','Voeg al je posities toe en volg je totale portefeuillewaarde, rendement en spreiding in real-time. Ondersteunt aandelen, ETFs en obligaties.','Meerdere brokers','#eef1f8',null],
            ['🇧🇪','Belgische belastingen','Automatische berekening van de meerwaardebelasting (10%), Reynders-taks, beurstaks (TOB) en roerende voorheffing. Volledig up-to-date voor 2025-2026.','Uniek Belgisch','#fef3c7','belgisch'],
            ['📈','Live marktdata','Volg de BEL20, BEL Mid- en Smallcap in real-time. Met grafieken, koershistoriek en marktoverzichten per regio.','Euronext Brussel','#f0fdf4',null],
            ['🔍','ETF vergelijker','Vergelijk 270+ Europese ETFs op TER, beurstaks, dividend en rendement. Gesynchroniseerd met de Saxo Investor catalogus.','270+ ETFs','#fdf4ff','nieuw'],
            ['💰','Dividend tracking','Volg ontvangen dividenden, bereken je netto ontvangst na roerende voorheffing en plan toekomstige uitkeringen.','Automatisch berekend','#fff7ed',null],
            ['🤖','AI-analyses','Krijg een AI-gestuurde analyse per aandeel of ETF op basis van actuele koersdata, nieuws en financiële metrics.','Powered by AI','#f0f9ff','nieuw'],
            ['🌍','Wereldwijde markten','Volg niet alleen België maar ook Euronext, Xetra, London SE, Nasdaq en NYSE. Inclusief forex koersen.','15+ beurzen','#fef2f2',null],
            ['🌙','Dark mode','Volledig dark mode ondersteuning voor comfortabel gebruik s avonds.','Automatisch','#f0fdf4',null],
            ['📱','Mobiel vriendelijk','Volledig responsive design zodat je je portfolio overal kan opvolgen.','iOS & Android','#eef1f8',null],
          ].map(([icon,title,desc,tag,bg,tagType]) => (
            <div key={title} className="l-feature-card l-animate">
              <div style={{ width:48,height:48,borderRadius:12,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,marginBottom:16 }}>{icon}</div>
              <h3 style={{ fontSize:17,fontWeight:700,marginBottom:8 }}>{title}</h3>
              <p style={{ fontSize:14,color:'#64748b',lineHeight:1.7 }}>{desc}</p>
              <span style={{ display:'inline-block',marginTop:12,background:tagType==='nieuw'?'#dcfce7':tagType==='belgisch'?'#fef3c7':'#f1f5f9',color:tagType==='nieuw'?'#16a34a':tagType==='belgisch'?'#d97706':'#64748b',padding:'3px 10px',borderRadius:100,fontSize:11,fontWeight:600 }}>{tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOE WERKT HET ── */}
      <section id="hoe-werkt-het" style={{ background:'#f8fafc',padding:'96px 24px' }}>
        <div style={{ maxWidth:1100,margin:'0 auto',textAlign:'center' }}>
          <div className="l-section-label">Hoe werkt het</div>
          <h2 style={{ fontSize:'clamp(28px,4vw,42px)',fontWeight:800,letterSpacing:'-1px',marginBottom:16 }}>In 4 stappen klaar</h2>
          <p style={{ fontSize:17,color:'#64748b',maxWidth:500,margin:'0 auto' }}>Van registratie tot volledig inzicht in je beleggingen in minder dan 5 minuten.</p>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:0,marginTop:56,position:'relative' }}>
            {[['Maak een account','Registreer gratis. Geen betaalgegevens nodig voor de gratis periode.'],['Voeg posities toe','Voeg je aandelen en ETFs toe met aankoopprijs en datum.'],['Bekijk je dashboard','Zie meteen je totale waarde, rendement en verschuldigde belastingen.'],['Volg de markten','Live BEL20, Europese ETFs en AI-analyses per aandeel.']].map(([t,d],i) => (
              <div key={i} className="l-animate" style={{ textAlign:'center',padding:24,position:'relative' }}>
                {i < 3 && <span style={{ position:'absolute',right:-12,top:36,fontSize:20,color:'#cbd5e1' }} className="l-hide-mobile">→</span>}
                <div style={{ width:56,height:56,borderRadius:'50%',background:'#1e3a8a',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:800,margin:'0 auto 16px' }}>{i+1}</div>
                <h3 style={{ fontSize:16,fontWeight:700,marginBottom:8 }}>{t}</h3>
                <p style={{ fontSize:14,color:'#64748b' }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BELGISCH ── */}
      <section id="belgisch" style={{ background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)',padding:'96px 24px' }}>
        <div className="l-col-2" style={{ maxWidth:1100,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:64,alignItems:'center' }}>
          <div>
            <div style={{ display:'inline-block',background:'rgba(30,58,138,0.3)',color:'#a5b4fc',padding:'4px 14px',borderRadius:100,fontSize:12,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:14 }}>Belgisch voordeel</div>
            <h2 style={{ fontSize:'clamp(26px,4vw,40px)',fontWeight:800,letterSpacing:'-1px',lineHeight:1.2,color:'white',marginBottom:16 }}>Gebouwd voor de Belgische fiscaliteit</h2>
            <p style={{ fontSize:16,color:'rgba(255,255,255,0.6)',lineHeight:1.7,marginBottom:32 }}>Geen vertaalde buitenlandse tool. Kapitas begrijpt de complexe Belgische belastingregels voor beleggers.</p>
            {[['Meerwaardebelasting (10%)','Automatische berekening op gerealiseerde meerwaarden boven de €10.000 vrijstelling per jaar.'],
              ['Beurstaks (TOB)','0,12% voor UCITS ETFs, 0,35% voor US ETFs en 1,32% voor niet-UCITS fondsen.'],
              ['Reynders-taks','30% roerende voorheffing op obligatie-ETFs met meer dan 10% rentecomponent.'],
              ['Roerende voorheffing dividend','30% belasting op dividenden, automatisch berekend.']].map(([t,d]) => (
              <div key={t} style={{ display:'flex',gap:14,alignItems:'flex-start',marginBottom:18 }}>
                <div style={{ width:28,height:28,borderRadius:'50%',background:'rgba(34,197,94,0.2)',color:'#22c55e',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0,marginTop:2 }}>✓</div>
                <div>
                  <h4 style={{ fontSize:15,fontWeight:600,color:'white',marginBottom:2 }}>{t}</h4>
                  <p style={{ fontSize:13,color:'rgba(255,255,255,0.5)' }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:28 }}>
            <div style={{ fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:20,textTransform:'uppercase',letterSpacing:'0.5px' }}>Belgisch belastingoverzicht 2026</div>
            {[['Meerwaardebelasting','10%','oranje'],['Vrijstelling meerwaarde','€10.000/jaar','groen'],['TOB UCITS ETF','0,12%',null],['TOB niet-UCITS','1,32%',null],['TOB US ETFs','0,35%',null],['Roerende voorheffing','30%',null],['Reynders-taks','30%','oranje']].map(([l,v,badge]) => (
              <div key={l} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 0',borderBottom:'1px solid rgba(255,255,255,0.07)',fontSize:14 }}>
                <span style={{ color:'rgba(255,255,255,0.6)' }}>{l}</span>
                <span style={{ fontWeight:700,color:'white',display:'flex',alignItems:'center',gap:8 }}>
                  {v}
                  {badge && <span style={{ padding:'2px 8px',borderRadius:100,fontSize:10,fontWeight:700,background:badge==='groen'?'rgba(34,197,94,0.2)':'rgba(245,158,11,0.2)',color:badge==='groen'?'#22c55e':'#f59e0b' }}>{badge==='groen'?'Vrijgesteld':'2026'}</span>}
                </span>
              </div>
            ))}
            <div style={{ marginTop:20,padding:14,background:'rgba(34,197,94,0.1)',borderRadius:10,fontSize:12,color:'rgba(255,255,255,0.6)' }}>
              ✓ Volledig up-to-date voor aanslagjaar 2025-2026
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="prijzen" style={{ padding:'96px 24px',background:'#f8fafc' }}>
        <div style={{ maxWidth:860,margin:'0 auto',textAlign:'center' }}>
          <div className="l-section-label">Prijzen</div>
          <h2 style={{ fontSize:'clamp(28px,4vw,42px)',fontWeight:800,letterSpacing:'-1px',marginBottom:12 }}>Simpele, eerlijke prijzen</h2>
          <p style={{ fontSize:17,color:'#64748b' }}>Geen verborgen kosten. Geen jaarcontract. Annuleer wanneer je wil.</p>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:24,marginTop:56,alignItems:'start' }}>
            {/* Gratis */}
            <div className="l-pricing-card l-animate">
              <div style={{ fontSize:13,fontWeight:700,color:'#64748b',marginBottom:8 }}>GRATIS</div>
              <div style={{ fontSize:42,fontWeight:800,letterSpacing:'-1px',lineHeight:1 }}>
                <sup style={{ fontSize:20,verticalAlign:'top',marginTop:8,fontWeight:600 }}>€</sup>0
                <span style={{ fontSize:16,fontWeight:500,color:'#94a3b8' }}>/maand</span>
              </div>
              <div style={{ fontSize:13,color:'#64748b',margin:'8px 0 20px' }}>Perfect om Kapitas te ontdekken.</div>
              <hr style={{ border:'none',borderTop:'1px solid #e2e8f0',margin:'16px 0' }} />
              <div style={{ display:'flex',flexDirection:'column',gap:10,marginBottom:28,textAlign:'left' }}>
                {[['✓','Live marktdata BEL20',true],['✓','ETF overzicht (top 10)',true],['✓','Belastingcalculator',true],['✗','Portfolio tracker',false],['✗','Volledige ETF lijst (270+)',false],['✗','AI-analyses',false],['✗','Dividend tracking',false]].map(([ic,t,ok]) => (
                  <div key={t} style={{ display:'flex',gap:10,alignItems:'flex-start',fontSize:13,color:ok?'#0f172a':'#94a3b8' }}>
                    <span style={{ color:ok?'#22c55e':'#cbd5e1',fontSize:15,flexShrink:0 }}>{ic}</span>{t}
                  </div>
                ))}
              </div>
              <button onClick={onNaarApp} className="l-btn l-btn-outline" style={{ width:'100%',justifyContent:'center' }}>Start gratis</button>
            </div>
            {/* Pro */}
            <div className="l-pricing-card l-pricing-popular l-animate">
              <div style={{ position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',background:'#1e3a8a',color:'white',padding:'4px 16px',borderRadius:100,fontSize:12,fontWeight:700,whiteSpace:'nowrap' }}>⭐ Meest gekozen</div>
              <div style={{ fontSize:13,fontWeight:700,color:'#64748b',marginBottom:8 }}>PRO</div>
              <div style={{ fontSize:42,fontWeight:800,letterSpacing:'-1px',lineHeight:1,color:'#1e3a8a' }}>
                <sup style={{ fontSize:20,verticalAlign:'top',marginTop:8,fontWeight:600 }}>€</sup>9
                <span style={{ fontSize:16,fontWeight:500,color:'#94a3b8' }}>,99/maand</span>
              </div>
              <div style={{ fontSize:13,color:'#64748b',margin:'8px 0 20px' }}>Alles wat je nodig hebt als actieve belegger.</div>
              <hr style={{ border:'none',borderTop:'1px solid #e2e8f0',margin:'16px 0' }} />
              <div style={{ display:'flex',flexDirection:'column',gap:10,marginBottom:28,textAlign:'left' }}>
                {['Alles van Gratis','Portfolio tracker (onbeperkt)','270+ ETFs volledig overzicht','AI-analyses per aandeel','Dividend tracking & kalender','Volledige belastingmodule','BEL Mid- & Smallcap','Wereldwijde markten','Dark mode','Prioriteitsondersteuning'].map(t => (
                  <div key={t} style={{ display:'flex',gap:10,alignItems:'flex-start',fontSize:13 }}>
                    <span style={{ color:'#22c55e',fontSize:15,flexShrink:0 }}>✓</span>{t}
                  </div>
                ))}
              </div>
              <button onClick={onNaarApp} className="l-btn l-btn-primary" style={{ width:'100%',justifyContent:'center' }}>Start 14 dagen gratis →</button>
              <p style={{ fontSize:11,color:'#94a3b8',textAlign:'center',marginTop:10 }}>Geen betaalgegevens nodig voor proefperiode</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding:'96px 24px' }}>
        <div style={{ maxWidth:1100,margin:'0 auto' }}>
          <div style={{ textAlign:'center',marginBottom:48 }}>
            <div className="l-section-label">Wat gebruikers zeggen</div>
            <h2 style={{ fontSize:'clamp(28px,4vw,42px)',fontWeight:800,letterSpacing:'-1px' }}>Belgische beleggers<br />aan het woord</h2>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:20 }}>
            {[['Thomas V.','Actieve belegger, Gent','#1e3a8a','Eindelijk een tool die de TOB en meerwaardebelasting correct berekent. Ik hoef niet meer alles manueel bij te houden in Excel.'],
              ['Sarah M.','Langetermijnbelegger, Brussel','#22c55e','De ETF vergelijker alleen al is de prijs waard. Ik vond ETFs die ik niet kende en vergeleek de exacte kosten op enkele klikken.'],
              ['Jonas D.','Beginnende belegger, Antwerpen','#f59e0b','Super duidelijk overzicht van de BEL20 en Midcap aandelen. De AI-analyse geeft me een goed startpunt voor mijn research.']].map(([naam,rol,kleur,tekst]) => (
              <div key={naam} className="l-animate" style={{ background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:24 }}>
                <div style={{ color:'#f59e0b',fontSize:14,marginBottom:12 }}>★★★★★</div>
                <p style={{ fontSize:14,color:'#64748b',lineHeight:1.7,marginBottom:16,fontStyle:'italic' }}>{`"${tekst}"`}</p>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:'50%',background:kleur,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14 }}>{naam[0]}</div>
                  <div>
                    <div style={{ fontSize:13,fontWeight:700 }}>{naam}</div>
                    <div style={{ fontSize:12,color:'#94a3b8' }}>{rol}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding:'96px 24px',background:'#f8fafc' }}>
        <div style={{ maxWidth:680,margin:'0 auto',textAlign:'center' }}>
          <div className="l-section-label">FAQ</div>
          <h2 style={{ fontSize:'clamp(28px,4vw,42px)',fontWeight:800,letterSpacing:'-1px',marginBottom:48 }}>Veelgestelde vragen</h2>
          <div style={{ textAlign:'left' }}>
            {faqs.map(([vraag,antwoord],i) => (
              <div key={i} className="l-faq-item">
                <div className="l-faq-q" onClick={() => toggleFaq(i)} style={{ justifyContent:'space-between' }}>
                  {vraag}
                  <span style={{ fontSize:20,color:'#1e3a8a',fontWeight:400,flexShrink:0,marginLeft:12 }}>{faqOpen===i?'−':'+'}</span>
                </div>
                {faqOpen===i && <div className="l-faq-a">{antwoord}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background:'linear-gradient(135deg,#1e3a8a 0%,#14275e 100%)',padding:'96px 24px',textAlign:'center' }}>
        <h2 style={{ fontSize:'clamp(28px,5vw,48px)',fontWeight:800,color:'white',letterSpacing:'-1px',marginBottom:16 }}>Klaar om je beleggingen<br />overzichtelijk te maken?</h2>
        <p style={{ fontSize:18,color:'rgba(255,255,255,0.8)',marginBottom:40 }}>Sluit je aan bij Belgische beleggers die Kapitas gebruiken om slimmer te beleggen.</p>
        <div style={{ display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap' }}>
          <button onClick={onNaarApp} className="l-btn l-btn-white" style={{ fontSize:17,padding:'16px 36px',borderRadius:12 }}>Start 14 dagen gratis →</button>
          <button onClick={onNaarApp} className="l-btn l-btn-ghost-white" style={{ fontSize:17,padding:'16px 36px',borderRadius:12 }}>Live demo bekijken</button>
        </div>
        <p style={{ fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:16 }}>Geen betaalgegevens nodig · Annuleer wanneer je wil · €9,99/maand na proefperiode</p>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:'#0f172a',color:'rgba(255,255,255,0.5)',padding:'48px 24px 32px' }}>
        <div className="l-col-2" style={{ maxWidth:1100,margin:'0 auto',display:'grid',gridTemplateColumns:'2fr repeat(3,1fr)',gap:40,marginBottom:40 }}>
          <div>
            <div style={{ fontSize:20,fontWeight:800,color:'white',marginBottom:10 }}>Kapitas</div>
            <div style={{ fontSize:13,lineHeight:1.7,marginBottom:16 }}>Het slimste beleggingsdashboard voor Belgische beleggers. Portfolio, markten, ETFs en belastingen op één plek.</div>
            <div style={{ fontSize:11,color:'rgba(255,255,255,0.3)',lineHeight:1.6 }}>⚠️ Kapitas biedt geen beleggingsadvies. Alle informatie is louter informatief. Raadpleeg een erkend financieel adviseur voor persoonlijk advies.</div>
          </div>
          {[['Product',['Features','Prijzen','Live demo','Hoe werkt het']],['Belgisch',['Belastingmodule','TOB calculator','Meerwaardebelasting','Reynders-taks']],['Info',['Privacybeleid','Algemene voorwaarden','Disclaimer','Contact']]].map(([titel,links]) => (
            <div key={titel}>
              <h4 style={{ fontSize:13,fontWeight:700,color:'white',marginBottom:14 }}>{titel}</h4>
              {links.map(l => <div key={l} style={{ fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:8,cursor:'pointer' }} onClick={l==='Contact'?()=>window.location.href='mailto:hello@kapitas.be':l==='Privacybeleid'?onPrivacybeleid:onNaarApp}>{l}</div>)}
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:24,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,flexWrap:'wrap',gap:12 }}>
          <span>© 2026 Kapitas. Alle rechten voorbehouden.</span>
          <div style={{ display:'flex',gap:20 }}>
            {['Privacybeleid','Voorwaarden','Disclaimer'].map(l => <span key={l} style={{ color:'rgba(255,255,255,0.35)',cursor:'pointer' }} onClick={l==='Privacybeleid'?onPrivacybeleid:undefined}>{l}</span>)}
          </div>
        </div>
      </footer>
    </div>
  );
}
