const { google } = require('googleapis');
const { PubSub } = require('@google-cloud/pubsub');

const dotenv = require('dotenv');
dotenv.config();

const SCOPES = ['https://mail.google.com/'];

async function authorize() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  return oauth2Client;
}

async function getEmails(auth, res, sender = '') {
  const gmail = google.gmail({ version: 'v1', auth });
  const gmailRes = await gmail.users.messages.list({
    userId: 'me',
    q: sender !== '' ? 'from:' + sender : '',
    maxResults: 10,
  });

  const messages = gmailRes.data.messages;
  if (!messages || messages.length === 0) {
    console.log('No messages found.');
    res.json({ message: 'No messages found.' });
    return;
  }

  const emailData = [];

  for (const message of messages) {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
    });
    const headers = msg.data.payload.headers;
    const fromHeader = headers.find((header) => header.name === 'From');
    const toHeader = headers.find((header) => header.name === 'To');
    const dateHeader = headers.find((header) => header.name === 'Date');
    const subjectHeader = headers.find((header) => header.name === 'Subject');

    let from = fromHeader ? fromHeader.value : 'Unknown sender';
    let to = toHeader ? toHeader.value : 'Unknown recipient';
    let date = dateHeader ? dateHeader.value : 'Unknown date';
    let subject = subjectHeader ? subjectHeader.value : 'Unknown subject';
    let bodyText = '';
    let bodyHtml = '';
    let attachments = [];
    let mimeTypes = '';

    if (msg.data.payload.parts) {
      const {
        bodyText: extractedBodyText,
        bodyHtml: extractedBodyHtml,
        bodyAttachments,
        mimeType,
      } = extractBody(msg.data.payload.parts);
      bodyText = extractedBodyText;
      bodyHtml = extractedBodyHtml;
      attachments = bodyAttachments;
      mimeTypes = mimeType;
    } else if (msg.data.payload.body && msg.data.payload.body.data) {
      bodyText = Buffer.from(msg.data.payload.body.data, 'base64').toString(
        'utf-8'
      );
    }

    emailData.push({
      messageId: message.id,
      from,
      to,
      date,
      subject,
      bodyText,
      bodyHtml,
      attachments,
      mimeType: mimeTypes,
    });
  }
  res.json(emailData);
}

function extractBody(parts) {
  let bodyText = '';
  let bodyHtml = '';
  let attachments = [];
  let mimeType = '';

  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body.data) {
      bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      mimeType = 'text/plain';
    } else if (part.mimeType === 'text/html' && part.body.data) {
      bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      mimeType = 'text/html';
    } else if (part.filename && part.body && part.body.attachmentId) {
      const attachment = {
        filename: part.filename,
        attachmentId: part.body.attachmentId,
      };
      attachments.push(attachment);
    } else if (part.parts) {
      const subpartsData = extractBody(part.parts);
      bodyText += subpartsData.bodyText;
      bodyHtml += subpartsData.bodyHtml;
      attachments = attachments.concat(subpartsData.attachments);
      mimeType = subpartsData.mimeType;
    }
  }
  return { bodyText, bodyHtml, bodyAttachments: attachments, mimeType };
}

async function sendEmail(auth, req, res) {
  const { fromAddress, toAddress, subject, message } = req.body;
  console.log(req.body);
  const gmail = google.gmail({ version: 'v1', auth });

  const emailLines = [
    `From: ${fromAddress}`,
    `To: ${toAddress}`,
    'Content-Type: text/html; charset=utf-8',
    `Subject: ${subject}`,
    '',
    message,
  ];
  const email = emailLines.join('\n');

  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });
    console.log('Email sent successfully:', response.data);
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function markEmailAsRead(auth, messageId, req, res) {
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const response = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
    return res.json({ message: 'Email marked as read successfully' });
  } catch (error) {
    console.error('Error marking email as read:', error);
    throw error;
  }
}

async function getAttachment(auth, messageId, attachmentId, res) {
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId,
    });

    if (!attachment || !attachment.data || !attachment.data.data) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    const attachmentData = attachment.data.data;
    const size = attachment.data.size;
    res.json({ data: attachmentData, size });
  } catch (error) {
    console.error('Error fetching attachment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function deleteEmail(auth, messageId, req, res) {
  const gmail = google.gmail({ version: 'v1', auth });
  try {
    const response = await gmail.users.messages.delete({
      userId: 'me',
      id: messageId,
    });
    return res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    console.error('Error deleting email:', error);
    throw error;
  }
}

async function handlePubSubNotification(req, res) {
  const pubsubMessage = req.body.message;

  if (!pubsubMessage) {
    console.error('No Pub/Sub message received');
    res.status(400).send('No Pub/Sub message received');
    return;
  }

  const data = pubsubMessage.data
    ? Buffer.from(pubsubMessage.data, 'base64').toString()
    : '{}';
  const message = JSON.parse(data);

  console.log('Received Pub/Sub message:', message);

  if (message.emailAddress) {
    try {
      const auth = await authorize();
      await processNewEmails(auth, message.emailAddress);
      res.status(200).send('Processed Pub/Sub message');
    } catch (error) {
      console.error('Error processing Pub/Sub message:', error);
      res.status(500).send('Error processing Pub/Sub message');
    }
  } else {
    res.status(400).send('Invalid Pub/Sub message format');
  }
}

async function processNewEmails(auth, emailAddress) {
  const gmail = google.gmail({ version: 'v1', auth });
  const gmailRes = await gmail.users.messages.list({
    userId: emailAddress,
    q: 'is:unread',
    maxResults: 10,
  });

  const messages = gmailRes.data.messages;
  if (!messages || messages.length === 0) {
    console.log('No unread messages found.');
    return;
  }

  for (const message of messages) {
    const msg = await gmail.users.messages.get({
      userId: emailAddress,
      id: message.id,
    });

    const subjectHeader = msg.data.payload.headers.find(
      (header) => header.name === 'Subject'
    );

    const fromHeader = msg.data.payload.headers.find(
      (header) => header.name === 'From'
    );

    const subject = subjectHeader ? subjectHeader.value : 'No Subject';
    const from = fromHeader ? fromHeader.value : 'Unknown sender';

    console.log(`New email from ${from} with subject: ${subject}`);

    //Acá podríamos llamar a un servidor de websockets para alertar al front
  }
}

async function setWatch(auth) {
  const gmail = google.gmail({ version: 'v1', auth });

  const watchRequest = {
    userId: 'me',
    requestBody: {
      labelIds: ['INBOX'],
      topicName: `projects/${process.env.PORJECT_ID}/topics/${process.env.PUB_SUB_TOPIC_NAME}`,
    },
  };

  try {
    const response = await gmail.users.watch(watchRequest);
    console.log('Watch set successfully:', response.data);
  } catch (error) {
    console.error('Error setting watch:', error);
  }
}

module.exports = {
  getEmails,
  authorize,
  sendEmail,
  markEmailAsRead,
  getAttachment,
  deleteEmail,
  setWatch,
  //quickstart,
  handlePubSubNotification,
};
