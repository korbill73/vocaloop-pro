import React, { useState } from 'react';
import { Folder, Video, Plus, PlayCircle, Eye, Clock, Trash2 } from 'lucide-react';
import { addCategory } from '../utils/storage';

export default function Sidebar({ data, onSelectCategory, selectedCategoryId, onSelectVideo, selectedVideoId, onDataChange }) {
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const handleAddCat = (e) => {
    e.preventDefault();
    if (newCatName.trim()) {
      const newData = addCategory(newCatName.trim());
      onDataChange(newData);
      setNewCatName('');
      setIsAddingCat(false);
    }
  };

  const formatWatchTime = (seconds) => {
    if (!seconds) return '0m';
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    return `${min}m`;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Video color="var(--primary)" /> VocaLoop Pro
        </h2>
      </div>

      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Channels / Categories
          </h3>
          <button className="btn btn-sm" style={{ padding: '2px 6px' }} onClick={() => setIsAddingCat(true)}>
            <Plus size={14} />
          </button>
        </div>

        {isAddingCat && (
          <form onSubmit={handleAddCat} style={{ marginBottom: '12px' }}>
            <input 
              autoFocus
              type="text" 
              className="input-field" 
              placeholder="채널명 입력 (Enter)" 
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onBlur={() => setIsAddingCat(false)}
              style={{ marginTop: 0, padding: '6px 10px', fontSize: '13px' }}
            />
          </form>
        )}

        {data.categories.map(cat => (
          <div key={cat.id} style={{ marginBottom: '16px' }}>
            <div 
              className={`category-item ${selectedCategoryId === cat.id ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={16} color={selectedCategoryId === cat.id ? 'var(--primary)' : 'var(--text-muted)'} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
              </div>
            </div>

            {/* Video List if Category is Selected */}
            {selectedCategoryId === cat.id && (
              <div style={{ paddingLeft: '12px', marginTop: '4px' }}>
                {data.videos.filter(v => v.categoryId === cat.id).length === 0 ? (
                  <div style={{ padding: '8px 20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    등록된 영상이 없습니다.
                  </div>
                ) : (
                  data.videos.filter(v => v.categoryId === cat.id).map(video => (
                    <div 
                      key={video.id} 
                      className={`video-item ${selectedVideoId === video.id ? 'active' : ''}`}
                      onClick={() => onSelectVideo(video.id)}
                      style={{ padding: '8px 16px', borderRadius: '6px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <PlayCircle size={14} style={{ marginTop: '2px', color: selectedVideoId === video.id ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {video.title}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <span className="stat-badge"><Eye size={10} /> {video.views || 0}</span>
                            <span className="stat-badge"><Clock size={10} /> {formatWatchTime(video.watchedSeconds)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        {data.categories.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            + 버튼을 눌러 카테고리를 추가하세요.
          </div>
        )}
      </div>
    </aside>
  );
}
