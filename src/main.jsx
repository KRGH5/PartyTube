import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './style.css';

let youtubeApi;
const loadYouTubeApi = () => {
  if (youtubeApi) return youtubeApi;
  youtubeApi = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previousReady?.(); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => reject(new Error('Could not load the YouTube player. Check your connection or content blockers.'));
    document.head.appendChild(script);
  });
  return youtubeApi;
};

const getVideoId = value => {
  const input = String(value || '').trim();
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
    return url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] || '';
  } catch { return input.match(/^[\w-]{11}$/)?.[0] || ''; }
};

const App = () => {
  const [roomId, setRoomId] = useState(new URLSearchParams(location.search).get('room') || '');
  const [name, setName] = useState(localStorage.getItem('pt-name') || '');
  const [video, setVideo] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [joined, setJoined] = useState(false); const [me, setMe] = useState(null); const [members, setMembers] = useState([]); const [state, setState] = useState(null); const [notice, setNotice] = useState('');
  const socket = useRef(); const player = useRef(); const playerElement = useRef(); const latestState = useRef(null);
  const controller = ['host', 'moderator'].includes(me?.role);
  const apply = useCallback(next => {
    latestState.current = next;
    const instance = player.current;
    if (!instance?.seekTo) return;
    instance.seekTo(Math.max(0, Number(next.position) || 0), true);
    if (next.playing) instance.playVideo(); else instance.pauseVideo();
  }, []);
  useEffect(() => { socket.current = io(); const connection = socket.current;
    connection.on('sync_state', next => { setState(next); apply(next); }); connection.on('participants', setMembers); connection.on('removed', () => { setJoined(false); setNotice('You were removed from this party.'); history.replaceState({}, '', location.pathname); });
    return () => connection.disconnect(); }, [apply]);
  useEffect(() => {
    if (!joined || !state?.videoId || !playerElement.current) return;
    let cancelled = false; player.current?.destroy?.(); player.current = undefined;
    loadYouTubeApi().then(YT => { if (cancelled) return; player.current = new YT.Player(playerElement.current, { videoId: state.videoId, playerVars: { playsinline: 1, rel: 0, origin: location.origin }, events: { onReady: () => apply(latestState.current || state), onError: event => setNotice(`YouTube could not play this video (error ${event.data}). Try another public YouTube video.`) } }); }).catch(error => !cancelled && setNotice(error.message));
    return () => { cancelled = true; player.current?.destroy?.(); player.current = undefined; };
  }, [joined, state?.videoId, apply]);
  const currentPosition = () => { const position = player.current?.getCurrentTime?.(); return Number.isFinite(position) ? position : (state?.position || 0); };
  const send = (action, extra = {}) => socket.current.emit('playback', { action, position: currentPosition(), ...extra }, response => response?.error && setNotice(response.error));
  const control = action => { if (action === 'play') player.current?.playVideo?.(); if (action === 'pause') player.current?.pauseVideo?.(); send(action); };
  const create = async () => { const videoId = getVideoId(video); if (!videoId) return setNotice('Paste a valid YouTube video link.'); try { const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoId }) }); const data = await response.json(); if (!response.ok || !data.roomId) throw new Error(data.error || 'Could not create the room.'); setRoomId(data.roomId); history.replaceState({}, '', `?room=${data.roomId}`); join(data.roomId); } catch (error) { setNotice(error.message || 'The server is not running. Start the app with corepack pnpm dev.'); } };
  const join = (room = roomId) => { if (!name.trim()) return setNotice('Enter a display name first.'); localStorage.setItem('pt-name', name.trim()); socket.current.emit('join_room', { roomId: room, username: name }, result => { if (result.error) return setNotice(result.error); latestState.current = result.state; setMe(result.member); setMembers(result.participants); setState(result.state); setJoined(true); setNotice(''); }); };
  if (!joined) return <main className="landing"><section><p className="eyebrow">WATCH TOGETHER, ANYWHERE</p><h1>Party<span>Tube</span></h1><label>Your display name<input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your display name" /></label><div className="cards"><article><h2>Start a party</h2><input value={video} onChange={e => setVideo(e.target.value)} placeholder="YouTube link" /><button onClick={create}>Create room</button></article><article><h2>Join a party</h2><input value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())} placeholder="Room code" /><button className="secondary" onClick={() => join()}>Join room</button></article></div>{notice && <p className="notice">{notice}</p>}</section></main>;
  return <main className="room"><header><a href="/">Party<span>Tube</span></a><div className="roomcode">ROOM CODE <b>{roomId}</b><button onClick={() => navigator.clipboard.writeText(location.href)}>Copy link</button></div><div className="profile">{name} <em>{me?.role}</em></div></header><section className="watch"><div className="video"><div ref={playerElement} id="player" /></div><aside><h2>In this party <small>{members.length}</small></h2>{members.map(member => <div className="member" key={member.userId}><div className="avatar">{member.username[0]}</div><span>{member.username}{member.userId === me?.userId && ' (you)'}</span><em>{member.role}</em>{me?.role === 'host' && member.userId !== me.userId && <div className="actions"><button onClick={() => socket.current.emit('assign_role', { userId: member.userId, role: member.role === 'moderator' ? 'participant' : 'moderator' })}>{member.role === 'moderator' ? 'Demote' : 'Make mod'}</button><button className="remove" onClick={() => socket.current.emit('remove_participant', { userId: member.userId })}>Remove</button></div>}</div>)}</aside></section><section className="controls"><div><button disabled={!controller} onClick={() => control(state?.playing ? 'pause' : 'play')}>{state?.playing ? 'Pause for everyone' : 'Play for everyone'}</button><button disabled={!controller} onClick={() => send('seek', { position: Math.max(0, currentPosition() - 10) })}>-10 sec</button><button disabled={!controller} onClick={() => send('seek', { position: currentPosition() + 10 })}>+10 sec</button></div><form onSubmit={e => { e.preventDefault(); const videoId = getVideoId(new FormData(e.currentTarget).get('video')); if (!videoId) return setNotice('Paste a valid YouTube video link.'); send('change_video', { videoId, position: 0 }); e.currentTarget.reset(); }}><input disabled={!controller} name="video" placeholder="Paste another YouTube link" /><button disabled={!controller}>Change video</button></form>{!controller && <p>Only the host or a moderator can control this room.</p>}{notice && <p className="notice">{notice}</p>}</section></main>;
};
createRoot(document.getElementById('root')).render(<App />);
