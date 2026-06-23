import { supabase } from './supabase';

let localCache = { categories: [], videos: [] };

export const initStorage = async () => {
  try {
    const { data, error } = await supabase.from('vocaloop_store').select('data').eq('id', 1).single();
    if (data && data.data) {
      localCache = data.data;
    }
  } catch (err) {
    console.error("Error fetching from Supabase:", err);
  }
  return localCache;
};

export const getStorageData = () => {
  return localCache;
};

export const saveStorageData = async (data) => {
  localCache = data;
  const adminSecret = sessionStorage.getItem('admin_secret');
  if (adminSecret) {
    try {
      const { error } = await supabase.rpc('update_vocaloop_data', { secret_key: adminSecret, new_data: data });
      if (error) console.error("RPC Error:", error);
    } catch (err) {
      console.error("Failed to sync to Supabase:", err);
    }
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

