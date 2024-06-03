const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.use('/api', require('./routes/routes'));

// Starting the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
});

app.use(express.static(path.join(__dirname, 'public')));
