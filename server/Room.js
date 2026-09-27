export class Room {
  constructor({ id, videoId, playing = false, position = 0 }) {
    this.id = id; this.videoId = videoId; this.playing = Boolean(playing); this.position = position;
    this.updatedAt = Date.now(); this.participants = new Map();
  }
  add(participant) { this.participants.set(participant.socketId, participant); }
  remove(socketId) { this.participants.delete(socketId); }
  get(socketId) { return this.participants.get(socketId); }
  members() { return [...this.participants.values()].map(({ socketId, ...member }) => member); }
  state() { return { videoId: this.videoId, playing: this.playing, position: this.position, updatedAt: this.updatedAt }; }
  updateState({ videoId, playing, position }) {
    if (videoId !== undefined) this.videoId = videoId;
    if (playing !== undefined) this.playing = playing;
    if (position !== undefined) this.position = Math.max(0, Number(position) || 0);
    this.updatedAt = Date.now();
  }
}
