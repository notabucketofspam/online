var MediaPlayer = {
	auxcord: null,
	gainode: null,
	soundbuffers: null,
	async init() {
		MediaPlayer.auxcord = new AudioContext();
		MediaPlayer.gainode = new GainNode(MediaPlayer.auxcord, {gain: 0.3});
		MediaPlayer.gainode.connect(MediaPlayer.auxcord.destination);
		MediaPlayer.soundbuffers = new Map();
	},
	async gimmefile(fname) {
		var far = await fetch(`/page/soundboard/opodes/${fname}.opus`);
		var bar = await far.arrayBuffer();
		var dar = await MediaPlayer.auxcord.decodeAudioData(bar);
		MediaPlayer.soundbuffers.set(fname, dar);
		return dar;
	},
	async beep(fname) {
		var somebuffer = MediaPlayer.soundbuffers.get(fname);
		if (typeof somebuffer === 'undefined') {
			somebuffer = await MediaPlayer.gimmefile(fname);
		}
		var someabsn = new AudioBufferSourceNode(MediaPlayer.auxcord, {buffer: somebuffer});
		someabsn.connect(MediaPlayer.gainode);
		someabsn.start();
	}
};
window.MediaPlayer = MediaPlayer;
MediaPlayer.init();

