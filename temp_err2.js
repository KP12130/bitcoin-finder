const fs = require('fs');
fetch('http://localhost:3000/chickenroad').then(r => r.text()).then(txt => {
  if (txt.includes('This page')) {
    const idx = txt.indexOf('This page');
    console.log(txt.substring(idx - 100, idx + 200));
  } else {
    console.log('Not found');
  }
});
