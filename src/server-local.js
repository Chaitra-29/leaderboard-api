
'use strict';

const app = require('./server');

// set port, listen for requests
const PORT = process.env.PORT || 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Node.js app is listening at http://localhost:${PORT}`);
});