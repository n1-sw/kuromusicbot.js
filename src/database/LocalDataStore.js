const fs = require('fs').promises;
const path = require('path');

class LocalDataStore {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.dataFile = path.join(this.dataDir, 'botData.json');
    this.data = {
      stats: {},
      dms: {}
    };
    this.initialized = false;
    this.saveTimeout = null;
    this.maxDmsPerUser = 100;
  }

  async init() {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.dataDir, { recursive: true });

      try {
        const fileContent = await fs.readFile(this.dataFile, 'utf8');
        this.data = JSON.parse(fileContent);
        console.log('✅ Local data store loaded');
      } catch (readError) {
        console.log('📝 Creating new data store');
        await this.save();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing data store:', error.message);
      this.initialized = false;
    }
  }

  async save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        const jsonData = JSON.stringify(this.data, null, 2);
        await fs.writeFile(this.dataFile, jsonData, 'utf8');
      } catch (error) {
        console.error('Error saving data store:', error.message);
      }
    }, 1000);
  }

  async updateStats(type, increment = 1) {
    if (!this.initialized) await this.init();

    if (!this.data.stats[type]) {
      this.data.stats[type] = 0;
    }

    this.data.stats[type] += increment;
    await this.save();
  }

  async getStats() {
    if (!this.initialized) await this.init();
    return { ...this.data.stats };
  }

  async saveDM(userId, username, content, attachments = []) {
    if (!this.initialized) await this.init();

    if (!this.data.dms[userId]) {
      this.data.dms[userId] = [];
    }

    const dmData = {
      username,
      content,
      attachments,
      createdAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    this.data.dms[userId].unshift(dmData);

    if (this.data.dms[userId].length > this.maxDmsPerUser) {
      this.data.dms[userId] = this.data.dms[userId].slice(0, this.maxDmsPerUser);
    }

    await this.save();
    return true;
  }

  async getDMs(userId, limit = 50) {
    if (!this.initialized) await this.init();

    const userDMs = this.data.dms[userId] || [];
    return userDMs.slice(0, limit);
  }

  async disconnect() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (this.initialized) {
      try {
        const jsonData = JSON.stringify(this.data, null, 2);
        await fs.writeFile(this.dataFile, jsonData, 'utf8');
        console.log('✅ Data store saved and closed');
      } catch (error) {
        console.error('Error saving data on disconnect:', error.message);
      }
    }
  }
}

module.exports = new LocalDataStore();
