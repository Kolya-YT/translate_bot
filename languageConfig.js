const fs = require('fs');
const path = require('path');

const configFilePath = path.join(__dirname, 'serverLanguages.json');

const loadServerLanguages = (serverLanguages) => {
  if (fs.existsSync(configFilePath)) {
    const data = fs.readFileSync(configFilePath);
    const loadedLanguages = JSON.parse(data);
    for (const [guildId, languages] of Object.entries(loadedLanguages)) {
      serverLanguages.set(guildId, languages);
    }
    console.log('Server languages loaded from file.');
  } else {
    console.log('No server languages configuration file found.');
  }
};

const saveServerLanguages = (serverLanguages) => {
  const data = JSON.stringify(Object.fromEntries(serverLanguages), null, 2);
  fs.writeFileSync(configFilePath, data);
  console.log('Server languages configuration saved.');
};

module.exports = {
  loadServerLanguages,
  saveServerLanguages,
};
