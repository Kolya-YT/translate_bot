const { Client, IntentsBitField } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');  // Подключаем модуль path
const { loadCommands, handleInteraction } = require('./commands');
const { loadServerLanguages, saveServerLanguages } = require('./languageConfig');
const translate = require('google-translate-api-x');
const langdetect = require('langdetect');
const { flagToLang, quickTranslateFlags } = require('./languages');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessageReactions,
  ],
});

const allowedGuildIds = process.env.ALLOWED_GUILD_IDS.split(',');
const chatConfigPath = path.join(__dirname, 'chatConfig.json');
const chatConfig = JSON.parse(fs.readFileSync(chatConfigPath, 'utf8'));

const serverLanguages = new Map();
const translatedMessages = new Map();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await loadCommands(client); // Register commands for all servers

  loadServerLanguages(serverLanguages);
  await loadCommands(client); // Register commands for all servers

  // Load messages from all channels in allowed guilds
  client.guilds.cache.forEach(guild => {
    if (allowedGuildIds.includes(guild.id)) {
      const channels = guild.channels.cache.filter(channel => channel.isTextBased());
      channels.forEach(channel => fetchAndProcessMessages(channel));
    }
  });
});

// Обработка реакций на сообщение
async function processMessageReactions(message, update = false) {
  const content = message.content.trim();
  if (!content) return;

  const guildId = message.guild.id;
  const guildLanguages = serverLanguages.get(guildId) || quickTranslateFlags.map(flag => flagToLang[flag]);

  try {
    const detectedLang = langdetect.detect(content)[0]?.language || 'unknown';
    const filteredFlags = quickTranslateFlags.filter(flag =>
      guildLanguages.includes(flagToLang[flag]) && flagToLang[flag] !== detectedLang
    );

    if (update) {
      await Promise.all(message.reactions.cache.map(reaction => reaction.remove()));
    }

    await Promise.all(filteredFlags.map(async flag => {
      await message.react(flag);

      const targetLang = flagToLang[flag];
      try {
        const translation = await translate(content, { to: targetLang });
        const translatedText = translation.text;

        const key = `${message.id}-${flag}`;
        const replyMessage = await message.reply(`(${flag}) ${translatedText}`);
        translatedMessages.set(key, replyMessage);
      } catch (error) {
        console.error(`Error translating to ${targetLang}:`, error);
      }
    }));
  } catch (error) {
    console.error('Error processing message:', error);
  }
}


client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  console.log(`Received command: ${interaction.commandName}`);

  try {
    await handleInteraction(interaction, serverLanguages);
  } catch (error) {
    console.error('Error handling interaction:', error);
    await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !allowedGuildIds.includes(message.guild.id)) return;

  const guildId = message.guild.id;
  const channelId = message.channel.id;

  // Проверяем, что канал разрешён для реакции
  const serverConfig = chatConfig.servers[guildId];

  if (!serverConfig || (!serverConfig.channels.includes("ALL") && !serverConfig.channels.includes(channelId))) {

    return; // Пропустить, если канал не разрешён
  }

  // Добавляем реакции, если канал разрешён
  await addReactionsToMessage(message); // Добавляем реакции к новому сообщению

  // Check if the channel is allowed
  const allowedChannels = serverConfig.channels;
  if (!allowedChannels.includes("ALL") && !allowedChannels.includes(channelId)) {
    return; // Skip messages from non-allowed channels
  }

  const content = message.content.trim();
  if (!content) return;

  const guildLanguages = serverLanguages.get(guildId) || quickTranslateFlags.map(flag => flagToLang[flag]);

  try {
    const detectedLang = langdetect.detect(content)[0]?.language || 'unknown';
    console.log(`Detected language: ${detectedLang}`);

    const filteredFlags = quickTranslateFlags.filter(flag => guildLanguages.includes(flagToLang[flag]) && flagToLang[flag] !== detectedLang);

    await Promise.all(filteredFlags.map(flag => message.react(flag)));
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

async function addReactionsToMessage(message) {
  const guildId = message.guild.id;
  const channelId = message.channel.id;
  const content = message.content.trim();

  // Проверка, что канал разрешён для реакции
  const serverConfig = chatConfig.servers[guildId];

  if (!serverConfig || (!serverConfig.channels.includes("ALL") && !serverConfig.channels.includes(channelId))) {

    return; // Пропуск, если канал не разрешён
  }

  if (!content) return;

  const guildLanguages = serverLanguages.get(guildId) || quickTranslateFlags.map(flag => flagToLang[flag]);

  try {
    // Проверяем язык контента
    const detectedLang = langdetect.detect(content)[0]?.language || 'unknown';

    const filteredFlags = quickTranslateFlags.filter(flag => guildLanguages.includes(flagToLang[flag]) && flagToLang[flag] !== detectedLang);

    // Добавляем реакции, если канал разрешён и реакции соответствуют языку
    await Promise.all(filteredFlags.map(async (flag) => {
      await message.react(flag); // Добавляем реакцию для каждого флага
    }));
  } catch (error) {
  }
}

client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || !reaction.message.guild || !allowedGuildIds.includes(reaction.message.guild.id)) return;

  const guildLanguages = serverLanguages.get(reaction.message.guild.id) || quickTranslateFlags.map(flag => flagToLang[flag]);

  if (flagToLang.hasOwnProperty(reaction.emoji.name) && guildLanguages.includes(flagToLang[reaction.emoji.name])) {
    const lang = flagToLang[reaction.emoji.name];
    try {
      const translatedMessage = await translate(reaction.message.content, { to: lang });
      const translatedLabel = await translate('Translation', { to: lang });
      const sentMessage = await reaction.message.reply(`${reaction.emoji.name} - **${translatedLabel.text}:** ${translatedMessage.text}`);
      translatedMessages.set(`${reaction.message.id}-${reaction.emoji.name}`, sentMessage);
    } catch (error) {
      console.error('Error translating message:', error);
    }
  }
});



client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot || !reaction.message.guild || !allowedGuildIds.includes(reaction.message.guild.id)) return;

  const key = `${reaction.message.id}-${reaction.emoji.name}`;
  const sentMessage = translatedMessages.get(key);
  if (sentMessage) {
    try {
      await sentMessage.delete();
      translatedMessages.delete(key);
    } catch (error) {
      console.error('Error deleting translated message:', error);
    }
  }
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (newMessage.author.bot || !newMessage.guild || !allowedGuildIds.includes(newMessage.guild.id)) return;

  const content = newMessage.content.trim();
  if (!content) return;

  const guildLanguages = serverLanguages.get(newMessage.guild.id) || quickTranslateFlags.map(flag => flagToLang[flag]);

  try {
    const detectedLang = langdetect.detect(content)[0]?.language || 'unknown';

    const filteredFlags = quickTranslateFlags.filter(flag => guildLanguages.includes(flagToLang[flag]) && flagToLang[flag] !== detectedLang);

    // Убираем старые реакции и добавляем новые
    const oldReactions = newMessage.reactions.cache.map(reaction => reaction.remove());
    const newReactions = filteredFlags.map(flag => newMessage.react(flag));

    await Promise.all([...oldReactions, ...newReactions]);
  } catch (error) {
    console.error('Error processing updated message:', error);
  }
});



async function fetchAndProcessMessages(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 }); // Загружаем последние 100 сообщений
    for (const message of messages.values()) {
      await addReactionsToMessage(message); // Добавляем реакции к каждому сообщению
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}



process.on('exit', () => saveServerLanguages(serverLanguages));
process.on('SIGINT', () => {
  saveServerLanguages(serverLanguages);
  process.exit();
});

client.login(process.env.TOKEN);
