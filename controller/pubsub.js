const { PubSub } = require('@google-cloud/pubsub');

const listenForPushMessages = (payload) => {
  const message = Buffer.from(payload, 'base64').toString('utf-8');
  let parsedMessage = JSON.parse(message);
  console.log('Message Pushed: \n', parsedMessage);
  return parsedMessage;
};

/*
// Crea una instancia del cliente de Pub/Sub
const pubsub = new PubSub({
  projectId: 'prueba-424716',
  credentials: {
    client_email: 'your-client-email',
    private_key: 'your-private-key',
  },
});

// Obtiene una lista de temas
async function listTopics() {
  const [topics] = await pubsub.getTopics();
  console.log('Topics:');
  topics.forEach((topic) => console.log(topic.name));
}

// Obtiene una lista de suscripciones para un tema específico
async function listSubscriptions(topicName) {
  const [subscriptions] = await pubsub.topic(topicName).getSubscriptions();
  console.log(`Subscriptions for topic ${topicName}:`);
  subscriptions.forEach((subscription) => console.log(subscription.name));
}

// Obtiene los registros de una suscripción específica
async function listSubscriptionLogs(subscriptionName) {
  const [logs] = await pubsub.subscription(subscriptionName).getLogs();
  console.log(`Logs for subscription ${subscriptionName}:`);
  logs.forEach((log) => console.log(log));
}

// Ejecuta las funciones para listar temas, suscripciones y registros
async function main() {
  await listTopics();
  await listSubscriptions('MyTopic');
  await listSubscriptionLogs('incoming-emails');
}

// Ejecuta la función principal
main().catch(console.error);
*/
