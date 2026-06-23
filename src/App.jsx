import React, { useState, useRef, useEffect, useCallback } from 'react';
import YouTube from 'react-youtube';
import Sidebar from './components/Sidebar';
import { 
  initStorage, getStorageData, addVideo, updateVideo, removeVideo, addViewCount, addWatchedTime, 
  addLoop, removeLoop, updateLoop, addLoopAnalytics
} from './utils/storage';
import { fetchCaptions } from './utils/youtubeCaptions';
import { Repeat, Plus, Play, Pause, Trash2, RefreshCcw, Edit2, CheckCircle, Circle, MessageSquare } from 'lucide-react';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "00:00.0";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms}`;
};

const TimeInput = ({ value, label, onSync, onChange }) => {
  const [localValue, setLocalValue] = useState(formatTime(value));
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => { if (!isEditing) setLocalValue(formatTime(value)); }, [value, isEditing]);
  const handleBlur = () => {
    setIsEditing(false);
    let parsed = parseFloat(localValue);
    if (localValue.includes(':')) {
      const parts = localValue.split(':');
      parsed = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    }
    if (!isNaN(parsed) && parsed >= 0) onChange(parsed);
    else setLocalValue(formatTime(value));
  };
  return (
    <div style={{ background: label === 'A' ? 'rgba(0, 255, 255, 0.15)' : 'rgba(255, 0, 255, 0.15)', color: label === 'A' ? '#00ffff' : '#ff00ff', padding: '4px 12px', borderRadius: '16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', border: `1px solid ${label === 'A' ? 'rgba(0,255,255,0.4)' : 'rgba(255,0,255,0.4)'}` }}>
      <span style={{ fontWeight: 'bold', cursor: 'pointer', padding: '2px 6px', background: label === 'A' ? '#00ffff' : '#ff00ff', color: label === 'A' ? '#000' : '#fff', borderRadius: '4px' }} onClick={onSync}>{label}</span>
      <input type="text" value={localValue} onChange={(e) => setLocalValue(e.target.value)} onFocus={() => setIsEditing(true)} onBlur={handleBlur} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} style={{ width: '65px', background: 'transparent', border: 'none', color: 'inherit', outline: 'none', textAlign: 'center', fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold' }} />
    </div>
  );
};

const TitleInput = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => { if (!isEditing) setLocalValue(value || ''); }, [value, isEditing]);
  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) onChange(localValue);
  };
  return (
    <input type="text" value={localValue} onChange={(e) => setLocalValue(e.target.value)} onFocus={() => setIsEditing(true)} onBlur={handleBlur} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '6px', color: 'white' }} />
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'white', background: 'red' }}>
          <h2>에러가 발생했습니다!</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
          <button onClick={() => window.location.reload()}>새로고침</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [data, setData] = useState({ categories: [], videos: [] });
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  
  // Player state
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [captions, setCaptions] = useState([]);

  // Watch time tracking
  const lastProgressTime = useRef(0);
  const accumulatedWatchTime = useRef(0);

  // Modals
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isEditingVideo, setIsEditingVideo] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');

  // Loop creation state
  const [tempLoopStart, setTempLoopStart] = useState(null);
  const [newlyAddedLoopId, setNewlyAddedLoopId] = useState(null);
  const pendingLoopRef = useRef(null);

  useEffect(() => {
    if (tempLoopStart !== null && pendingLoopRef.current) {
      pendingLoopRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [tempLoopStart]);

  // Advanced Loop Execution State
  const [activeLoop, setActiveLoop] = useState(null);
  const [activeLoopCount, setActiveLoopCount] = useState(0);
  const activeLoopState = useRef({ loopId: null, currentCount: 0 });

  // Playback Modes
  const [itemRepeats, setItemRepeats] = useState(1); // Default to 1
  const [selectedLoopIds, setSelectedLoopIds] = useState(new Set());
  const hasAutoStarted = useRef(false);
  const [activeTab, setActiveTab] = useState('ALL');

  const getVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
    if (match && match[1]) return match[1];
    const clean = url.trim();
    if (clean.length === 11) return clean;
    return null;
  };

  const currentVideo = data.videos.find(v => v.id === selectedVideoId);
  const videoId = currentVideo ? getVideoId(currentVideo.url) : null;

  useEffect(() => {
    initStorage().then(setData);
  }, []);

  // Fetch captions when videoId changes
  useEffect(() => {
    if (videoId) {
      setCaptions([]);
      fetchCaptions(videoId).then(setCaptions);
    }
  }, [videoId]);

  // Reset selected loops when switching videos (default to empty)
  useEffect(() => {
    setSelectedLoopIds(new Set());
    hasAutoStarted.current = false;
  }, [selectedVideoId]);

  const handleStateChange = (e) => {
    if (e.data === 1) { // PLAYING
      setIsPlaying(true);
      if (!hasAutoStarted.current && currentVideo?.loops?.length > 0) {
        hasAutoStarted.current = true;
        if (activeTab === 'NORMAL') return;

        const loopsToPlay = activeTab === 'SELECTED' 
          ? currentVideo.loops.filter(l => selectedLoopIds.has(l.id))
          : currentVideo.loops;
        
        const firstLoop = loopsToPlay.length > 0 ? loopsToPlay[0] : null;
        if (firstLoop && playerRef.current && playerRef.current.seekTo) {
          setActiveLoop(firstLoop);
          activeLoopState.current = { loopId: firstLoop.id, currentCount: 0 };
          setActiveLoopCount(0);
          try {
            playerRef.current.seekTo(firstLoop.start, true);
          } catch (err) {}
        }
      }
    } else if (e.data === 2 || e.data === 0) {
      setIsPlaying(false);
    }
  };

  const playSpecificLoop = (loop) => {
    if (playerRef.current && playerRef.current.seekTo) {
      setActiveLoop(loop);
      activeLoopState.current = { loopId: loop.id, currentCount: 0 };
      setActiveLoopCount(0);
      try {
        playerRef.current.seekTo(loop.start, true);
        playerRef.current.playVideo();
      } catch (e) {}
    }
  };

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    if (tabName === 'NORMAL') {
      setActiveLoop(null);
      activeLoopState.current = { loopId: null, currentCount: 0 };
      setActiveLoopCount(0);
    } else {
      const loopsToPlay = tabName === 'SELECTED' 
        ? (currentVideo?.loops || []).filter(l => selectedLoopIds.has(l.id))
        : (currentVideo?.loops || []);
      
      const firstLoop = loopsToPlay.length > 0 ? loopsToPlay[0] : null;
      if (firstLoop && playerRef.current && playerRef.current.seekTo) {
        setActiveLoop(firstLoop);
        activeLoopState.current = { loopId: firstLoop.id, currentCount: 0 };
        setActiveLoopCount(0);
        try {
          playerRef.current.seekTo(firstLoop.start, true);
          playerRef.current.playVideo();
        } catch (e) {}
      } else {
        setActiveLoop(null);
        activeLoopState.current = { loopId: null, currentCount: 0 };
        setActiveLoopCount(0);
      }
    }
  };

  const handleSelectCategory = (catId) => {
    setSelectedCategoryId(catId);
  };

  const handleSelectVideo = (vidId) => {
    if (selectedVideoId !== vidId) {
      setSelectedVideoId(vidId);
      setPlayerError(false);
      setIsPlaying(false);
      setIsReady(false);
      playerRef.current = null;
      const newData = addViewCount(vidId);
      setData(newData);
      setActiveLoop(null);
      activeLoopState.current = { loopId: null, currentCount: 0 };
      setActiveLoopCount(0);
      setActiveTab('ALL');
    }
  };

  const handleAddOrEditVideo = (e) => {
    e.preventDefault();
    if (newVideoTitle.trim() && newVideoUrl.trim() && selectedCategoryId) {
      let newData;
      if (isEditingVideo) {
        newData = updateVideo(selectedVideoId, newVideoTitle.trim(), newVideoUrl.trim());
        setPlayerError(false);
      } else {
        newData = addVideo(selectedCategoryId, newVideoTitle.trim(), newVideoUrl.trim());
      }
      setData(newData);
      setShowVideoModal(false);
      setNewVideoTitle('');
      setNewVideoUrl('');
      setIsEditingVideo(false);
    }
  };

  const openAddVideoModal = () => {
    setIsEditingVideo(false);
    setNewVideoTitle('');
    setNewVideoUrl('');
    setShowVideoModal(true);
  };

  const openEditVideoModal = () => {
    if (currentVideo) {
      setIsEditingVideo(true);
      setNewVideoTitle(currentVideo.title);
      setNewVideoUrl(currentVideo.url);
      setShowVideoModal(true);
    }
  };

  const handleDeleteVideo = () => {
    if (window.confirm('정말 이 영상을 삭제하시겠습니까?')) {
      const newData = removeVideo(selectedVideoId);
      setData(newData);
      setSelectedVideoId(null);
    }
  };

  const getNextLoop = (currentLoopId) => {
    const loops = currentVideo?.loops || [];
    if (loops.length === 0) return null;
    
    // Only selected loops are valid for jumping when in SELECTED tab
    const validLoops = activeTab === 'SELECTED' ? loops.filter(l => selectedLoopIds.has(l.id)) : loops;
    if (validLoops.length === 0) return null;

    if (!currentLoopId) return validLoops[0];

    const currentIndex = validLoops.findIndex(l => l.id === currentLoopId);
    if (currentIndex === -1) return validLoops[0];

    if (currentIndex < validLoops.length - 1) {
      return validLoops[currentIndex + 1];
    } else {
      return validLoops[0];
    }
  };

  const handleProgress = useCallback((playedSeconds) => {
    if (!isReady || playerError) return;
    setCurrentTime(playedSeconds);

    if (playedSeconds !== lastProgressTime.current) {
      accumulatedWatchTime.current += Math.abs(playedSeconds - lastProgressTime.current);
      lastProgressTime.current = playedSeconds;
      
      if (accumulatedWatchTime.current > 5) {
        if (selectedVideoId) {
          const newData = addWatchedTime(selectedVideoId, Math.floor(accumulatedWatchTime.current));
          setData(newData);
        }
        accumulatedWatchTime.current = 0;
      }
    }

    if (activeTab === 'NORMAL') return;

    if (currentVideo && currentVideo.loops && currentVideo.loops.length > 0) {
      let insideLoop = null;

      if (activeLoop) {
        // Enforce loop if it's still valid for the current tab
        if (activeTab === 'SELECTED' && !selectedLoopIds.has(activeLoop.id)) {
          setActiveLoop(null);
          activeLoopState.current = { loopId: null, currentCount: 0 };
          setActiveLoopCount(0);
          return;
        }

        if (playedSeconds >= activeLoop.end) {
          activeLoopState.current.currentCount += 1;
          setActiveLoopCount(activeLoopState.current.currentCount);
          
          const loopDuration = activeLoop.end - activeLoop.start;
          const newData = addLoopAnalytics(selectedVideoId, activeLoop.id, loopDuration, 1);
          setData(newData);

          if (itemRepeats === 0 || activeLoopState.current.currentCount < itemRepeats) {
            // Repeat current loop
            if (playerRef.current && playerRef.current.seekTo) {
              try { playerRef.current.seekTo(activeLoop.start, true); } catch (e) {}
            }
          } else {
            // Finished repeating
            // Jump to next loop based on activeTab
            const nextLoop = getNextLoop(activeLoop.id);
            if (nextLoop) {
              activeLoopState.current = { loopId: nextLoop.id, currentCount: 0 };
              setActiveLoopCount(0);
              setActiveLoop(nextLoop);
              if (playerRef.current && playerRef.current.seekTo) {
                try { playerRef.current.seekTo(nextLoop.start, true); } catch (e) {}
              }
            } else {
              setActiveLoop(null);
              activeLoopState.current = { loopId: null, currentCount: 0 };
              setActiveLoopCount(0);
            }
          }
          return;
        } else if (playedSeconds >= activeLoop.start && playedSeconds < activeLoop.end) {
          insideLoop = activeLoop;
        } else if (playedSeconds < activeLoop.start - 2 || playedSeconds > activeLoop.end + 2) {
          // User manually seeked far away
          setActiveLoop(null);
          activeLoopState.current = { loopId: null, currentCount: 0 };
          setActiveLoopCount(0);
        }
      }

      if (!insideLoop) {
        // Find if we naturally entered ANY valid loop
        const validLoops = activeTab === 'SELECTED' ? currentVideo.loops.filter(l => selectedLoopIds.has(l.id)) : currentVideo.loops;
        insideLoop = validLoops.find(l => playedSeconds >= l.start && playedSeconds <= l.end);
        if (insideLoop) {
          setActiveLoop(insideLoop);
          activeLoopState.current = { loopId: insideLoop.id, currentCount: 0 };
          setActiveLoopCount(0);
        }
      }
    }
  }, [isReady, playerError, currentVideo, selectedVideoId, activeTab, selectedLoopIds, itemRepeats, activeLoop]);

  // YouTube progress interval
  useEffect(() => {
    let intervalId;
    if (isPlaying && playerRef.current && playerRef.current.getCurrentTime) {
      intervalId = setInterval(async () => {
        try {
          const time = await playerRef.current.getCurrentTime();
          if (time !== undefined) {
            handleProgress(time);
          }
        } catch (e) {}
      }, 100);
    }
    return () => clearInterval(intervalId);
  }, [isPlaying, handleProgress]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.setPlaybackRate) {
      try { playerRef.current.setPlaybackRate(playbackRate); } catch(e){}
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (playerRef.current) {
      try {
        if (isPlaying) playerRef.current.pauseVideo();
        else playerRef.current.playVideo();
      } catch (e) {}
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00.0";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms}`;
  };

  const handleSetLoopA = () => setTempLoopStart(Math.max(0, currentTime - 1));

  const handleSetLoopB = () => {
    if (tempLoopStart !== null) {
      const end = Math.min(duration, currentTime + 1);
      let title = '';
      if (captions && captions.length > 0) {
        let match = captions.find(c => (c.start >= tempLoopStart && c.start <= end) || (c.start <= tempLoopStart && c.end >= tempLoopStart));
        if (!match) match = captions.find(c => c.start >= tempLoopStart);
        if (!match) match = captions[0];
        if (match) title = match.text;
      }
      const newData = addLoop(selectedVideoId, tempLoopStart, end, 0, title);
      setData(newData);
      
      // Auto-start next A point 0.1s after the current B point
      setTempLoopStart(end + 0.1);
      
      const newVideo = newData.videos.find(v => v.id === selectedVideoId);
      if (newVideo && newVideo.loops.length > 0) setNewlyAddedLoopId(newVideo.loops[newVideo.loops.length - 1].id);
    }
  };

  const handleUpdateLoopContent = (loopId, updates) => {
    const newData = updateLoop(selectedVideoId, loopId, updates);
    setData(newData);
  };

  const handleAutoFillTitle = (loop) => {
    if (captions && captions.length > 0) {
      let match = captions.find(c => (c.start >= loop.start && c.start <= loop.end) || (c.start <= loop.start && c.end >= loop.start));
      if (!match) match = captions.find(c => c.start >= loop.start);
      if (!match) match = captions[0];
      if (match) handleUpdateLoopContent(loop.id, { title: match.text });
    } else {
      alert("자막(CC)을 불러올 수 없습니다. 이 영상에 자막이 제공되지 않거나, 접근이 차단된 상태일 수 있습니다.");
    }
  };

  const toggleLoopSelection = (loopId) => {
    const next = new Set(selectedLoopIds);
    if (next.has(loopId)) next.delete(loopId);
    else next.add(loopId);
    setSelectedLoopIds(next);
  };

  const toggleAllSelections = () => {
    if (!currentVideo?.loops) return;
    if (selectedLoopIds.size === currentVideo.loops.length) setSelectedLoopIds(new Set());
    else setSelectedLoopIds(new Set(currentVideo.loops.map(l => l.id)));
  };

  const activeLoopRef = useRef(null);
  const newlyAddedLoopRef = useRef(null);
  
  useEffect(() => {
    if (newlyAddedLoopId && newlyAddedLoopRef.current) {
      newlyAddedLoopRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setNewlyAddedLoopId(null);
    } else if (activeLoop && activeLoopRef.current) {
      activeLoopRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLoop, newlyAddedLoopId]);

  const displayedLoops = currentVideo?.loops 
    ? (activeTab === 'SELECTED' ? currentVideo.loops.filter(l => selectedLoopIds.has(l.id)) : currentVideo.loops)
    : [];

  return (
    <div className={`app-container ${selectedVideoId ? 'video-selected' : ''}`}>
      <Sidebar 
        data={data}
        onSelectCategory={handleSelectCategory}
        selectedCategoryId={selectedCategoryId}
        onSelectVideo={handleSelectVideo}
        selectedVideoId={selectedVideoId}
        onDataChange={setData}
      />
      <main className="main-content">
        {!selectedCategoryId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>좌측에서 채널(카테고리)을 선택하거나 추가해주세요.</div>
        ) : !selectedVideoId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <p>선택된 영상이 없습니다.</p>
            <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={openAddVideoModal}><Plus size={16} /> 새 유튜브 영상 등록</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, marginRight: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="btn btn-sm btn-outline mobile-only" onClick={() => setSelectedVideoId(null)} style={{ padding: '4px', borderRadius: '50%' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', lineHeight: 1.4 }}>{currentVideo?.title}</h2>
                <div className="hide-on-mobile" style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                  <button className="btn btn-sm btn-outline" onClick={openEditVideoModal}><Edit2 size={12} /> 정보 수정</button>
                  <button className="btn btn-sm" style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }} onClick={handleDeleteVideo}><Trash2 size={12} /> 영상 삭제</button>
                </div>
              </div>
              <button className="btn btn-primary btn-sm hide-on-mobile" onClick={openAddVideoModal} style={{ flexShrink: 0 }}><Plus size={14} /> 다른 영상 등록</button>
            </div>
            <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="glass-panel" style={{ overflow: 'hidden', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                    {playerError || !videoId ? (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontWeight: 'bold' }}>영상을 재생할 수 없거나 잘못된 URL입니다.</div>
                        <button className="btn btn-outline btn-sm" onClick={openEditVideoModal} style={{ marginTop: '8px' }}>정보 수정</button>
                      </div>
                    ) : (
                      <YouTube key={videoId} videoId={videoId} opts={{ width: '100%', height: '100%', playerVars: { autoplay: 1, rel: 0, modestbranding: 1, origin: window.location.origin, enablejsapi: 1, cc_load_policy: 1, cc_lang_pref: 'ko' } }} onReady={(e) => { playerRef.current = e.target; setIsReady(true); setPlayerError(false); setDuration(e.target.getDuration()); e.target.setPlaybackRate(playbackRate); }} onStateChange={handleStateChange} onError={() => setPlayerError(true)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                    )}
                  </div>
                  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button className="btn btn-primary" onClick={togglePlay} style={{ padding: '10px', borderRadius: '50%' }} disabled={playerError || !videoId}>{isPlaying ? <Pause size={18} /> : <Play size={18} />}</button>
                      <span style={{ fontFamily: 'monospace', fontSize: '15px' }}>{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>배속:</span>
                      <select 
                        value={playbackRate} 
                        onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', outline: 'none' }}
                      >
                        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                          <option key={rate} value={rate}>{rate}x</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="glass-panel hide-on-mobile" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button className="btn btn-outline" onClick={handleSetLoopA} disabled={playerError || !videoId}>A 구간 설정</button>
                  <button className="btn btn-primary" onClick={handleSetLoopB} disabled={playerError || !videoId || tempLoopStart === null}>B 구간 설정</button>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)', marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex' }}>
                      <div style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: activeTab === 'ALL' ? '2px solid var(--primary)' : '2px solid transparent' }} onClick={() => handleTabClick('ALL')}>모든 구간</div>
                      <div style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: activeTab === 'SELECTED' ? '2px solid var(--primary)' : '2px solid transparent' }} onClick={() => handleTabClick('SELECTED')}>선택 반복</div>
                      <div style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: activeTab === 'NORMAL' ? '2px solid var(--primary)' : '2px solid transparent' }} onClick={() => handleTabClick('NORMAL')}>전체 재생</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <span>반복 횟수:</span>
                      <input type="number" value={itemRepeats} onChange={(e) => setItemRepeats(Number(e.target.value) || 0)} min="0" style={{ width: '60px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px', borderRadius: '4px', textAlign: 'center' }} />
                      <span>회</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {displayedLoops.map((loop) => (
                      <div key={loop.id} ref={newlyAddedLoopId === loop.id ? newlyAddedLoopRef : (activeLoop?.id === loop.id && activeTab !== 'NORMAL' ? activeLoopRef : null)} style={{ padding: '14px', background: activeLoop?.id === loop.id && activeTab !== 'NORMAL' ? 'rgba(0, 200, 255, 0.15)' : 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '12px', border: `1px solid ${activeLoop?.id === loop.id && activeTab !== 'NORMAL' ? 'var(--primary)' : 'var(--panel-border)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button style={{ background: 'none', border: 'none', color: activeLoop?.id === loop.id && activeTab !== 'NORMAL' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }} onClick={() => playSpecificLoop(loop)} title="이 구간만 재생하기"><Play size={20} fill={activeLoop?.id === loop.id && activeTab !== 'NORMAL' ? "currentColor" : "none"} /></button>
                          <div onClick={() => toggleLoopSelection(loop.id)} style={{ cursor: 'pointer' }}>{selectedLoopIds.has(loop.id) ? <CheckCircle size={20} color="var(--primary)" /> : <Circle size={20} color="var(--text-muted)" />}</div>
                          <TitleInput value={loop.title} onChange={(newTitle) => handleUpdateLoopContent(loop.id, { title: newTitle })} />
                          <button className="hide-on-mobile" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => handleAutoFillTitle(loop)}><MessageSquare size={16} /></button>
                          <button className="hide-on-mobile" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => setData(removeLoop(selectedVideoId, loop.id))}><Trash2 size={16} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                          <div className="hide-on-mobile" style={{ display: 'flex', gap: '8px' }}>
                            <TimeInput value={loop.start} label="A" onSync={() => handleUpdateLoopContent(loop.id, { start: currentTime })} onChange={(val) => handleUpdateLoopContent(loop.id, { start: val })} />
                            <TimeInput value={loop.end} label="B" onSync={() => handleUpdateLoopContent(loop.id, { end: currentTime })} onChange={(val) => handleUpdateLoopContent(loop.id, { end: val })} />
                          </div>
                          
                          {activeLoop?.id === loop.id && activeTab !== 'NORMAL' && (
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary)', marginLeft: '8px' }}>
                              (진행: {itemRepeats > 0 ? `${activeLoopCount + 1}/${itemRepeats}` : `${activeLoopCount + 1}회`})
                            </span>
                          )}

                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '12px' }}>
                            <span title="구간 반복 재생된 횟수">▶ {loop.playCount || 0}회</span>
                            <span title="구간 누적 재생 시간">⏱ {formatTime(loop.watchTime || 0)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {tempLoopStart !== null && (
                      <div ref={pendingLoopRef} style={{ padding: '14px', background: 'rgba(0, 200, 255, 0.15)', borderRadius: '8px', marginBottom: '12px', border: '1px solid var(--primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ flex: 1, color: 'var(--primary)', fontWeight: 'bold', paddingLeft: '8px' }}>
                            새 구간 설정 진행 중...
                          </div>
                          <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => setTempLoopStart(null)} title="취소"><Trash2 size={16} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(0, 200, 255, 0.2)' }}>
                            <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>A</span>
                            <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '14px', padding: '2px 4px' }}>{formatTime(tempLoopStart)}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>(이전 B 구간 + 0.1초 자동 설정)</span>
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(236, 72, 153, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px dashed var(--secondary)', cursor: 'pointer' }} onClick={handleSetLoopB}>
                            <button style={{ background: 'var(--secondary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>B</button>
                            <span style={{ fontFamily: 'monospace', color: 'var(--secondary)', fontSize: '14px', padding: '2px 4px' }}>클릭하여 추가</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      {showVideoModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{isEditingVideo ? '영상 정보 수정' : '새 유튜브 영상 등록'}</h3>
            <form onSubmit={handleAddOrEditVideo}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>영상 제목</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="예: 섀도잉용 미드 클립"
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>유튜브 URL</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  required
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  ※ 정확한 유튜브 영상 URL 주소를 복사해서 붙여넣어주세요.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowVideoModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary">{isEditingVideo ? '수정 완료' : '등록하기'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

export default App;
