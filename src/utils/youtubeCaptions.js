export const fetchCaptions = async (videoId) => {
  try {
    const extractJson = (html) => {
      let str = html.split('ytInitialPlayerResponse = ')[1] || html.split('var ytInitialPlayerResponse = ')[1];
      if (!str) return null;
      str = str.split(';</script>')[0];
      const varIdx = str.indexOf('};var ');
      if (varIdx > -1) str = str.substring(0, varIdx + 1);
      const lastBrace = str.lastIndexOf('}');
      if (lastBrace > -1) str = str.substring(0, lastBrace + 1);
      return str;
    };

    let dataStr = null;
    try {
      const response = await fetch(`/api/youtube/watch?v=${videoId}`, {
        headers: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' }
      });
      const html = await response.text();
      dataStr = extractJson(html);
    } catch(e) {}
                  
    if (!dataStr) {
      console.warn("Could not find ytInitialPlayerResponse via local proxy, trying fallback...");
      const fbResponse = await fetch(`https://corsproxy.io/?${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`);
      const fbHtml = await fbResponse.text();
      dataStr = extractJson(fbHtml);
    }

    if (!dataStr) return [];

    let data;
    try {
      data = JSON.parse(dataStr);
    } catch (e) {
      console.warn("JSON Parse Error on ytInitialPlayerResponse", e);
      return [];
    }
    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captionTracks || captionTracks.length === 0) return [];

    // Prefer Korean translation if available, otherwise original Korean, otherwise English, otherwise the first one
    let track = captionTracks.find(t => t.languageCode === 'ko' && t.kind === 'asr'); // auto-translated korean?
    if (!track) track = captionTracks.find(t => t.languageCode === 'ko');
    if (!track) track = captionTracks.find(t => t.languageCode === 'en');
    if (!track) track = captionTracks[0];

    let trackUrl = track.baseUrl;
    trackUrl += (trackUrl.includes('?') ? '&' : '?') + 'fmt=json3';

    let trackData;
    try {
      let trackProxyUrl = trackUrl;
      if (trackUrl.startsWith('https://www.youtube.com')) {
        trackProxyUrl = trackUrl.replace('https://www.youtube.com', '/api/youtube');
      }
      const trackResponse = await fetch(trackProxyUrl);
      if (!trackResponse.ok) throw new Error("Local proxy failed for track data");
      trackData = await trackResponse.json();
    } catch (err) {
      console.warn("Local proxy failed for JSON3 captions, trying fallback...");
      try {
        const fbResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(trackUrl)}`);
        trackData = await fbResponse.json();
      } catch (fbErr) {
        console.warn("AllOrigins proxy failed, trying corsproxy.io...");
        const fbResponse2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(trackUrl)}`);
        trackData = await fbResponse2.json();
      }
    }

    const events = trackData.events || [];
    const captions = events.map(e => {
      let text = '';
      if (e.segs) {
        text = e.segs.map(s => s.utf8).join('');
      }
      return {
        start: e.tStartMs / 1000,
        end: (e.tStartMs + (e.dDurationMs || 0)) / 1000,
        text: text.replace(/\n/g, ' ').trim()
      };
    }).filter(c => c.text);

    return captions;
  } catch (err) {
    console.error("Error fetching captions:", err);
    return [];
  }
}
