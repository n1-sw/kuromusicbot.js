const { MongoClient } = require('mongodb');
const config = require('../../config/config');

class MongoDB {
  constructor() {
    this.client = null;
    this.db = null;
    this.connected = false;
  }

  async connect() {
    try {
      this.client = new MongoClient(config.mongoUri);
      await this.client.connect();
      this.db = this.client.db();
      this.connected = true;
      console.log('✅ Connected to MongoDB');
      
      await this.db.collection('dm_messages').createIndex({ userId: 1, createdAt: -1 });
      await this.db.collection('bot_stats').createIndex({ type: 1 });
      
      return true;
    } catch (error) {
      console.error('❌ MongoDB Connection Error:', error.message);
      this.connected = false;
      return false;
    }
  }

  async saveDM(userId, username, content, attachments = []) {
    if (!this.connected) return false;
    
    try {
      const dmData = {
        userId,
        username,
        content,
        attachments,
        createdAt: new Date(),
        timestamp: Date.now()
      };

      await this.db.collection('dm_messages').insertOne(dmData);
      return true;
    } catch (error) {
      console.error('Error saving DM:', error);
      return false;
    }
  }

  async getDMs(userId, limit = 50) {
    if (!this.connected) return [];
    
    try {
      const messages = await this.db.collection('dm_messages')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      
      return messages;
    } catch (error) {
      console.error('Error fetching DMs:', error);
      return [];
    }
  }

  async updateStats(type, increment = 1) {
    if (!this.connected) return;
    
    try {
      await this.db.collection('bot_stats').updateOne(
        { type },
        { $inc: { count: increment }, $set: { lastUpdated: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  async getStats() {
    if (!this.connected) return {};
    
    try {
      const stats = await this.db.collection('bot_stats').find().toArray();
      return stats.reduce((acc, stat) => {
        acc[stat.type] = stat.count;
        return acc;
      }, {});
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {};
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      console.log('✅ Disconnected from MongoDB');
    }
  }
}

module.exports = new MongoDB();
