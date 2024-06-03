const express = require('express');
const { google } = require('googleapis');

const { authorize } = require('./controller/controllers.js');
const cors = require('cors');
const path = require('path');

const dotenv = require('dotenv');
dotenv.config();

//require('./controller/pubsub');

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

//Para que funcionen las notificaciones
async function watch() {
  const auth = await authorize();

  var options = {
    userId: 'me',
    auth: auth,
    resource: {
      labelIds: ['INBOX'],
      topicName: `projects/${process.env.PORJECT_ID}/topics/${process.env.PUB_SUB_TOPIC_NAME}`,
    },
  };

  const gmail = google.gmail({ version: 'v1', auth });
  gmail.users.watch(options, function (err, res) {
    if (err) {
      // doSomething here;
      return;
    }
    //console.log(res);
  });
}
watch();
