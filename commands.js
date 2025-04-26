const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load chat configuration
const chatConfigPath = path.join(__dirname, 'chatConfig.json');
const chatConfig = JSON.parse(fs.readFileSync(chatConfigPath, 'utf8'));

// Define commands
const commands = [
  {
    name: 'add-language',
    description: 'Add a language to the list of available languages on the server',
    options: [
      {
        name: 'language',
        description: 'The language code to add (e.g., en, ru)',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'server-info',
    description: 'Get detailed information about the server',
  },  
  {
    name: 'clear-bot-messages',
    description: 'Clear messages from bot in this channel',
    options: [
      {
        name: 'amount',
        description: 'Number of recent messages to clear',
        type: 4, // INTEGER
        required: true,
      },
    ],
  },
  
  {
    name: 'clear-bot-reactions',
    description: 'Clear reactions from bot in this channel',
    options: [
      {
        name: 'amount',
        description: 'Number of recent messages to clear',
        type: 4, // INTEGER
        required: true,
      },
    ],
  },    
  {
    name: 'add-chat',
    description: 'Add the current chat to the list of allowed chats for this server',
  },
  {
    name: 'remove-chat',
    description: 'Remove the current chat from the list of allowed chats for this server',
  },
  {
    name: 'schedule-message',
    description: 'Schedule a message to be sent at a specific date and time',
    options: [
      {
        name: 'message',
        description: 'The message to send',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'date-time',
        description: 'The date and time to send the message (format: YYYY-MM-DD HH:MM)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'channel',
        description: 'The channel where the message will be sent',
        type: 7, // CHANNEL
        required: true,
      },
      {
        name: 'timezone',
        description: 'The time zone to use for the scheduled time (e.g., UTC, UTC+3, UTC-5)',
        type: 3, // STRING
        required: false,
      },
      {
        name: 'repeat',
        description: 'Should this message repeat? (Daily, Weekly)',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'None', value: 'none' },
          { name: 'Daily', value: 'daily' },
          { name: 'Weekly', value: 'weekly' },
        ],
      },
    ],
  },  
  {
    name: 'remove-language',
    description: 'Remove a language from the list of available languages on the server',
    options: [
      {
        name: 'language',
        description: 'The language code to remove (e.g., en, ru)',
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'list-languages',
    description: 'Show active and available languages on the server',
  },
  {
    name: 'chat-list',
    description: 'Show the list of allowed chats for this server',
  },
];

// Load and register commands
const loadCommands = async (client) => {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    Object.keys(chatConfig.servers).forEach(async (guildId) => {
      // Check if bot is present in the server
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        console.log(`Bot is not on server with ID: ${guildId}. Skipping registration.`);
        return; // Skip if bot is not in the server
      }

      // Register new commands or update existing ones
      for (const command of commands) {
        try {
          await rest.post(
            Routes.applicationGuildCommands(client.user.id, guildId),
            { body: command }
          );
          console.log(`Command '${command.name}' registered on server: ${guildId}`);
        } catch (error) {
          console.error(`Error registering command '${command.name}' on server: ${guildId}`, error);
        }
      }
    });
  } catch (error) {
    console.error('Error registering or updating commands:', error);
  }
};

// Handle interaction commands
const handleInteraction = async (interaction, serverLanguages) => {
  const { commandName, options, guildId, member, channelId } = interaction;
  console.log(`Executing command: ${commandName}, from user: ${member.user.tag}`);
  console.log(`Guild ID: ${guildId}, Channel ID: ${channelId}`);

  if (!(guildId in chatConfig.servers)) {
    console.log(`Server ${guildId} is not authorized.`);
    await interaction.reply({ content: 'This server is not authorized to use the bot.', ephemeral: true });
    return;
  }

  // Убедимся, что объект сервера существует
  if (!chatConfig.servers) {
    chatConfig.servers = {};
  }
  if (!chatConfig.servers[guildId]) {
    chatConfig.servers[guildId] = { channels: [] };
  }

  const serverConfig = chatConfig.servers[guildId];

  switch (commandName) {
    case 'add-language': {
      const lang = options.getString('language');
      console.log(`Adding language: ${lang}`);
      if (!serverLanguages.has(guildId)) {
        serverLanguages.set(guildId, []);
      }
      const guildLanguages = serverLanguages.get(guildId);
      if (!guildLanguages.includes(lang)) {
        guildLanguages.push(lang);
        serverLanguages.set(guildId, guildLanguages);
        await interaction.reply({ content: `Language \`${lang}\` has been added.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `Language \`${lang}\` is already in the list.`, ephemeral: true });
      }
      break;
    }
    case 'remove-language': {
      const lang = options.getString('language');
      console.log(`Removing language: ${lang}`);
      if (serverLanguages.has(guildId)) {
        const guildLanguages = serverLanguages.get(guildId);
        const langIndex = guildLanguages.indexOf(lang);
        if (langIndex > -1) {
          guildLanguages.splice(langIndex, 1);
          serverLanguages.set(guildId, guildLanguages);
          await interaction.reply({ content: `Language \`${lang}\` has been removed.`, ephemeral: true });
        } else {
          await interaction.reply({ content: `Language \`${lang}\` is not in the list.`, ephemeral: true });
        }
      } else {
        await interaction.reply({ content: `No languages are configured for this server.`, ephemeral: true });
      }
      break;
    }
    case 'server-info': {
      const guild = interaction.guild;
      const creationDate = guild.createdAt.toDateString();
      const memberCount = guild.memberCount;
      const channelCount = guild.channels.cache.size;
    
      await interaction.reply({
        content: `Server Info:
          - Name: ${guild.name}
          - Created on: ${creationDate}
          - Member count: ${memberCount}
          - Channel count: ${channelCount}`,
        ephemeral: true,
      });
      break;
    }  
    case 'schedule-message': {
      const message = options.getString('message');
      const dateTimeStr = options.getString('date-time');
      const timezone = options.getString('timezone') || 'UTC'; // По умолчанию UTC
      const channel = options.getChannel('channel');
      const repeat = options.getString('repeat') || 'none';
    
      // Парсим дату и время (формат: YYYY-MM-DD HH:MM)
      const [date, time] = dateTimeStr.split(' ');
      const [year, month, day] = date.split('-').map(num => parseInt(num));
      const [hour, minute] = time.split(':').map(num => parseInt(num));
    
      // Получаем смещение часового пояса (по умолчанию UTC)
      const timezoneOffset = getTimezoneOffset(timezone);
    
      // Переводим время в UTC с учётом смещения
      const scheduledTime = new Date(Date.UTC(year, month - 1, day, hour - timezoneOffset, minute));
      if (isNaN(scheduledTime.getTime()) || scheduledTime <= new Date()) {
        await interaction.reply({
          content: 'Invalid date/time format or the time is in the past. Please use the format YYYY-MM-DD HH:MM and select a future time.',
          ephemeral: true,
        });
        return;
      }
    
      // Подтверждение для пользователя
      await interaction.reply({
        content: `Your message has been scheduled to send in <#${channel.id}> on ${scheduledTime.toLocaleString()} (${timezone}).\nMessage: "${message}"\nRepeat: ${repeat === 'none' ? 'No' : repeat}`,
        ephemeral: true,
      });
    
      // Рассчитываем задержку для планирования сообщения
      const delay = scheduledTime - Date.now();
    
      // Отправляем сообщение в заданное время
      setTimeout(() => {
        channel.send(message).then(() => {
          if (repeat === 'daily') {
            // Повторяем каждый день
            setInterval(() => {
              channel.send(message);
            }, 24 * 60 * 60 * 1000);
          } else if (repeat === 'weekly') {
            // Повторяем каждую неделю
            setInterval(() => {
              channel.send(message);
            }, 7 * 24 * 60 * 60 * 1000);
          }
        });
      }, delay);
    
      break;
    }
    
    // Функция для получения смещения часового пояса
    function getTimezoneOffset(timezone) {
      const match = timezone.match(/^UTC([+-])(\d+)$/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const offset = parseInt(match[2], 10);
        return sign * offset;
      } else if (timezone === 'UTC') {
        return 0;
      } else {
        throw new Error('Invalid timezone format');
      }
    }
      
    case 'clear-bot-messages': {
      await interaction.deferReply({ ephemeral: true });
    
      const amount = options.getInteger('amount');
      if (!member.permissions.has('ManageMessages')) {
        await interaction.editReply('У вас нет прав на удаление сообщений.');
        return;
      }
    
      const channel = interaction.channel;
      try {
        const messages = await channel.messages.fetch({ limit: amount });
        const botMessages = messages.filter(msg => msg.author.bot);
    
        for (const message of botMessages.values()) {
          await message.delete();
        }
    
        await interaction.editReply(`Removed ${botMessages.size} messages from the bot.`);
      } catch (error) {
        console.error('Error clearing messages:', error);
        await interaction.editReply('Error clearing messages.');
      }
      break;
    }
    
    case 'clear-bot-reactions': {
      await interaction.deferReply({ ephemeral: true });
    
      const amount = options.getInteger('amount');
      if (!member.permissions.has('ManageMessages')) {
        await interaction.editReply('You do not have permission to delete reactions.');
        return;
      }
    
      const channel = interaction.channel;
      try {
        const messages = await channel.messages.fetch({ limit: amount });
        const botMessages = messages.filter(msg => msg.author.bot);
    
        for (const message of botMessages.values()) {
          await message.reactions.removeAll();
        }
    
        await interaction.editReply(`Removed bot reactions to ${botMessages.size} messages.`);
      } catch (error) {
        console.error('Error while cleaning reactions:', error);
        await interaction.editReply('Error clearing reactions.');
      }
      break;
    }        
    case 'add-chat': {
      if (!serverConfig.channels.includes(channelId)) {
        serverConfig.channels.push(channelId);
        fs.writeFileSync(chatConfigPath, JSON.stringify(chatConfig, null, 2));
        await interaction.reply({ content: `Chat <#${channelId}> has been added.`, ephemeral: true });

        // Добавим функцию для обработки сообщений сразу после добавления чата
        const channel = await interaction.guild.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          await fetchAndProcessMessages(channel); // Обрабатываем все сообщения в новом канале
        }
      } else {
        await interaction.reply({ content: `Chat <#${channelId}> is already allowed.`, ephemeral: true });
      }
      break;
    }
    case 'remove-chat': {
      if (serverConfig.channels.includes(channelId)) {
        serverConfig.channels = serverConfig.channels.filter(id => id !== channelId);
        fs.writeFileSync(chatConfigPath, JSON.stringify(chatConfig, null, 2));
        await interaction.reply({ content: `Chat <#${channelId}> has been removed.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `Chat <#${channelId}> is not in the allowed list.`, ephemeral: true });
      }
      break;
    }
    case 'chat-list': {
      // Отображаем список каналов для текущего сервера как упоминания
      if (serverConfig.channels.length > 0) {
        const allowedChats = serverConfig.channels.map(channelId => `<#${channelId}>`).join(', ');
        await interaction.reply({
          content: `Allowed chats for this server: ${allowedChats}`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'No channels added.',
          ephemeral: true,
        });
      }
      break;
    }
    case 'list-languages': {
      const activeLanguages = serverLanguages.get(guildId) || [];
      await interaction.reply({
        content: `**Active languages:** ${activeLanguages.join(', ') || 'No active languages'}`,
        ephemeral: true,
      });
      break;
    }
    default:
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
      break;
  }
};

// Fetch and process messages in a channel (to add reactions to previous messages)
async function fetchAndProcessMessages(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 }); // Загружаем последние 100 сообщений
    for (const message of messages.values()) {
      await addReactionsToMessage(message); // Добавляем реакции
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}

module.exports = {
  loadCommands,
  handleInteraction,
};
