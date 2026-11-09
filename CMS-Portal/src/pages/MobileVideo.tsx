import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api'
import { uploadTeacherVideo } from '../services/uploadService'

// CMS → Mobile Video: the short intro video the mobile app shows once, right after a student logs in.
// The file is uploaded to Bunny Stream; the app streams it from there.

type IntroVideo = {
  videoId: string;
  title: string | null;
  playerUrl: string;
  durationSec: number | null;
  updatedAt: string;
};

type Props = {
  showToast: (message: string, type?: 'success' | 'error') => void;
};

const inputStyle: React.CSSProperties = { padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' };
const MAX_MB = 200;

export default function MobileVideo({ showToast }: Props) {
  const [video, setVideo] = useState<IntroVideo | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ video: IntroVideo | null; ready: boolean | null }>('/cms/app-intro-video');
      setVideo(res.video);
      setReady(res.ready);
    } catch (e: any) {
      showToast('Could not load the mobile video: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, []);

  const handleUpload = async () => {
    if (!file) return showToast('Choose a video file first', 'error');
    if (!file.type.startsWith('video/')) return showToast('Please choose a video file (MP4)', 'error');
    if (file.size > MAX_MB * 1024 * 1024) return showToast(`Video must be under ${MAX_MB} MB`, 'error');
    setBusy(true);
    setProgress(0);
    abortRef.current = new AbortController();
    try {
      const uploaded = await uploadTeacherVideo(file, { title: title.trim() || 'Mobile intro video' }, setProgress, abortRef.current.signal);
      const res = await apiFetch<{ video: IntroVideo; ready: boolean | null }>('/cms/app-intro-video', {
        method: 'PUT',
        body: { videoId: uploaded.vimeoVideoId, title: title.trim() || null },
      });
      setVideo(res.video);
      setReady(res.ready);
      setFile(null);
      setTitle('');
      showToast('Mobile video saved. Students will see it once after they log in.', 'success');
    } catch (e: any) {
      showToast('Upload failed: ' + e.message, 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove the mobile video? Students will not see any intro video until you upload a new one.')) return;
    setBusy(true);
    try {
      await apiFetch('/cms/app-intro-video', { method: 'DELETE' });
      setVideo(null);
      setReady(null);
      showToast('Mobile video removed', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="glass-card">
        <h3 style={{ marginBottom: '8px' }}>Mobile intro video</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Shown once in the mobile app, right after a student logs in. The first time, the student cannot close it until it ends.
          If the app is closed before it ends, it shows again next time with a close (×) button. Keep it short (about 30 seconds).
          Uploading a new video shows the new one once to every student again.
        </p>
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>Current video</h3>
        {loading ? (
          <div className="skeleton-box" style={{ width: '100%', maxWidth: '360px', height: '200px' }} aria-busy="true" />
        ) : !video ? (
          <p style={{ color: 'var(--text-secondary)' }}>No mobile video yet. Upload one below.</p>
        ) : (
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ width: '220px', aspectRatio: '9 / 16', background: 'black', borderRadius: '12px', overflow: 'hidden' }}>
              <iframe
                src={video.playerUrl}
                title="Mobile intro video preview"
                style={{ width: '100%', height: '100%', border: 0 }}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
              <h4 style={{ color: 'white', margin: 0 }}>{video.title || 'Mobile intro video'}</h4>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {video.durationSec ? `${video.durationSec} seconds • ` : ''}Updated {new Date(video.updatedAt).toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: '0.9rem', color: ready === false ? '#fbbf24' : '#34d399' }}>
                {ready === false ? 'Bunny is still processing this video. Students see it once it is ready.' : ready ? 'Ready on Bunny' : 'Status unknown'}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Bunny video ID: {video.videoId}</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="btn" onClick={load} disabled={busy} style={{ padding: '8px 14px' }}>Refresh status</button>
                <button className="btn" onClick={handleRemove} disabled={busy} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(239,68,68,0.6)', color: '#fca5a5' }}>Remove</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: 'var(--space-md)' }}>{video ? 'Replace video' : 'Upload video'}</h3>
        <div style={{ display: 'grid', gap: '16px', maxWidth: '520px' }}>
          <div>
            <label style={labelStyle} htmlFor="mobile-video-file">Video file (MP4, portrait 9:16 works best, under {MAX_MB} MB)</label>
            <input id="mobile-video-file" type="file" accept="video/*" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="mobile-video-title">Title (only for the CMS)</label>
            <input id="mobile-video-title" type="text" value={title} maxLength={120} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder="App tour – November" style={{ ...inputStyle, width: '100%' }} />
          </div>
          {progress !== null && (
            <div role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent, #38bdf8)', transition: 'width 0.2s' }} />
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Uploading to Bunny… {Math.round(progress)}%</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={handleUpload} disabled={busy || !file}>{busy && progress !== null ? 'Uploading…' : video ? 'Upload and replace' : 'Upload and save'}</button>
            {busy && progress !== null && (
              <button className="btn" onClick={() => abortRef.current?.abort()} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
