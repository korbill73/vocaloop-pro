import React, { useState } from 'react';
import { Folder, Video, Plus, PlayCircle, Eye, Clock, Download, Upload } from 'lucide-react';
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

  const handleAdminToggle = () => {
    const current = sessionStorage.getItem('admin_secret');
    if (current) {
      sessionStorage.removeItem('admin_secret');
      window.location.reload();
    } else {
      const pw = prompt("관리자 비밀번호를 입력하세요:");
      if (pw) {
        sessionStorage.setItem('admin_secret', pw);
        window.location.reload();
      }
    }
  };

  const isAdmin = !!sessionStorage.getItem('admin_secret');

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const importedData = JSON.parse(ev.target.result);
        if (importedData && importedData.categories && importedData.videos) {
          // Sync directly to Supabase via saveStorageData since we are admin
          import('../utils/storage').then(({ saveStorageData }) => {
             saveStorageData(importedData).then(() => {
                window.location.reload();
             });
          });
        } else {
          alert('올바른 VocaLoop 데이터 파일이 아닙니다.');
        }
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset input
  };

  return (
    <aside className="sidebar">
      {/* ... keeping the rest the same ... */}
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
          {isAdmin && (
            <button className="btn btn-sm" style={{ padding: '2px 6px' }} onClick={() => setIsAddingCat(true)}>
              <Plus size={14} />
            </button>
          )}
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
            등록된 카테고리가 없습니다.
          </div>
        )}
      </div>

      {/* Admin Mode Toggle Area */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <label className="btn btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', margin: 0 }}>
              데이터 복원(DB)
              <input type="file" accept=".json" onChange={handleImportData} style={{ display: 'none' }} />
            </label>
          </div>
        )}
        <button className="btn btn-sm" onClick={handleAdminToggle} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', background: isAdmin ? 'rgba(0,255,255,0.1)' : 'rgba(255,255,255,0.05)', color: isAdmin ? '#00ffff' : 'white', border: isAdmin ? '1px solid rgba(0,255,255,0.3)' : 'none' }}>
          {isAdmin ? '관리자 권한 활성화됨' : '관리자 모드 접속'}
        </button>
      </div>
    </aside>
  );
}
