import defaultDataJson from '../data/defaultData.json';

const STORAGE_KEY = 'vocaloop_data';

export const getStorageData = () => {
  const baseData = JSON.parse(JSON.stringify(defaultDataJson));
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const localData = JSON.parse(data);
      const mergedVideos = [...(baseData.videos || [])];
      
      if (localData.videos) {
        localData.videos.forEach(lv => {
          const bv = mergedVideos.find(v => v.id === lv.id);
          if (!bv) {
            mergedVideos.push(lv);
          } else {
            bv.views = Math.max(bv.views || 0, lv.views || 0);
            bv.watchedSeconds = Math.max(bv.watchedSeconds || 0, lv.watchedSeconds || 0);
            if (lv.loops) {
              if (!bv.loops) bv.loops = [];
              lv.loops.forEach(ll => {
                const bl = bv.loops.find(l => l.id === ll.id);
                if (!bl) {
                  bv.loops.push(ll);
                } else {
                  bl.playCount = Math.max(bl.playCount || 0, ll.playCount || 0);
                  bl.watchTime = Math.max(bl.watchTime || 0, ll.watchTime || 0);
                }
              });
              bv.loops.sort((a,b) => a.start - b.start);
            }
          }
        });
      }

      const mergedCategories = [...(baseData.categories || [])];
      if (localData.categories) {
        localData.categories.forEach(lc => {
          if (!mergedCategories.find(c => c.id === lc.id)) {
            mergedCategories.push(lc);
          }
        });
      }
      return { categories: mergedCategories, videos: mergedVideos };
    }
  } catch (e) {
    console.error("Error reading storage:", e);
  }
  return baseData;
};

export const saveStorageData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  
  if (import.meta.env.DEV) {
    fetch('/api/save-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2)
    }).catch(err => console.error("Auto-save failed:", err));
  }
};

export const addCategory = (name) => {
  const data = getStorageData();
  const newCat = { id: `c_${Date.now()}`, name };
  data.categories.push(newCat);
  saveStorageData(data);
  return data;
};

export const updateCategory = (id, name) => {
  const data = getStorageData();
  const cat = data.categories.find(c => c.id === id);
  if (cat) {
    cat.name = name;
    saveStorageData(data);
  }
  return data;
};

export const removeCategory = (id) => {
  const data = getStorageData();
  data.categories = data.categories.filter(c => c.id !== id);
  data.videos = data.videos.filter(v => v.categoryId !== id);
  saveStorageData(data);
  return data;
};

export const addVideo = (categoryId, title, url) => {
  const data = getStorageData();
  const newVideo = {
    id: `v_${Date.now()}`,
    categoryId,
    title,
    url,
    views: 0,
    watchedSeconds: 0,
    loops: []
  };
  data.videos.push(newVideo);
  saveStorageData(data);
  return data;
};

export const updateVideo = (id, title, url) => {
  const data = getStorageData();
  const video = data.videos.find(v => v.id === id);
  if (video) {
    video.title = title;
    video.url = url;
    saveStorageData(data);
  }
  return data;
};

export const removeVideo = (id) => {
  const data = getStorageData();
  data.videos = data.videos.filter(v => v.id !== id);
  saveStorageData(data);
  return data;
};

export const addViewCount = (videoId) => {
  const data = getStorageData();
  const video = data.videos.find(v => v.id === videoId);
  if (video) {
    video.views = (video.views || 0) + 1;
    saveStorageData(data);
  }
  return data;
};

export const addWatchedTime = (videoId, seconds) => {
  const data = getStorageData();
  const video = data.videos.find(v => v.id === videoId);
  if (video) {
    video.watchedSeconds = (video.watchedSeconds || 0) + seconds;
    saveStorageData(data);
  }
  return data;
};

export const addLoop = (videoId, start, end, targetRepeats = 0, title = '') => {
  const data = getStorageData();
  const video = data.videos.find(v => v.id === videoId);
  if (video) {
    if (!video.loops) video.loops = [];
    video.loops.push({
      id: `l_${Date.now()}`,
      start,
      end,
      targetRepeats,
      currentCount: 0,
      title: title || `구간 ${video.loops.length + 1}`
    });
    // Sort loops by start time
    video.loops.sort((a,b) => a.start - b.start);
    saveStorageData(data);
  }
  return data;
};

export const updateLoop = (videoId, loopId, updates) => {
  const data = getStorageData();
  const video = data.videos.find(v => v.id === videoId);
  if (video) {
    const loop = video.loops.find(l => l.id === loopId);
    if (loop) {
      if (updates.title !== undefined) loop.title = updates.title;
      if (updates.start !== undefined) loop.start = updates.start;
      if (updates.end !== undefined) loop.end = updates.end;
      if (updates.targetRepeats !== undefined) loop.targetRepeats = updates.targetRepeats;
    }
    video.loops.sort((a,b) => a.start - b.start);
    saveStorageData(data);
  }
  return data;
};

export const removeLoop = (videoId, loopId) => {
  const data = getStorageData();
  const video = data.videos.find(v => v.id === videoId);
  if (video) {
    video.loops = video.loops.filter(l => l.id !== loopId);
    saveStorageData(data);
  }
  return data;
};

export const updateLoopRepeats = (videoId, loopId, targetRepeats) => {
  const data = getStorageData();
  const video = data.videos.find(v => v.id === videoId);
  if (video) {
    const loop = video.loops.find(l => l.id === loopId);
    if(loop) loop.targetRepeats = targetRepeats;
    saveStorageData(data);
  }
  return data;
};

export const addLoopAnalytics = (videoId, loopId, watchedSeconds, playCount) => {
  const data = getStorageData();
  const video = data.videos.find(v => v.id === videoId);
  if (video) {
    const loop = video.loops.find(l => l.id === loopId);
    if (loop) {
      loop.playCount = (loop.playCount || 0) + playCount;
      loop.watchTime = (loop.watchTime || 0) + watchedSeconds;
      saveStorageData(data);
    }
  }
  return data;
};

