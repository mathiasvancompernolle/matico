import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Publieke pagina's komen als kant-en-klare HTML binnen (zie
// scripts/prerender.mjs). React neemt die gewoon over; deze klasse zorgt
// ervoor dat de intro-animaties dan niet een tweede keer starten.
if (document.querySelector('[data-prerender]')) document.documentElement.classList.add('kp-voorgerenderd');

const root =ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
