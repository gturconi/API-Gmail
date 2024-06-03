const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

const SCOPES = ['https://mail.google.com/'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.error('Error loading saved credentials:', err);
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

async function getEmails(auth, res, sender = '') {
  const gmail = google.gmail({ version: 'v1', auth });
  const gmailRes = await gmail.users.messages.list({
    userId: 'me',
    q: sender != '' ? 'from:' + sender : '',
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

  //console.log(' extractBody: ', parts);
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body.data) {
      bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      mimeType = 'text/plain';
    } else if (part.mimeType === 'text/html' && part.body.data) {
      bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      mimeType = 'text/html';
    } else if (part.filename && part.body && part.body.attachmentId) {
      //attachments.push(part.filename);

      const attachment = {
        filename: part.filename,
        attachmentId: part.body.attachmentId,
      };
      attachments.push(attachment);
    } else if (part.parts) {
      // Si se trata de un correo reenviado hay que acceder recursivamente
      const subpartsData = extractBody(part.parts);
      bodyText += subpartsData.bodyText;
      bodyHtml += subpartsData.bodyHtml;
      attachments = attachments.concat(subpartsData.attachments);
      mimeType = subpartsData.mimeType;
    }
  }
  //console.log(' mimeType: ', mimeType);
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
    console.log('attachment: ', attachment);
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

module.exports = {
  getEmails,
  authorize,
  sendEmail,
  markEmailAsRead,
  getAttachment,
  deleteEmail,
};
