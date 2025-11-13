class MusicQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.tracks = [];
    this.currentTrack = null;
    this.loopMode = 'off';
    this.connection = null;
    this.player = null;
    this.textChannel = null;
    this.isPlaying = false;
    this.volume = 100;
  }

  addTrack(track) {
    this.tracks.push(track);
  }

  addTracks(tracks) {
    this.tracks.push(...tracks);
  }

  getNextTrack() {
    if (this.loopMode === 'track' && this.currentTrack) {
      return this.currentTrack;
    }

    if (this.tracks.length === 0) {
      if (this.loopMode === 'queue' && this.currentTrack) {
        return this.currentTrack;
      }
      return null;
    }

    const nextTrack = this.tracks.shift();
    
    if (this.loopMode === 'queue' && this.currentTrack) {
      this.tracks.push(this.currentTrack);
    }

    return nextTrack;
  }

  clear() {
    this.tracks = [];
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  remove(index) {
    if (index >= 0 && index < this.tracks.length) {
      return this.tracks.splice(index, 1)[0];
    }
    return null;
  }

  setLoop(mode) {
    const validModes = ['off', 'track', 'queue'];
    if (validModes.includes(mode)) {
      this.loopMode = mode;
      return true;
    }
    return false;
  }

  isEmpty() {
    return this.tracks.length === 0;
  }

  getQueue() {
    return this.tracks;
  }
}

module.exports = MusicQueue;
