// Artikels van de Gids. Elk artikel krijgt een eigen adres (/gids/<slug>),
// vooraf gegenereerde HTML en een plaats in de sitemap (zie scripts/prerender.mjs).
// Belastingregels veranderen: pas "nagekeken" aan telkens je een artikel controleert.
//
// Opbouw van een sectie: { kop, tekst: [alinea's], lijst?: [punten], tabel?: { kop: [...], rijen: [[...]] },
//   tip?, letOp?, link?, voorbeeld?: { titel, regels: [[omschrijving, bedrag, soort?]], totaal: [omschrijving, bedrag], noot? } }
// soort: 'min' (rood), 'plus' (groen) of leeg

export const GIDS_ARTIKELS = [
  {
    slug: 'reynderstaks',
    titel: 'De Reynderstaks uitgelegd: 30% op obligatiefondsen',
    korteTitel: 'De Reynderstaks uitgelegd',
    categorie: 'Belastingen', icoon: '📜', kleur: '#fef3c7',
    kort: [
      '30% belasting op het rentedeel van je winst bij fondsen en ETF\'s die voor meer dan 10% in obligaties beleggen.',
      'Zuivere aandelen-ETF\'s vallen er normaal niet onder.',
      'Sinds 2026 wordt dat deel van je winst afgetrokken van de meerwaardebelasting, zodat je niet dubbel betaalt.',
    ],
    seoTitel: 'Reynderstaks uitgelegd (2026): wanneer betaal je 30%? – Kapitas',
    beschrijving: 'Wat is de Reynderstaks, op welke fondsen en ETF\'s betaal je ze, hoeveel bedraagt ze en hoe werkt ze samen met de nieuwe meerwaardebelasting? Helder uitgelegd met voorbeelden.',
    intro: 'Verkoop je een fonds of ETF dat (deels) in obligaties belegt, dan kan je bank 30% inhouden op een deel van je winst: de Reynderstaks. Hier lees je wanneer dat gebeurt, hoeveel het kost en hoe je ermee rekening houdt.',
    leestijd: 5,
    nagekeken: '2026-11-21',
    rekenhulp: { pad: '/meerwaardebelasting-berekenen', tekst: 'Bereken je meerwaardebelasting' },
    secties: [
      {
        kop: 'Wat is de Reynderstaks?',
        tekst: [
          'De Reynderstaks is een belasting van 30% op het "renterendement" dat je opbouwt in een beleggingsfonds of ETF dat in obligaties en andere schuldvorderingen belegt. Ze is genoemd naar Didier Reynders, die als minister van Financiën de regel invoerde.',
          'Het idee: wie rechtstreeks obligaties bezit, betaalt 30% roerende voorheffing op de rente. Zonder Reynderstaks kon je die belasting ontwijken door de obligaties via een (kapitaliserend) fonds te bezitten. De Reynderstaks trekt dat recht.',
        ],
      },
      {
        kop: 'Op welke fondsen en ETF\'s?',
        tekst: [
          'De Reynderstaks geldt bij de verkoop of terugbetaling van fondsen en ETF\'s die voor meer dan 10% in obligaties of andere schuldvorderingen beleggen. Voor fondsen die je vóór 1 januari 2018 kocht, ligt die drempel op 25%.',
        ],
        lijst: [
          'Obligatie-ETF\'s en obligatiefondsen: bijna altijd.',
          'Gemengde fondsen (bv. 60% aandelen, 40% obligaties) en veel pensioen- of profielfondsen: vaak.',
          'Zuivere aandelen-ETF\'s, zoals een wereldwijde aandelen-ETF: normaal niet, omdat ze niet in obligaties beleggen.',
        ],
        tip: 'Het maakt niet uit of het fonds distribuerend of kapitaliserend is: de Reynderstaks kan op beide van toepassing zijn.',
      },
      {
        kop: 'Hoeveel betaal je?',
        tekst: [
          'Je betaalt 30% op het deel van je meerwaarde dat uit rente komt, niet op je volledige winst. Veel fondsen publiceren daarvoor per aandeel het belastbare renterendement (het "TIS", taxable income per share). Je bank rekent daarmee.',
          'Geeft een fonds die informatie niet, dan kan de belasting op een groter deel van je meerwaarde berekend worden. Bij fondsen zonder duidelijke gegevens betaal je dus mogelijk meer dan nodig.',
        ],
      },
      {
        kop: 'Reynderstaks en de nieuwe meerwaardebelasting',
        tekst: [
          'Sinds 1 januari 2026 betaal je 10% meerwaardebelasting op winst bij de verkoop van financiële activa. De Reynderstaks blijft daarnaast bestaan. Om dubbele belasting te vermijden, wordt het deel van je winst waarop al Reynderstaks betaald is, afgetrokken van wat onder de meerwaardebelasting valt.',
        ],
        voorbeeld: {
          titel: 'Voorbeeld: gemengd fonds, gekocht in 2020, verkocht in 2026',
          regels: [
            ['Waarde op 31 december 2025', '€ 150'],
            ['Verkoopprijs in 2026', '€ 250'],
            ['Winst sinds 2026', '€ 100'],
            ['Renterendement € 10 × 30% (Reynderstaks)', '− € 3', 'min'],
            ['Rest: € 90 × 10% (meerwaardebelasting)', '− € 9', 'min'],
          ],
          totaal: ['Totaal aan belasting', '€ 12'],
          noot: 'In dit voorbeeld is de vrijstelling van € 10.000 voor de meerwaardebelasting dat jaar al opgebruikt.',
        },
        letOp: 'De vrijstelling van €10.000 geldt alleen voor de meerwaardebelasting. De Reynderstaks kent geen vrijstelling en is verschuldigd vanaf de eerste euro.',
      },
      {
        kop: 'Wie houdt ze in?',
        tekst: [
          'Bij een Belgische bank of broker wordt de Reynderstaks automatisch ingehouden bij de verkoop. Bij een buitenlandse broker gebeurt dat meestal niet: dan moet je het belastbare renterendement zelf vermelden in je belastingaangifte.',
        ],
      },
      {
        kop: 'Hoe hou je er rekening mee?',
        lijst: [
          'Kijk vóór je een fonds koopt hoeveel het in obligaties belegt. Op de fiche van het fonds staat vaak ook of het onder de Reynderstaks valt.',
          'Wil je obligaties in je portefeuille, vergelijk dan een obligatiefonds met rechtstreeks obligaties kopen: fiscaal kan dat anders uitvallen.',
          'Bij zuivere aandelen-ETF\'s speelt de Reynderstaks normaal geen rol.',
        ],
      },
    ],
    bronnen: [
      { titel: 'Triodos – Wat gebeurt er met de Reynderstaks?', url: 'https://www.triodos.be/nl/meest-gestelde-vragen/wat-gebeurt-er-met-de-reynders-taks?id=e73b8890addb' },
      { titel: 'Wikifin – De belastingen op je beleggingen', url: 'https://www.wikifin.be/nl/belasting-werk-en-inkomen/belastingaangifte/je-roerend-inkomen/de-belastingen-op-je-belgische' },
      { titel: 'Robeco – Overzicht fondsen Reynderstaks', url: 'https://www.robeco.com/files/docm/docu-reynders-tax.pdf' },
    ],
  },
  {
    slug: 'accumulerend-of-distribuerend',
    titel: 'Accumulerend of distribuerend: welke ETF kies je in België?',
    korteTitel: 'Accumulerend of distribuerend?',
    categorie: 'ETF\'s', icoon: '🔄', kleur: '#f0fdf4',
    kort: [
      'Een distribuerende ETF keert dividend uit, waarop je in België 30% roerende voorheffing betaalt.',
      'Een accumulerende ETF herbelegt het dividend: zolang je niet verkoopt, betaal je geen dividendbelasting.',
      'Voor wie vermogen opbouwt, is accumulerend in België meestal fiscaal voordeliger.',
    ],
    seoTitel: 'Accumulerend of distribuerend ETF in België (2026)? – Kapitas',
    beschrijving: 'Kapitaliserende (accumulerende) of distribuerende ETF: wat is het verschil, wat betekent het voor de beurstaks, de dividendbelasting en de meerwaardebelasting in België, en wat past bij jou?',
    intro: 'Bij bijna elke ETF kan je kiezen tussen een accumulerende (kapitaliserende) en een distribuerende versie. In België maakt die keuze een groot verschil voor je belastingen. We zetten het op een rij.',
    leestijd: 5,
    nagekeken: '2026-11-21',
    rekenhulp: { pad: '/dividendbelasting-berekenen', tekst: 'Bereken je dividendbelasting' },
    secties: [
      {
        kop: 'Wat is het verschil?',
        tekst: [
          'Een distribuerende ETF keert de dividenden van de bedrijven waarin ze belegt uit aan jou, meestal per kwartaal of per jaar. Een accumulerende of kapitaliserende ETF herbelegt die dividenden meteen in het fonds: je krijgt niets uitbetaald, maar de koers van de ETF stijgt mee.',
          'Je herkent ze vaak aan de naam: "Acc" of "Accumulating" tegenover "Dist" of "Distributing".',
        ],
      },
      {
        kop: 'Het grote verschil: dividendbelasting',
        tekst: [
          'Op elke uitkering van een distribuerende ETF houdt je bank in België 30% roerende voorheffing in. De vrijstelling van €833 voor dividenden geldt hier niet: die is alleen voor dividenden van individuele aandelen.',
          'Bij een accumulerende ETF krijg je geen uitkering, dus betaal je die 30% niet. Het geld blijft in het fonds werken. Over vele jaren maakt dat een groot verschil, door het rente-op-rente-effect.',
        ],
        voorbeeld: {
          titel: 'Voorbeeld: € 20.000 in een wereld-ETF met 1,5% dividend per jaar',
          regels: [
            ['Dividend per jaar', '€ 300'],
            ['Distribuerend: 30% roerende voorheffing', '− € 90', 'min'],
            ['Accumulerend: dividendbelasting', '€ 0', 'plus'],
          ],
          totaal: ['Verschil per jaar dat blijft doorgroeien', '€ 90'],
          noot: 'Vereenvoudigd voorbeeld. Bij verkoop betaal je op beide sinds 2026 de meerwaardebelasting op je winst (na de vrijstelling van € 10.000 per jaar).',
        },
        tip: 'In beide gevallen houdt het fonds zelf soms al buitenlandse bronheffing in op de dividenden die het ontvangt (bv. op Amerikaanse aandelen). Dat staat los van je keuze tussen accumulerend en distribuerend.',
      },
      {
        kop: 'Beurstaks en meerwaardebelasting',
        tabel: {
          kop: ['', 'Accumulerend', 'Distribuerend'],
          rijen: [
            ['Dividendbelasting (30%)', 'Nee, zolang je niet verkoopt', 'Ja, op elke uitkering'],
            ['Beurstaks bij aan- en verkoop', '0,12% als het fonds in de EER geregistreerd is en niet bij de FSMA; 1,32% als het wel bij de FSMA ingeschreven is', '0,12% (bij registratie in de EER)'],
            ['Meerwaardebelasting (10%, sinds 2026)', 'Op je winst bij verkoop, na vrijstelling van €10.000 per jaar', 'Op je winst bij verkoop, na vrijstelling van €10.000 per jaar'],
            ['Reynderstaks', 'Mogelijk, als het fonds meer dan 10% in obligaties belegt', 'Mogelijk, als het fonds meer dan 10% in obligaties belegt'],
          ],
        },
        tekst: [
          'De meeste populaire accumulerende ETF\'s zijn in Ierland of Luxemburg geregistreerd en niet bij de FSMA ingeschreven: dan betaal je ook maar 0,12% beurstaks. Controleer het wel per ETF, want bij inschrijving bij de FSMA loopt het op tot 1,32%.',
          'Sinds 2026 betaal je bij de verkoop van beide soorten 10% meerwaardebelasting op je winst, met een jaarlijkse vrijstelling van €10.000. Bij een accumulerende ETF zit de herbelegde dividendwaarde in die winst, maar die wordt dan aan 10% belast (en enkel boven de vrijstelling) in plaats van jaarlijks aan 30%.',
        ],
      },
      {
        kop: 'Wat past bij jou?',
        lijst: [
          'Bouw je vermogen op voor later en heb je het geld nu niet nodig? Dan is een accumulerende ETF in België fiscaal meestal de efficiëntste keuze.',
          'Wil je een regelmatig inkomen uit je beleggingen, bv. als aanvulling op je pensioen? Dan kan een distribuerende ETF praktisch zijn, ondanks de 30% op elke uitkering.',
          'Twijfel je over de beurstaks? Reken het na voor jouw bedrag met de rekenhulp hieronder.',
        ],
      },
    ],
    bronnen: [
      { titel: 'Wikifin – De belastingen op je beleggingen', url: 'https://www.wikifin.be/nl/belasting-werk-en-inkomen/belastingaangifte/je-roerend-inkomen/de-belastingen-op-je-belgische' },
      { titel: 'Test-Aankoop – Beurstaks op ETF\'s', url: 'https://www.test-aankoop.be/invest/beleggen/fiscaliteit-and-rechten/dossiers/beurstaks-tob/beurstaks-etf-tob-belgie' },
      { titel: 'Test-Aankoop – Meerwaardebelasting in België', url: 'https://www.test-aankoop.be/geld/belastingen/nieuws/meerwaardebelasting' },
    ],
  },
  {
    slug: 'buitenlandse-broker-aangeven',
    titel: 'Beleggen via een buitenlandse broker: wat moet je aangeven?',
    korteTitel: 'Buitenlandse broker aangeven',
    categorie: 'Aangifte', icoon: '🌍', kleur: '#f0f9ff',
    kort: [
      'Meld je buitenlandse effectenrekening één keer bij het Centraal Aanspreekpunt van de Nationale Bank.',
      'Vermeld de rekening elk jaar in vak XIII van je belastingaangifte.',
      'Wat je broker niet inhoudt (beurstaks, dividendbelasting, meerwaardebelasting), geef je zelf aan.',
    ],
    seoTitel: 'Buitenlandse broker aangeven in België: CAP, beurstaks en aangifte – Kapitas',
    beschrijving: 'Beleg je via DEGIRO, Trade Republic, Interactive Brokers of een andere buitenlandse broker? Dit moet je doen: je rekening melden bij de Nationale Bank, de beurstaks, je dividenden en je meerwaarden.',
    intro: 'Een buitenlandse broker is vaak goedkoper, maar je moet zelf meer regelen. Vergeet je iets, dan riskeer je boetes. Dit zijn de vier dingen waar je aan moet denken.',
    leestijd: 6,
    nagekeken: '2026-11-21',
    rekenhulp: { pad: '/beurstaks-berekenen', tekst: 'Bereken je beurstaks' },
    secties: [
      {
        kop: 'Eerst: houdt je broker iets in?',
        tekst: [
          'Brokers verschillen sterk. Sommige buitenlandse brokers hebben een Belgisch bijkantoor of houden voor hun Belgische klanten de beurstaks of de roerende voorheffing in; andere doen niets. Kijk dit na in de informatie van je broker of in je transactie-overzichten: staat er "TOB" of "roerende voorheffing" bij, dan werd ze ingehouden.',
          'Alles wat je broker niet voor jou inhoudt, moet je zelf aangeven en betalen.',
        ],
      },
      {
        kop: '1. Je rekening melden bij de Nationale Bank (CAP)',
        tekst: [
          'Elke rekening in het buitenland, ook een effectenrekening bij een buitenlandse broker, moet je één keer melden bij het Centraal Aanspreekpunt (CAP) van de Nationale Bank van België. Dat doe je online met itsme of je eID, of met een papieren formulier.',
          'Je moet dat doen ten laatste wanneer je de eerste belastingaangifte indient waarin je de rekening vermeldt. Sluit je de rekening of veranderen de gegevens, dan meld je dat ook.',
        ],
      },
      {
        kop: '2. Elk jaar in je belastingaangifte (vak XIII)',
        tekst: [
          'In je jaarlijkse aangifte personenbelasting vermeld je in vak XIII, deel A, dat je een rekening in het buitenland hebt, in welk land, en dat je ze gemeld hebt bij het CAP. Dat geldt elk jaar dat je de rekening hebt, ook als je er niets mee deed.',
        ],
      },
      {
        kop: '3. De beurstaks (TOB) zelf aangeven',
        tekst: [
          'Houdt je broker de beurstaks niet in, dan moet je ze zelf aangeven en betalen, ten laatste op de laatste werkdag van de tweede maand na de maand van je transactie. Een aankoop in maart geef je dus aan en betaal je uiterlijk eind mei. Dat kan via MyMinfin of met het aangifteformulier van de FOD Financiën.',
          'Het tarief hangt af van wat je koopt: 0,12% voor de meeste Europese ETF\'s, 0,35% voor aandelen, tot 1,32% voor kapitaliserende fondsen die bij de FSMA ingeschreven zijn, telkens met een maximum per transactie.',
        ],
        voorbeeld: {
          titel: 'Voorbeeld: je koopt op 14 maart voor € 5.000 aan een Ierse ETF',
          regels: [
            ['Beurstaks: € 5.000 × 0,12%', '€ 6,00'],
            ['Uiterlijk aangeven en betalen', 'eind mei'],
          ],
          totaal: ['Te betalen', '€ 6,00'],
          noot: 'Precies: de laatste werkdag van de tweede maand na de maand van je aankoop.',
        },
        letOp: 'Te laat betalen kost boetes en nalatigheidsinteresten. Zet een herinnering, of kies een broker die de beurstaks voor je inhoudt.',
      },
      {
        kop: '4. Dividenden, rente en meerwaarden in je aangifte',
        lijst: [
          'Dividenden: werd er geen Belgische roerende voorheffing ingehouden, dan vermeld je ze in vak VII van je aangifte en betaal je daar de 30%. De vrijstelling van €833 voor dividenden van aandelen kan je ook dan gebruiken.',
          'Meerwaarden (sinds 2026): buitenlandse brokers houden de meerwaardebelasting van 10% meestal niet in. Je vermeldt je meerwaarden dan zelf in je aangifte. De vrijstelling van €10.000 per jaar wordt daar toegepast.',
          'Reynderstaks: verkoop je een fonds met meer dan 10% obligaties, dan vermeld je het belastbare renterendement zelf.',
          'Rente op je cashsaldo: ook buitenlandse rente moet je aangeven.',
        ],
      },
      {
        kop: 'En de effectentaks?',
        tekst: [
          'De taks op effectenrekeningen geldt alleen als de gemiddelde waarde van je effectenrekening(en) boven €1 miljoen ligt. Voor de meeste particuliere beleggers speelt ze dus geen rol.',
        ],
      },
      {
        kop: 'Overzicht houden',
        tekst: [
          'Bij een buitenlandse broker moet je dus zelf bijhouden wat je kocht, verkocht en ontving. Kapitas rekent voor elke transactie de beurstaks uit, houdt je dividenden en de ingehouden belastingen bij en toont hoeveel van je vrijstelling voor de meerwaardebelasting je al gebruikte, voor al je brokers samen.',
        ],
      },
    ],
    bronnen: [
      { titel: 'Nationale Bank van België – Centraal Aanspreekpunt (CAP)', url: 'https://www.nbb.be/nl/centraal-aanspreekpunt' },
      { titel: 'FOD Financiën – Taks op de beursverrichtingen', url: 'https://finances.belgium.be/en/taks-op-beursverrichtingen-en' },
      { titel: 'KBC – Belgische beurstaks bij buitenlandse brokers', url: 'https://www.kbc.be/private-banking/nl/nieuws/fiscaal-juridisch/Belgische-beurstaks-een-vaak-vergeten-verplichting-bij-buitenlandse-broker.html' },
      { titel: 'Test-Aankoop – Beleggingen aangeven', url: 'https://www.test-aankoop.be/geld/beleggen/nieuws/beleggingen-aangeven-beurs-belgie' },
    ],
  },
  {
    slug: 'eerste-etf-kiezen',
    titel: 'Je eerste ETF kiezen: waar let je op?',
    korteTitel: 'Je eerste ETF kiezen',
    categorie: 'Beginnen', icoon: '🧺', kleur: '#fdf4ff',
    kort: [
      'Kijk eerst naar de index: die bepaalt waarin je echt belegt.',
      'Lage kosten (TER), een accumulerende versie en 0,12% beurstaks zijn in België vaak de slimste combinatie.',
      'Let op het vestigingsland, de fondsgrootte en de beurs waarop je koopt.',
    ],
    seoTitel: 'Je eerste ETF kiezen in België: 7 dingen om op te letten – Kapitas',
    beschrijving: 'Hoe kies je een ETF als Belgische belegger? Kosten (TER), index en spreiding, accumulerend of distribuerend, vestigingsland, beurstaks, fondsgrootte en de beurs waarop je koopt.',
    intro: 'Er bestaan duizenden ETF\'s, maar met een paar vragen kom je snel tot een korte lijst. Dit zijn de zeven punten waar je als Belgische belegger op let. We geven geen koopadvies: het doel is dat je zelf goed kan vergelijken.',
    leestijd: 6,
    nagekeken: '2026-11-21',
    rekenhulp: { pad: '/beurstaks-berekenen', tekst: 'Bereken de beurstaks op je ETF' },
    secties: [
      {
        kop: '1. Welke index volgt de ETF?',
        tekst: [
          'Een ETF volgt een index: een mandje aandelen volgens vaste regels. Dat bepaalt waarin je belegt. Brede wereldindexen spreiden over duizenden bedrijven in tientallen landen; andere indexen focussen op één regio, sector of thema.',
          'Voor een eerste ETF kiezen veel beleggers een brede wereldwijde index. Let op het verschil: sommige wereldindexen bevatten alleen ontwikkelde landen (bv. MSCI World), andere ook opkomende markten (bv. MSCI ACWI of FTSE All-World).',
        ],
      },
      {
        kop: '2. De kosten (TER)',
        tekst: [
          'De lopende kosten (TER, total expense ratio) worden jaarlijks uit het fonds gehaald. Voor brede index-ETF\'s liggen ze vaak tussen 0,05% en 0,25% per jaar. Dat lijkt weinig, maar over 20 of 30 jaar maakt elk tiende procent een merkbaar verschil.',
        ],
        voorbeeld: {
          titel: 'Voorbeeld: € 10.000, 20 jaar, 7% rendement per jaar vóór kosten',
          regels: [
            ['ETF met 0,07% kosten', '€ 38.194'],
            ['ETF met 0,25% kosten', '€ 36.928'],
          ],
          totaal: ['Verschil door de kosten', '€ 1.266'],
          noot: 'Rekenvoorbeeld, geen voorspelling: echte rendementen schommelen van jaar tot jaar.',
        },
      },
      {
        kop: '3. Accumulerend of distribuerend',
        tekst: [
          'Een accumulerende ETF herbelegt de dividenden, een distribuerende keert ze uit. In België betaal je 30% roerende voorheffing op elke uitkering, dus voor wie vermogen opbouwt is accumulerend meestal fiscaal voordeliger.',
        ],
        link: { pad: '/gids/accumulerend-of-distribuerend', tekst: 'Lees meer over accumulerend of distribuerend' },
      },
      {
        kop: '4. Het vestigingsland',
        tekst: [
          'De eerste twee letters van de ISIN-code tonen waar een ETF gevestigd is, bv. IE (Ierland) of LU (Luxemburg). Ierse ETF\'s die in Amerikaanse aandelen beleggen, betalen dankzij een belastingverdrag vaak maar 15% Amerikaanse bronheffing op de dividenden in plaats van 30%. Bij een wereld-ETF, met veel Amerikaanse bedrijven, telt dat.',
          'Amerikaanse ETF\'s (ISIN begint met US) zijn voor Europese particulieren meestal niet te koop en vallen onder een hoger beurstaks-tarief.',
        ],
      },
      {
        kop: '5. De beurstaks',
        tekst: [
          'Op elke aan- en verkoop betaal je beurstaks. Voor de meeste ETF\'s uit Ierland of Luxemburg is dat 0,12%. Kapitaliserende fondsen die bij de FSMA ingeschreven zijn, betalen echter 1,32%. Controleer het tarief dus vóór je koopt: het verschil is groot.',
        ],
      },
      {
        kop: '6. Grootte en replicatie',
        lijst: [
          'Fondsgrootte: een groter fonds (bv. honderden miljoenen euro of meer) wordt minder snel opgedoekt en is vaak goedkoper om te verhandelen.',
          'Replicatie: een fysieke ETF koopt de aandelen van de index echt; een synthetische ETF bootst het rendement na met afspraken (swaps) met banken. Beide zijn gereguleerd, maar veel starters kiezen voor de eenvoud van fysieke replicatie.',
        ],
      },
      {
        kop: '7. Op welke beurs en in welke munt koop je?',
        tekst: [
          'Dezelfde ETF noteert vaak op verschillende beurzen. Koop je in euro, bv. op Euronext Amsterdam of Xetra, dan vermijd je wisselkosten bij je broker. Let ook op de kosten die je broker per transactie aanrekent, zeker als je elke maand een klein bedrag belegt.',
        ],
      },
      {
        kop: 'Daarna: volhouden en opvolgen',
        tekst: [
          'Een goede ETF kiezen is maar het begin. Wie regelmatig bijlegt en niet panikeert als de beurs zakt, haalt er op lange termijn het meeste uit. Met Kapitas volg je je ETF\'s op, zie je wat je in elk land en elke sector bezit en hoeveel kosten en taksen je betaalt.',
        ],
      },
    ],
    bronnen: [
      { titel: 'Wikifin – Wat is een tracker (ETF)?', url: 'https://www.wikifin.be/nl/sparen-en-beleggen/beleggingsproducten/tracker/wat-een-tracker-soorten-trackers' },
      { titel: 'Wikifin – De belastingen op je beleggingen', url: 'https://www.wikifin.be/nl/belasting-werk-en-inkomen/belastingaangifte/je-roerend-inkomen/de-belastingen-op-je-belgische' },
      { titel: 'Test-Aankoop – Beurstaks op ETF\'s', url: 'https://www.test-aankoop.be/invest/beleggen/fiscaliteit-and-rechten/dossiers/beurstaks-tob/beurstaks-etf-tob-belgie' },
    ],
  },
];

export const artikelVoorPad = (pad) => {
  const m = /^\/gids\/([a-z0-9-]+)$/.exec(pad);
  return m ? GIDS_ARTIKELS.find(a => a.slug === m[1]) || null : null;
};
