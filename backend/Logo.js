const fs = require('fs');

const filePath = './FH_logoFinal.png'; // Path to your logo
const base64String = fs.readFileSync(filePath, { encoding: 'base64' });

console.log(`data:image/png;base64,${base64String}`); // Print the Base64 string
