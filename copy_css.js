const fs = require('fs');

const dawoodIndexCSSPath = 'c:/Users/waqar/.gemini/antigravity/scratch/dawood-agro-traders/client/src/index.css';
const qasimIndexCSSPath = 'C:/Users/waqar/.gemini/antigravity/scratch/qasim-pan-shop-manager/frontend/src/index.css';
const qasimAppCSSPath = 'C:/Users/waqar/.gemini/antigravity/scratch/qasim-pan-shop-manager/frontend/src/App.css';

try {
  let dawoodContent = fs.readFileSync(dawoodIndexCSSPath, 'utf8');
  const qasimIndexContent = fs.readFileSync(qasimIndexCSSPath, 'utf8');
  const qasimAppContent = fs.readFileSync(qasimAppCSSPath, 'utf8');

  // Strip out imports from qasimIndexContent if any, to avoid CSS import errors
  // But actually the import from google fonts can stay at top.
  let newContent = `
/* ========================================================
   IMPORTED FROM QASIM PAN SHOP MANAGER (PREMIUM UI KIT)
   ======================================================== */

${qasimIndexContent}

/* ========================================================
   QASIM PAN SHOP MANAGER APP.CSS COMPONENTS
   ======================================================== */

${qasimAppContent}
`;

  // We should put the imports at the very top. 
  // Dawood has '@import "tailwindcss";'
  // Qasim has '@import url('https://fonts.googleapis.com/...');'
  
  // Just append the content for now.
  fs.appendFileSync(dawoodIndexCSSPath, newContent);
  console.log("Successfully appended Qasim CSS to Dawood index.css");
} catch (e) {
  console.error("Error copying CSS:", e);
}
