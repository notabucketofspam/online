export default class MediaPlayer {
	auxcord: AudioContext;
	gainode: GainNode;
	soundbuffers: Map<string, AudioBuffer>;

  constructor () {
		this.auxcord = new AudioContext();
		this.gainode = new GainNode(this.auxcord, {gain: 0.2});
    this.gainode.connect(this.auxcord.destination);
		this.soundbuffers = new Map();
  }
  async gimmefile(fname: string) {
    try {
      var far = await fetch(fname);
      var bar = await far.arrayBuffer();
      var dar = await this.auxcord.decodeAudioData(bar);
      this.soundbuffers.set(fname, dar);
      return dar;
    } catch(err) {
      throw err;
    }
  }
  async beep(fname: string) {
    try{
      var somebuffer = this.soundbuffers.get(fname);
      if (typeof somebuffer === 'undefined') {
        somebuffer = await this.gimmefile(fname);
      }
      var someabsn = new AudioBufferSourceNode(this.auxcord, {buffer: somebuffer});
      someabsn.connect(this.gainode);
      someabsn.start();
    } catch(err) {
      console.error(`Error playing sound ${fname}:`, err);
    }
  }
  setGain(value: number) {
    try {
      this.gainode.gain.setValueAtTime(value, this.auxcord.currentTime);
    } catch(err) {}
  }
}
