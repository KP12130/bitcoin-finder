const fs = require('fs');
fetch('http://localhost:3000/chickenroad').then(r => r.text()).then(txt => {
  const match = txt.match(/Error:.*?"/);
  console.log(match ? match[0] : 'No Error string found');
});
