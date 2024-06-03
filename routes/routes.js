const express = require('express');
const {
  getEmails,
  authorize,
  sendEmail,
  getAttachment,
  deleteEmail,
  handlePubSubNotification,
} = require('../controller/controllers');

const router = express.Router();

router.post('/pubsub', handlePubSubNotification);

router.get('/', async (req, res) => {
  try {
    const auth = await authorize();
    const pageToken = req.query.pageToken || null;

    await getEmails(auth, res, '', pageToken);
  } catch (err) {
    console.error('Error getting emails:', err);
    res.status(500).send('Error getting emails');
  }
});

router.get('/sender', async (req, res) => {
  try {
    const auth = await authorize();
    const { sender } = req.query;
    await getEmails(auth, res, sender);
  } catch (err) {
    console.error('Error getting emails:', err);
    res.status(500).send('Error getting emails');
  }
});

router.post('/send', async (req, res) => {
  try {
    const auth = await authorize();
    await sendEmail(auth, req, res);
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).send('Error sending email');
  }
});

router.post('/read', async (req, res) => {
  try {
    const auth = await authorize();
    const { messageId } = req.body;
    await markEmailAsRead(auth, messageId, req, res);
  } catch (err) {
    console.error('Error marking email as read:', err);
    res.status(500).send('Error marking email as read');
  }
});

router.post('/attachment', async (req, res) => {
  try {
    const auth = await authorize();
    const { messageId, attachmentId } = req.body;
    await getAttachment(auth, messageId, attachmentId, res);
  } catch (err) {
    console.error('Error getting attachment:', err);
    res.status(500).send('Error getting attachment');
  }
});

router.post('/delete', async (req, res) => {
  try {
    const auth = await authorize();
    const { messageId } = req.body;
    await deleteEmail(auth, messageId, req, res);
  } catch (err) {
    console.error('Error deleting email:', err);
    res.status(500).send('Error deleting email');
  }
});

module.exports = router;
