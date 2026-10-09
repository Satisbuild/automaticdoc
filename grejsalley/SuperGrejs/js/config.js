'use strict';
/* =====================================================================
   SUPER GREJS - config.js
   Hvor frontend finder backend-API'et. Her må ALDRIG stå hemmeligheder
   (ingen MongoDB-URI, ingen JWT-nøgle) - kun den offentlige API-adresse.

   - Lokalt (localhost / 127.0.0.1 / file://) bruges LOCAL_API.
   - Ellers bruges PROD_API. Sæt den til din HTTPS-hostede backend,
     fx 'https://supergrejs-api.example.dk/api'. Er den tom, kan spillet
     stadig spilles, men konto, venner og rangliste er slået fra.
   - Til test kan adressen overstyres i browserkonsollen:
       localStorage.setItem('sg_api', 'http://127.0.0.1:3001/api')
   ===================================================================== */
window.SG = window.SG || {};

SG.config = (function () {
  const LOCAL_API = 'http://127.0.0.1:3001/api';
  const PROD_API = '';

  const host = location.hostname;
  const isLocal = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '';
  let api = isLocal ? LOCAL_API : PROD_API;
  try {
    const o = localStorage.getItem('sg_api');
    if (o) api = o;
  } catch (e) { /* lagring kan være spærret */ }

  return {
    API_BASE: api.trim().replace(/\/+$/, ''),
    VERSION: '1.0.0',
  };
})();
